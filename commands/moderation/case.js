const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const permissionChecker = require('../../utils/permissionChecker');
const ModerationActionModel = require('../../models/ModerationActionModel');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('case')
    .setDescription('View details about a specific moderation case')
    .addStringOption(opt =>
      opt.setName('case_id')
        .setDescription('The case ID to look up')
        .setRequired(true)
    ),
  isPublic: false,

  async execute(interaction) {
    if (!(await permissionChecker.requirePermission(interaction, 'case'))) return;

    try {
      const caseId = interaction.options.getString('case_id');

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      const caseData = await ModerationActionModel.getCase(caseId);

      if (!caseData) {
        return interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor(0xFFB6C1)
              .setTitle('❌ Case Not Found')
              .setDescription(`No case found with ID \`${caseId}\``)
              .setFooter({ text: 'Double-check the case ID! 🔍' })
          ]
        });
      }

      const [targetUser, moderatorUser] = await Promise.all([
        interaction.client.users.fetch(caseData.userId).catch(() => null),
        interaction.client.users.fetch(caseData.moderatorId).catch(() => null)
      ]);

      const timestamp = Math.floor(new Date(caseData.timestamp).getTime() / 1000);

      const embed = new EmbedBuilder()
        .setColor(0xFFB6C1)
        .setTitle(`📋 Case ${caseData.caseId}`)
        .addFields(
          {
            name: '👤 Target User',
            value: targetUser
              ? `${targetUser.tag} (\`${targetUser.id}\`)`
              : `Unknown User (\`${caseData.userId}\`)`,
            inline: true
          },
          {
            name: '🔨 Moderator',
            value: moderatorUser
              ? `${moderatorUser.tag} (\`${moderatorUser.id}\`)`
              : `Unknown Moderator (\`${caseData.moderatorId}\`)`,
            inline: true
          },
          {
            name: '⚡ Action Type',
            value: `\`${caseData.type}\``,
            inline: true
          },
          {
            name: '💭 Reason',
            value: `\`${caseData.reason}\``,
            inline: false
          },
          {
            name: '🕐 Timestamp',
            value: `<t:${timestamp}:F>`,
            inline: true
          }
        )
        .setTimestamp()
        .setFooter({ text: 'Case details retrieved! 🌸' });

      if (caseData.duration) {
        embed.addFields({
          name: '⏰ Duration',
          value: `\`${caseData.duration}\``,
          inline: true
        });
      }

      if (targetUser) {
        embed.setThumbnail(targetUser.displayAvatarURL());
      }

      return interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error('Error in case command:', error);

      const errEmbed = new EmbedBuilder()
        .setColor(0xFFB6C1)
        .setTitle('❌ Case Lookup Failed')
        .setDescription('Something went wrong while retrieving the case.')
        .setFooter({ text: 'Please try again later 💔' })
        .setTimestamp();

      if (interaction.deferred) {
        return interaction.editReply({ embeds: [errEmbed] });
      } else {
        return interaction.reply({ embeds: [errEmbed], flags: MessageFlags.Ephemeral });
      }
    }
  }
};
