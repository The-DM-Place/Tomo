const {
  SlashCommandBuilder,
  EmbedBuilder,
  MessageFlags
} = require('discord.js');

const permissionChecker = require('../../utils/permissionChecker');
const moderationLogger = require('../../utils/moderationLogger');
const ModerationActionModel = require('../../models/ModerationActionModel');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('mute')
    .setDescription('Timeout a user in the server')
    .addUserOption(opt =>
      opt.setName('user')
        .setDescription('The user to timeout')
        .setRequired(true))
    .addStringOption(opt =>
      opt.setName('duration')
        .setDescription('Duration (1m, 30m, 2h, 1d, 1w)')
        .setRequired(true))
    .addStringOption(opt =>
      opt.setName('reason')
        .setDescription('Reason for the timeout')),
  isPublic: false,

  async execute(interaction) {
    if (!(await permissionChecker.requirePermission(interaction, 'mute'))) return;

    await interaction.deferReply();

    try {
      const targetUser = interaction.options.getUser('user');
      const reason = interaction.options.getString('reason') || 'No reason provided';
      const duration = interaction.options.getString('duration');
      const moderator = interaction.member;

      const targetMember =
        interaction.options.getMember('user')
        || await interaction.guild.members.fetch(targetUser.id).catch(() => null);

      const errorEmbed = (title, desc) =>
        new EmbedBuilder()
          .setColor(0xFFB6C1)
          .setTitle(title)
          .setDescription(desc)
          .setFooter({ text: 'Action blocked 🔒' });

      if (targetUser.id === interaction.user.id)
        return interaction.editReply({
          embeds: [errorEmbed(
            '🌸 Oops!',
            'You cannot mute yourself, silly! 💕'
          )]
        });

      if (targetUser.id === interaction.client.user.id)
        return interaction.editReply({
          embeds: [errorEmbed(
            '🌸 That’s not very nice!',
            'I cannot mute myself! 💔'
          )]
        });

      if (!targetMember)
        return interaction.editReply({
          embeds: [errorEmbed(
            '❌ User Not Found',
            'This user is not in the server! 💔'
          )]
        });

      if (targetMember.id === interaction.guild.ownerId)
        return interaction.editReply({
          embeds: [errorEmbed(
            '👑 Ultimate Power!',
            'Cannot mute the server owner! ✨'
          )]
        });

      if (
        targetMember.roles.highest.position >= moderator.roles.highest.position &&
        interaction.user.id !== interaction.guild.ownerId
      )
        return interaction.editReply({
          embeds: [errorEmbed(
            '👑 Role Hierarchy',
            'You cannot mute someone with equal or higher roles than you!'
          )]
        });

      const bot = interaction.guild.members.me;

      if (!bot.permissions.has('ModerateMembers')) {
        return interaction.editReply({
          embeds: [errorEmbed(
            '❌ Missing Permissions',
            'I need the **Moderate Members** permission to mute users. Please update my role permissions.'
          )]
        });
      }

      if (targetMember.roles.highest.position >= bot.roles.highest.position) {
        return interaction.editReply({
          embeds: [errorEmbed(
            '🥺 Role Hierarchy Issue',
            'I cannot mute this user because their role is higher than or equal to mine. Please adjust my role position.'
          )]
        });
      }

      if (targetMember.communicationDisabledUntil > new Date()) {
        const until = Math.floor(targetMember.communicationDisabledUntil / 1000);
        return interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor(0xFFB6C1)
              .setTitle('🔇 Already Muted!')
              .setDescription(`${targetUser.tag} is already timed out!`)
              .addFields({ name: 'Expires', value: `<t:${until}:R>` })
          ]
        });
      }

      const durationMs = parseDuration(duration);
      if (!durationMs)
        return interaction.editReply({
          embeds: [errorEmbed(
            '❌ Invalid Duration',
            'Use formats like `1m`, `30m`, `2h`, `1d`, `1w`'
          )]
        });

      if (durationMs > 28 * 24 * 60 * 60 * 1000)
        return interaction.editReply({
          embeds: [errorEmbed(
            '⏰ Duration Too Long!',
            'Discord timeouts can only last up to **28 days**!'
          )]
        });

      const dbAction = await ModerationActionModel.logAction({
        type: 'mute',
        userId: targetUser.id,
        moderatorId: interaction.user.id,
        reason,
        duration
      });

      const dmEmbed = new EmbedBuilder()
        .setColor(0xFFB6C1)
        .setTitle('🔇 You have been muted')
        .setDescription(`You have been timed out in **${interaction.guild.name}**`)
        .addFields(
          { name: 'Reason', value: `\`${reason}\`` },
          { name: 'Duration', value: `\`${duration}\`` },
          { name: 'Case ID', value: `\`${dbAction.caseId}\`` }
        )
        .setTimestamp();

      targetUser.send({ embeds: [dmEmbed] }).catch(() => { });

      await targetMember.timeout(durationMs, `${reason} | Muted by: ${interaction.user.tag}`);

      await moderationLogger.logAction(interaction.client, {
        type: 'mute',
        moderator: interaction.user,
        target: targetUser,
        reason,
        duration,
        caseId: dbAction.caseId
      });

      return interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xFFB6C1)
            .setDescription(`🔇 **${targetUser.tag} has been muted** | ${reason}`)
            .setFooter({ text: `Case ID: ${dbAction.caseId}` })
            .setTimestamp()
        ]
      });

    } catch (err) {
      console.error('Mute command error:', err);

      const embed = new EmbedBuilder()
        .setColor(0xFFB6C1)
        .setTitle('❌ Mute Failed')
        .setDescription('An unexpected error occurred. Please try again.')
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    }
  }
};

function parseDuration(str) {
  const m = str.match(/^(\d+)([mhdw])$/);
  if (!m) return null;

  const num = Number(m[1]);
  return {
    m: num * 60_000,
    h: num * 3_600_000,
    d: num * 86_400_000,
    w: num * 604_800_000
  }[m[2]];
}
