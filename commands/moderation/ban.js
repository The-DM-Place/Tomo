const {
  SlashCommandBuilder,
  EmbedBuilder,
  ButtonBuilder,
  ActionRowBuilder,
  ButtonStyle
} = require('discord.js');

const permissionChecker = require('../../utils/permissionChecker');
const moderationLogger = require('../../utils/moderationLogger');
const ModerationActionModel = require('../../models/ModerationActionModel');
const ConfigModel = require('../../models/ConfigModel');
const { processBanEmbedTemplate } = require('../../utils/templateProcessor');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Ban a user from the server')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('The user to ban')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('reason')
        .setDescription('Reason for the ban')
        .setRequired(false)
    )
    .addIntegerOption(option =>
      option.setName('delete_messages')
        .setDescription('Delete messages from the last X days (0-7)')
        .setMinValue(0)
        .setMaxValue(7)
        .setRequired(false)
    ),
  isPublic: false,

  async execute(interaction) {
    const hasPermission = await permissionChecker.requirePermission(interaction, 'ban');
    if (!hasPermission) return;

    try {
      const targetMember = interaction.options.getMember('user');
      const targetUser = targetMember?.user ?? interaction.options.getUser('user');

      const reason = interaction.options.getString('reason') || 'No reason provided';
      const deleteMessages = interaction.options.getInteger('delete_messages') || 0;

      if (targetUser.id === interaction.user.id)
        return sendFail(
          interaction,
          '🌸 Oops!',
          'You cannot ban yourself, silly! 💕'
        );

      if (targetUser.id === interaction.client.user.id)
        return sendFail(
          interaction,
          '🌸 That’s not very nice!',
          'I cannot ban myself! That would be quite counterproductive~ 💔'
        );

      if (targetMember) {
        if (targetMember.id === interaction.guild.ownerId)
          return sendFail(
            interaction,
            '👑 Ultimate Power!',
            'Cannot ban the server owner!'
          );

        const mod = interaction.member;

        if (
          targetMember.roles.highest.position >= mod.roles.highest.position &&
          interaction.user.id !== interaction.guild.ownerId
        ) {
          return sendFail(
            interaction,
            '👑 Role Hierarchy',
            'You cannot ban someone with equal or higher roles than you!'
          );
        }

        const bot = interaction.guild.members.me;
        if (targetMember.roles.highest.position >= bot.roles.highest.position)
          return sendFail(
            interaction,
            '🥺 I Need Higher Permissions!',
            'I cannot ban someone with equal or higher roles than me!'
          );

        if (!targetMember.bannable)
          return sendFail(
            interaction,
            '🚫 Cannot Ban User',
            'I cannot ban this user due to Discord hierarchy or permissions!'
          );
      }

      const existingBan = await interaction.guild.bans
        .fetch(targetUser.id)
        .catch(() => null);

      if (existingBan)
        return sendFail(
          interaction,
          '🔨 Already Banned',
          `${targetUser.tag} is already banned.`
        );

      await interaction.deferReply();

      const [
        dbAction,
        appealInvite,
        appealsEnabled,
        banTemplate
      ] = await Promise.all([
        ModerationActionModel.logAction({
          type: 'ban',
          userId: targetUser.id,
          moderatorId: interaction.user.id,
          reason
        }),
        ConfigModel.getAppealInvite(),
        ConfigModel.isAppealsEnabled(),
        ConfigModel.getBanEmbedTemplate()
      ]);

      const processed = processBanEmbedTemplate(banTemplate, {
        user: targetUser,
        server: interaction.guild,
        reason,
        caseId: dbAction.caseId,
        appealInvite,
        moderator: interaction.user
      });

      const dmEmbed = new EmbedBuilder()
        .setColor(processed.color)
        .setTitle(processed.title)
        .setDescription(processed.description)
        .addFields(
          {
            name: '💭 Reason',
            value: `\`${reason}\``
          },
          {
            name: '📋 Case ID',
            value: `\`${dbAction.caseId}\``,
            inline: true
          }
        )
        .setFooter({
          text: processed.footer,
          iconURL: interaction.guild.iconURL()
        })
        .setTimestamp();

      const dmComponents = [];

      if (appealsEnabled && appealInvite) {
        dmEmbed.addFields({
          name: '⚖️ Appeal This Ban',
          value: `If you believe this ban was unfair, you can appeal.\n\n**Case ID:** \`${dbAction.caseId}\`\n**User ID:** \`${targetUser.id}\``
        });

        dmComponents.push(
          new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setLabel('⚖️ Join Appeal Server')
              .setStyle(ButtonStyle.Link)
              .setURL(appealInvite)
          )
        );
      }

      try {
        await targetUser.send({
          embeds: [dmEmbed],
          components: dmComponents
        });
      } catch {}

      await interaction.guild.members.ban(targetUser, {
        reason: `${reason} | Banned by: ${interaction.user.tag}`,
        deleteMessageSeconds: deleteMessages * 86400
      });

      await moderationLogger.logAction(interaction.client, {
        type: 'ban',
        moderator: interaction.user,
        target: targetUser,
        reason,
        caseId: dbAction.caseId
      });


      const success = new EmbedBuilder()
        .setColor(0xFFB6C1)
        .setDescription(`🔨 **${targetUser.tag} was banned** | ${reason}`)
        .setFooter({ text: `Case ID: ${dbAction.caseId}` })
        .setTimestamp();

      if (deleteMessages > 0) {
        success.addFields({
          name: '🧹 Messages Deleted',
          value: `${deleteMessages} day(s)`,
          inline: true
        });
      }

      return interaction.editReply({ embeds: [success] });

    } catch (error) {
      console.error('Ban command error:', error);

      const errorEmbed = new EmbedBuilder()
        .setColor(0xFFB6C1)
        .setTitle('❌ Ban Failed')
        .setDescription('An error occurred while attempting this ban.')
        .setTimestamp();

      if (interaction.deferred)
        return interaction.editReply({ embeds: [errorEmbed] });

      return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
    }
  }
};

function sendFail(interaction, title, description) {
  const embed = new EmbedBuilder()
    .setColor(0xFFB6C1)
    .setTitle(title)
    .setDescription(description)
    .setFooter({ text: 'Action blocked 🔒' });

  return interaction.reply({ embeds: [embed], ephemeral: true });
}
