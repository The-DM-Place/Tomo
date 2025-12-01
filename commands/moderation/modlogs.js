const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const permissionChecker = require('../../utils/permissionChecker');
const UserModel = require('../../models/UserModel');

const ACTION_EMOJIS = {
  mute: '🔇',
  ban: '🔨',
  kick: '👢',
  warn: '⚠️',
  unban: '🔓',
  unmute: '🔊'
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('modlogs')
    .setDescription('View moderation case history for yourself or a specific user')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('View case history for a specific user (defaults to yourself)')
    )
    .addIntegerOption(option =>
      option.setName('limit')
        .setDescription('Number of cases to show (1-20)')
        .setMinValue(1)
        .setMaxValue(20)
    ),
  isPublic: false,

  async execute(interaction) {
    if (!(await permissionChecker.requirePermission(interaction, 'modlogs'))) return;

    try {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      const targetUser = interaction.options.getUser('user') || interaction.user;
      const limit = interaction.options.getInteger('limit') || 10;

      const userCases = await UserModel.getCases(targetUser.id, limit);

      const embed = new EmbedBuilder()
        .setColor(0xFFB6C1)
        .setTitle('📋 Moderation Case History')
        .setDescription(`**User:** ${targetUser.tag} (<@${targetUser.id}>)\n**User ID:** ${targetUser.id}`)
        .setThumbnail(targetUser.displayAvatarURL())
        .setTimestamp();

      if (!userCases || userCases.length === 0) {
        embed.addFields({
          name: '💡 Clean Record',
          value: `${targetUser.tag} has no moderation history! ✨`
        });

        return interaction.editReply({ embeds: [embed] });
      }

      const moderatorIds = [...new Set(userCases.map(c => c.moderatorId))];

      const moderatorMap = {};
      await Promise.all(
        moderatorIds.map(id =>
          interaction.client.users.fetch(id)
            .then(user => moderatorMap[id] = user.tag)
            .catch(() => moderatorMap[id] = `Unknown (ID: ${id})`)
        )
      );

      const caseSummary = userCases.reduce((acc, c) => {
        const t = c.type.toLowerCase();
        acc[t] = (acc[t] || 0) + 1;
        return acc;
      }, {});

      const summaryText = Object.entries(caseSummary)
        .map(([type, count]) => {
          const emoji = ACTION_EMOJIS[type] || '📋';
          const name = type[0].toUpperCase() + type.slice(1);
          return `${emoji} ${name}s: **${count}**`;
        })
        .join(' • ');

      embed.addFields({
        name: '📊 Case Summary',
        value: summaryText
      });

      for (const c of userCases.slice(0, limit)) {
        const ts = Math.floor(new Date(c.timestamp).getTime() / 1000);
        const moderatorName = moderatorMap[c.moderatorId];
        const emoji = ACTION_EMOJIS[c.type.toLowerCase()] || '📋';

        const lines = [
          `**Type:** ${emoji} ${c.type}`,
          `**Moderator:** ${moderatorName}`,
          `**Reason:** ${c.reason}`,
          `**Date:** <t:${ts}:F> (<t:${ts}:R>)`
        ];

        if (c.duration) {
          lines.splice(3, 0, `**Duration:** ${c.duration}`);
        }

        embed.addFields({
          name: `📋 Case ${c.caseId}`,
          value: lines.join('\n')
        });
      }

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error('modlogs error:', error);
      const errorEmbed = new EmbedBuilder()
        .setColor(0xFFB6C1)
        .setTitle('❌ Case History Error')
        .setDescription('Something went wrong while fetching case history.')
        .setTimestamp();

      if (interaction.deferred) {
        await interaction.editReply({ embeds: [errorEmbed] });
      } else {
        await interaction.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
      }
    }
  }
};
