const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const permissionChecker = require('../../utils/permissionChecker');
const ModerationActionModel = require('../../models/ModerationActionModel');

const ACTION_EMOJIS = {
  mute: '🔇',
  ban: '🔨',
  kick: '👢',
  warn: '⚠️',
  unban: '🔓',
  unmute: '🔊',
  total: '📈'
};

function formatStat(actionType, data) {
  const emoji = ACTION_EMOJIS[actionType] || '📋';
  const name = actionType.charAt(0).toUpperCase() + actionType.slice(1);

  return {
    name: `${emoji} ${name}${actionType === 'total' ? '' : 's'}`,
    value: `**Last 7 days:** ${data.last7}\n**Last 30 days:** ${data.last30}\n**All time:** ${data.allTime}`,
    inline: true
  };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('modstats')
    .setDescription('View moderation statistics for yourself or a specific moderator')
    .addUserOption(option =>
      option.setName('moderator')
        .setDescription('View statistics for a specific moderator (defaults to yourself)')
    ),
  isPublic: false,

  async execute(interaction) {
    const hasPermission = await permissionChecker.requirePermission(interaction, 'modstats');
    if (!hasPermission) return;

    try {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      const targetModerator = interaction.options.getUser('moderator') || interaction.user;

      const stats = await ModerationActionModel.getModeratorStatistics(targetModerator.id);

      const embed = new EmbedBuilder()
        .setColor(0xFFB6C1)
        .setTitle('📊 Moderation Statistics')
        .setDescription(`**Moderator:** ${targetModerator.tag} (<@${targetModerator.id}>)\n**User ID:** ${targetModerator.id}`)
        .setThumbnail(targetModerator.displayAvatarURL())
        .setTimestamp()
        .setFooter({
          text: `Requested by ${interaction.user.tag} • Statistics as of now 💖`,
          iconURL: interaction.user.displayAvatarURL()
        });

      if (!stats || stats.total.allTime === 0) {
        embed.setDescription(`**${targetModerator.tag}** hasn't performed any moderation actions yet! 🌸`)
          .addFields({
            name: '💡 Info',
            value: 'Statistics will appear here once moderation commands are used.',
            inline: false
          })
          .setFooter({
            text: `Requested by ${interaction.user.tag} • Clean slate! 💖`,
            iconURL: interaction.user.displayAvatarURL()
          });

        return interaction.editReply({ embeds: [embed] });
      }

      const mainTypes = ['mute', 'ban', 'kick', 'warn'];
      for (const type of mainTypes) {
        if (stats[type]) {
          embed.addFields(formatStat(type, stats[type]));
        }
      }

      const optionalTypes = ['unban', 'unmute'];
      for (const type of optionalTypes) {
        const data = stats[type];
        if (data && (data.allTime || data.last30 || data.last7)) {
          embed.addFields(formatStat(type, data));
        }
      }

      embed.addFields(formatStat('total', stats.total));

      const recentActivity = stats.total.last7;
      const olderActivity = stats.total.last30 - stats.total.last7;
      const mostActiveText =
        recentActivity > olderActivity
          ? 'Last 7 days'
          : olderActivity > recentActivity
          ? 'Previous 23 days'
          : 'Consistent activity';

      let primaryAction = 'None';
      let primaryCount = 0;

      for (const [key, data] of Object.entries(stats)) {
        if (key === 'total') continue;
        if (!data || data.allTime <= 0) continue;

        if (data.allTime > primaryCount) {
          primaryCount = data.allTime;
          primaryAction = key.charAt(0).toUpperCase() + key.slice(1);
        }
      }

      const summaryLines = [
        `**Most active period:** ${mostActiveText}`,
        `**Primary action:** ${primaryAction}${primaryCount ? `s (${primaryCount})` : ''}`
      ];

      embed.addFields({
        name: '📋 Summary',
        value: summaryLines.join('\n'),
        inline: false
      });

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error('Error in modstats command:', error);

      const errorEmbed = new EmbedBuilder()
        .setColor(0xFFB6C1)
        .setTitle('❌ Statistics Error')
        .setDescription('An error occurred while fetching moderation statistics. Please try again.')
        .setFooter({ text: 'Contact an administrator if this persists 💔' })
        .setTimestamp();

      if (interaction.deferred) {
        await interaction.editReply({ embeds: [errorEmbed] });
      } else {
        await interaction.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
      }
    }
  }
};
