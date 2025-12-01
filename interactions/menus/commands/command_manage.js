const {
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  RoleSelectMenuBuilder,
  EmbedBuilder
} = require('discord.js');
const ConfigModel = require('../../../models/ConfigModel');
const logger = require('../../../utils/logger');

module.exports = {
  customId: 'command_manage_menu',
  async execute(interaction) {
    try {
      if (!interaction.guild) {
        return await interaction.reply({
          content: 'This command can only be used in a server!',
          ephemeral: true
        });
      }

      if (!interaction.values || interaction.values.length === 0) {
        return await interaction.reply({
          content: 'No command was selected!',
          ephemeral: true
        });
      }

      const commandName = interaction.values[0];
      const config = await ConfigModel.getConfig();
      const command = config.commands[commandName];

      if (!command) {
        return await interaction.reply({
          content: `Command "${commandName}" not found!`,
          ephemeral: true
        });
      }

      const guildRoles = interaction.guild.roles.cache;

      const whitelistRoles = (command.whitelist || []).filter(roleId => guildRoles.has(roleId));
      const blacklistRoles = (command.blacklist || []).filter(roleId => guildRoles.has(roleId));

      const enabledStatus = command.enabled !== false ? '✅ Enabled' : '❌ Disabled';
      const accessType = command.isPublic ? '🌍 Public (Everyone)' : '👑 Staff Only';
      const whitelistText = whitelistRoles.length > 0
        ? whitelistRoles.map(r => `<@&${r}>`).join(', ')
        : 'None';
      const blacklistText = blacklistRoles.length > 0
        ? blacklistRoles.map(r => `<@&${r}>`).join(', ')
        : 'None';

      const embed = new EmbedBuilder()
        .setColor(0xFFB6C1)
        .setTitle(`🎛️ Managing Command: \`${commandName}\``)
        .setDescription(
          `**Status:** ${enabledStatus}\n` +
          `**Access Type:** ${accessType}\n` +
          `**Whitelist:** ${whitelistText}\n` +
          `**Blacklist:** ${blacklistText}\n` +
          `*🌍 Public: usable by everyone | 👑 Staff: requires staff roles*\n` +
          `*Whitelist overrides access type. Blacklist blocks all access.*`
        );

      const toggleButton = new ButtonBuilder()
        .setCustomId(`command_toggle_single_${commandName}`)
        .setLabel(command.enabled !== false ? 'Disable' : 'Enable')
        .setStyle(command.enabled !== false ? ButtonStyle.Danger : ButtonStyle.Success);

      const publicButton = new ButtonBuilder()
        .setCustomId(`command_toggle_public_${commandName}`)
        .setLabel(command.isPublic ? 'Make Staff Only' : 'Make Public')
        .setStyle(command.isPublic ? ButtonStyle.Secondary : ButtonStyle.Success);

      const addWhitelistButton = new ButtonBuilder()
        .setCustomId(`command_whitelist_add_${commandName}`)
        .setLabel('Add to Whitelist')
        .setStyle(ButtonStyle.Secondary);

      const removeWhitelistButton = new ButtonBuilder()
        .setCustomId(`command_whitelist_remove_${commandName}`)
        .setLabel('Remove from Whitelist')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(whitelistRoles.length === 0);

      const addBlacklistButton = new ButtonBuilder()
        .setCustomId(`command_blacklist_add_${commandName}`)
        .setLabel('Add to Blacklist')
        .setStyle(ButtonStyle.Secondary);

      const removeBlacklistButton = new ButtonBuilder()
        .setCustomId(`command_blacklist_remove_${commandName}`)
        .setLabel('Remove from Blacklist')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(blacklistRoles.length === 0);

      const backButton = new ButtonBuilder()
        .setCustomId('config_commands')
        .setLabel('Back to Commands')
        .setStyle(ButtonStyle.Primary);

      const actionRow1 = new ActionRowBuilder().addComponents(toggleButton, publicButton, backButton);
      const actionRow2 = new ActionRowBuilder().addComponents(addWhitelistButton, removeWhitelistButton);
      const actionRow3 = new ActionRowBuilder().addComponents(addBlacklistButton, removeBlacklistButton);

      await interaction.update({
        embeds: [embed],
        components: [actionRow1, actionRow2, actionRow3]
      });

      logger.info(`User ${interaction.user.tag} opened management for command: ${commandName}`);

    } catch (error) {
      logger.error('Error in command_manage_menu:', error);

      const embed = new EmbedBuilder()
        .setColor(0xFFB6C1)
        .setTitle('❌ Error')
        .setDescription('An error occurred while loading command management. Please try again.')
        .setFooter({ text: 'Something went wrong! 💔' });

      const retryButton = new ButtonBuilder()
        .setCustomId('config_commands')
        .setLabel('Back to Commands')
        .setStyle(ButtonStyle.Primary);

      const actionRow = new ActionRowBuilder().addComponents(retryButton);

      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({
          embeds: [embed],
          components: [actionRow],
          ephemeral: true
        });
      } else {
        await interaction.update({
          embeds: [embed],
          components: [actionRow]
        });
      }
    }
  },
};