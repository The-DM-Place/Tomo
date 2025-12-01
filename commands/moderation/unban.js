const { SlashCommandBuilder, MessageFlags, EmbedBuilder } = require('discord.js');
const permissionChecker = require('../../utils/permissionChecker');
const moderationLogger = require('../../utils/moderationLogger');
const ModerationActionModel = require('../../models/ModerationActionModel');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unban')
    .setDescription('Unban a user from the server')
    .addStringOption(option =>
      option.setName('user')
        .setDescription('User ID or username#discriminator')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('reason')
        .setDescription('Reason for the unban')
        .setRequired(false)
    ),
  isPublic: false,

  async execute(interaction) {
    const hasPermission = await permissionChecker.requirePermission(interaction, 'unban');
    if (!hasPermission) return;

    try {
      const userInput = interaction.options.getString('user');
      const reason = interaction.options.getString('reason') || 'No reason provided';

      await interaction.deferReply({ ephemeral: false });

      let userId = null;
      let targetUser = null;

      if (/^\d{5,30}$/.test(userInput)) {
        userId = userInput;

        try {
          targetUser = await interaction.client.users.fetch(userId).catch(() => null);
        } catch {}
      } else {
        const bans = await interaction.guild.bans.fetch();

        const bannedUser = bans.find(ban =>
          ban.user.tag.toLowerCase() === userInput.toLowerCase() ||
          ban.user.username.toLowerCase() === userInput.toLowerCase()
        );

        if (bannedUser) {
          userId = bannedUser.user.id;
          targetUser = bannedUser.user;
        }
      }

      if (!userId) {
        return interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor(0xFFB6C1)
              .setTitle('🔍 User Not Found')
              .setDescription('No banned user matches that ID or username.')
              .addFields({
                name: '💡 Tips',
                value: `• Use exact **User ID**\n• Use exact **username#0000**\n• Ensure they're actually banned`,
              })
          ]
        });
      }

      let banInfo = null;
      try {
        banInfo = await interaction.guild.bans.fetch(userId);
      } catch {}

      if (!banInfo) {
        return interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor(0xFFB6C1)
              .setTitle('ℹ️ User Not Banned')
              .setDescription(`${targetUser?.tag ?? 'User'} is not currently banned.`)
          ]
        });
      }

      await interaction.guild.members.unban(
        userId,
        `${reason} | Unbanned by: ${interaction.user.tag}`
      );

      const dbAction = await ModerationActionModel.logAction({
        type: 'unban',
        userId,
        moderatorId: interaction.user.id,
        reason
      });

      await moderationLogger.logAction(interaction.client, {
        type: 'unban',
        moderator: interaction.user,
        target: targetUser ?? { tag: `ID: ${userId}`, id: userId, displayAvatarURL: () => null },
        reason,
        caseId: dbAction.caseId
      });

      if (targetUser) {
        const dmEmbed = new EmbedBuilder()
          .setColor(0x90EE90)
          .setTitle('🎉 You have been unbanned!')
          .setDescription(`You have been unbanned from **${interaction.guild.name}**.`)
          .addFields(
            { name: '💭 Reason', value: `\`${reason}\`` },
            { name: '📋 Case ID', value: `\`${dbAction.caseId}\`` },
            { name: '🌸 Welcome Back!', value: 'Please remember to follow the server rules.' },
          )
          .setTimestamp();

        targetUser.send({ embeds: [dmEmbed] }).catch(() => {});
      }

      return interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xFFB6C1)
            .setDescription(`🎉 **${targetUser?.tag ?? userId} was unbanned** | ${reason}`)
            .setFooter({ text: `Case ID: #${dbAction.caseId}` })
            .setTimestamp()
        ]
      });

    } catch (error) {
      console.error('Unban command error:', error);

      return interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xFFB6C1)
            .setTitle('❌ Unban Failed')
            .setDescription('An unexpected error occurred while unbanning this user.')
        ]
      });
    }
  },
};
