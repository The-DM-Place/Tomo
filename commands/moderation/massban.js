const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const permissionChecker = require('../../utils/permissionChecker');
const moderationLogger = require('../../utils/moderationLogger');
const ModerationActionModel = require('../../models/ModerationActionModel');
const ConfigModel = require('../../models/ConfigModel');
const { processBanEmbedTemplate } = require('../../utils/templateProcessor');


module.exports = {
    data: new SlashCommandBuilder()
        .setName('massban')
        .setDescription('Ban one or more users from the server')
        .addStringOption(option =>
            option.setName('users')
                .setDescription('User ID(s) to ban (separate multiple IDs with spaces or commas)')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Reason for the ban')
                .setRequired(false))
        .addIntegerOption(option =>
            option.setName('delete_messages')
                .setDescription('Delete messages from the last X days (0-7)')
                .setMinValue(0)
                .setMaxValue(7)
                .setRequired(false)),
    isPublic: false,

    async execute(interaction) {
        const hasPermission = await permissionChecker.requirePermission(interaction, 'ban');
        if (!hasPermission) return;

        try {
            const usersInput = interaction.options.getString('users');
            const reason = interaction.options.getString('reason') || 'No reason provided';
            const deleteMessages = interaction.options.getInteger('delete_messages') || 0;

            const userIds = usersInput
                .split(/[\s,]+/)
                .map(id => id.trim())
                .filter(id => id.length > 0);

            if (userIds.length === 0) {
                const embed = new EmbedBuilder()
                    .setColor(0xFFB6C1)
                    .setTitle('❌ Invalid Input')
                    .setDescription('Please provide at least one valid user ID!')
                    .setFooter({ text: 'Try again! 💖' });

                return await interaction.reply({
                    embeds: [embed],
                    ephemeral: true
                });
            }

            await interaction.deferReply({ ephemeral: true });

            const results = {
                successful: [],
                failed: []
            };

            for (const userId of userIds) {
                try {
                    let targetUser;
                    try {
                        targetUser = await interaction.client.users.fetch(userId);
                    } catch (fetchError) {
                        results.failed.push({ id: userId, reason: 'User not found' });
                        continue;
                    }

                    // Skip self-ban
                    if (targetUser.id === interaction.user.id) {
                        results.failed.push({ id: userId, user: targetUser, reason: 'Cannot ban yourself' });
                        continue;
                    }

                    // Skip bot ban
                    if (targetUser.id === interaction.client.user.id) {
                        results.failed.push({ id: userId, user: targetUser, reason: 'Cannot ban the bot' });
                        continue;
                    }

                    const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

                    if (targetMember) {
                        if (targetMember.id === interaction.guild.ownerId) {
                            results.failed.push({ id: userId, user: targetUser, reason: 'Cannot ban server owner' });
                            continue;
                        }

                        const moderatorMember = interaction.member;
                        if (targetMember.roles.highest.position >= moderatorMember.roles.highest.position &&
                            interaction.user.id !== interaction.guild.ownerId) {
                            results.failed.push({ id: userId, user: targetUser, reason: 'Target has equal or higher role' });
                            continue;
                        }

                        const botMember = interaction.guild.members.me;
                        if (targetMember.roles.highest.position >= botMember.roles.highest.position) {
                            results.failed.push({ id: userId, user: targetUser, reason: 'Bot role too low' });
                            continue;
                        }

                        if (!targetMember.bannable) {
                            results.failed.push({ id: userId, user: targetUser, reason: 'User not bannable' });
                            continue;
                        }
                    }

                    const dbAction = await ModerationActionModel.logAction({
                        type: 'ban',
                        userId: targetUser.id,
                        moderatorId: interaction.user.id,
                        reason: reason
                    });

                    const appealInvite = await ConfigModel.getAppealInvite();
                    const appealsEnabled = await ConfigModel.isAppealsEnabled();
                    const banTemplate = await ConfigModel.getBanEmbedTemplate();

                    const processedTemplate = processBanEmbedTemplate(banTemplate, {
                        user: targetUser,
                        server: interaction.guild,
                        reason: reason,
                        caseId: dbAction.caseId,
                        appealInvite: appealInvite,
                        moderator: interaction.user
                    });

                    const dmEmbed = new EmbedBuilder()
                        .setColor(processedTemplate.color)
                        .setTitle(processedTemplate.title)
                        .setDescription(processedTemplate.description)
                        .addFields(
                            {
                                name: '💭 Reason',
                                value: `\`${reason}\``,
                                inline: false
                            },
                            {
                                name: '📋 Case ID',
                                value: `\`${dbAction.caseId}\``,
                                inline: true
                            }
                        )
                        .setFooter({
                            text: processedTemplate.footer,
                            iconURL: interaction.guild.iconURL()
                        })
                        .setTimestamp();

                    let dmComponents = [];
                    if (appealsEnabled && appealInvite) {
                        dmEmbed.addFields({
                            name: '⚖️ Appeal This Ban',
                            value: `If you believe this ban was unfair, you can join our appeal server to submit an appeal.\n\n**📋 Your Case ID:** \`${dbAction.caseId}\`\n**🆔 Your User ID:** \`${targetUser.id}\`\n\nMake sure to provide these details when appealing.`,
                            inline: false
                        });

                        const appealButton = new ButtonBuilder()
                            .setLabel('⚖️ Join Appeal Server')
                            .setStyle(ButtonStyle.Link)
                            .setURL(appealInvite);

                        dmComponents.push(new ActionRowBuilder().addComponents(appealButton));
                    }

                    try {
                        const dmOptions = { embeds: [dmEmbed] };
                        if (dmComponents.length > 0) {
                            dmOptions.components = dmComponents;
                        }
                        await targetUser.send(dmOptions);
                    } catch (dmError) {
                        console.log(`Could not DM user ${targetUser.tag} about their ban:`, dmError.message);
                    }

                    const banOptions = {
                        reason: `${reason} | Banned by: ${interaction.user.tag}`,
                        deleteMessageSeconds: deleteMessages * 24 * 60 * 60
                    };

                    await interaction.guild.members.ban(targetUser, banOptions);

                    await moderationLogger.logAction(interaction.client, {
                        type: 'ban',
                        moderator: interaction.user,
                        target: targetUser,
                        reason: reason,
                        caseId: dbAction.caseId
                    });

                    results.successful.push({
                        id: userId,
                        user: targetUser,
                        caseId: dbAction.caseId
                    });

                } catch (error) {
                    console.error(`Error banning user ${userId}:`, error);
                    results.failed.push({
                        id: userId,
                        reason: error.message || 'Unknown error'
                    });
                }
            }

            const resultEmbed = new EmbedBuilder()
                .setColor(results.successful.length > 0 ? 0x98FB98 : 0xFFB6C1)
                .setTitle('🔨 Mass Ban Results')
                .setTimestamp();

            if (results.successful.length > 0) {
                const successList = results.successful
                    .map(r => `✅ **${r.user.tag}** (\`${r.id}\`) - Case \`${r.caseId}\``)
                    .join('\n');

                resultEmbed.addFields({
                    name: `✅ Successfully Banned (${results.successful.length})`,
                    value: successList.length > 1024 ? successList.substring(0, 1021) + '...' : successList,
                    inline: false
                });
            }

            if (results.failed.length > 0) {
                const failList = results.failed
                    .map(r => `❌ ${r.user ? `**${r.user.tag}**` : `ID: \`${r.id}\``} - ${r.reason}`)
                    .join('\n');

                resultEmbed.addFields({
                    name: `❌ Failed to Ban (${results.failed.length})`,
                    value: failList.length > 1024 ? failList.substring(0, 1021) + '...' : failList,
                    inline: false
                });
            }

            resultEmbed.addFields(
                {
                    name: '💭 Reason',
                    value: `\`${reason}\``,
                    inline: false
                }
            );

            if (deleteMessages > 0) {
                resultEmbed.addFields({
                    name: '🧹 Messages Deleted',
                    value: `From the last ${deleteMessages} day(s)`,
                    inline: true
                });
            }

            resultEmbed.setFooter({
                text: `Total: ${results.successful.length + results.failed.length} | Success: ${results.successful.length} | Failed: ${results.failed.length}`
            });

            await interaction.editReply({
                embeds: [resultEmbed]
            });

        } catch (error) {
            console.error('Error in ban command:', error);

            const errorEmbed = new EmbedBuilder()
                .setColor(0xFFB6C1)
                .setTitle('❌ Ban Failed')
                .setDescription('An error occurred while trying to ban users! Please try again~')
                .setFooter({ text: 'Please try again or contact support! 💔' })
                .setTimestamp();

            if (interaction.deferred) {
                await interaction.editReply({ embeds: [errorEmbed] });
            } else {
                await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            }
        }
    },
};