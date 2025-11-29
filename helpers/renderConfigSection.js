const ConfigModel = require('../models/ConfigModel');
const {
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  RoleSelectMenuBuilder,
} = require('discord.js');
const logger = require('../utils/logger');


module.exports = async function renderConfigSection(section, interaction) {
  try {
    const config = await ConfigModel.getConfig();

    const staffRolesText = config.staffRoles.length
      ? config.staffRoles.map(r => `<@&${r}>`).join(', ')
      : '❌ No staff roles configured yet';

    const commandsText = Object.keys(config.commands).length
      ? Object.entries(config.commands)
          .map(([cmd, data]) => `\`${cmd}\`: ${data.enabled !== false ? '✅ Enabled' : '❌ Disabled'}`)
          .join('\n')
      : '❌ No commands discovered yet';

    const logsChannelText = config.logsChannelId
      ? `<#${config.logsChannelId}>`
      : '❌ No logs channel set';

    const messageLogsChannelText = config.messageLogsChannelId
      ? `<#${config.messageLogsChannelId}>`
      : '❌ No message logs channel set';

    const appealsInviteText = config.appealInvite
      ? `[Appeals Server](${config.appealInvite})`
      : '❌ No appeal server invite set';

    const loggingEnabled = config.loggingEnabled !== false;
    const messageLoggingEnabled = config.messageLoggingEnabled !== false;
    const appealsEnabled = config.appealsEnabled !== false;

    const container = new ContainerBuilder();

    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent('## 🎛️ Tomo Bot Configuration\n*Manage your bot settings and permissions here*')
    );

    switch (section) {
      case 'staff':
        container.addTextDisplayComponents(
          new TextDisplayBuilder().setContent(`### 👥 Staff Role Management\n*Configure which roles can use moderation commands*\n\n**Current Staff Roles:** ${staffRolesText}`)
        );

        if (interaction?.guild) {
          const addRoleButton = new ButtonBuilder()
            .setCustomId('staff_add_role')
            .setLabel('➕ Add Staff Role')
            .setStyle(ButtonStyle.Success);

          const removeRoleButton = new ButtonBuilder()
            .setCustomId('staff_remove_role')
            .setLabel('➖ Remove Staff Role')
            .setStyle(ButtonStyle.Danger);

          container.addActionRowComponents(
            new ActionRowBuilder().addComponents(addRoleButton, removeRoleButton)
          );

          const quickAddRoleMenu = new RoleSelectMenuBuilder()
            .setCustomId('staff_add_role_menu')
            .setPlaceholder('🚀 Quick Add: Select one or more roles to grant staff permissions')
            .setMinValues(1)
            .setMaxValues(10);

          container.addActionRowComponents(
            new ActionRowBuilder().addComponents(quickAddRoleMenu)
          );

          const staffRoles = config.staffRoles;
          if (staffRoles.length > 0) {
            const removeOptions = staffRoles
              .map(roleId => {
                const role = interaction.guild.roles.cache.get(roleId);
                return role ? { label: `Remove: ${role.name}`, value: role.id, description: 'Click to revoke staff permissions from this role' } : null;
              })
              .filter(Boolean);

            if (removeOptions.length > 0) {
              const quickRemoveRoleMenu = new StringSelectMenuBuilder()
                .setCustomId('staff_remove_role_menu')
                .setPlaceholder('🗑️ Quick Remove: Select roles to revoke staff permissions')
                .setMinValues(1)
                .setMaxValues(Math.min(removeOptions.length, 25))
                .addOptions(removeOptions);

              container.addActionRowComponents(
                new ActionRowBuilder().addComponents(quickRemoveRoleMenu)
              );
            }
          }
        }
        break;

      case 'commands':
        if (Object.keys(config.commands).length > 0) {
          const totalCommands = Object.keys(config.commands).length;
          const enabledCount = Object.values(config.commands).filter(cmd => cmd.enabled !== false).length;
          const publicCount = Object.values(config.commands).filter(cmd => cmd.isPublic).length;

          container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`### 🎮 Command Management\n*Control which commands are available and who can use them*\n\n**Command Overview:**\n📊 **Total Commands:** ${totalCommands}\n✅ **Currently Active:** ${enabledCount}\n🌍 **Public Access:** ${publicCount}\n🛡️ **Staff Only:** ${totalCommands - publicCount}`)
          );

          const manageCommandsButton = new ButtonBuilder()
            .setCustomId('config_commands_manage')
            .setLabel('�️ Manage Individual Commands')
            .setStyle(ButtonStyle.Primary);

          const toggleCommandsButton = new ButtonBuilder()
            .setCustomId('config_commands_toggle')
            .setLabel('⚡ Quick Enable/Disable Commands')
            .setStyle(ButtonStyle.Secondary);

          const refreshButton = new ButtonBuilder()
            .setCustomId('config_refresh_commands')
            .setLabel('🔄 Scan for New Commands')
            .setStyle(ButtonStyle.Secondary);

          container.addActionRowComponents(
            new ActionRowBuilder().addComponents(manageCommandsButton, toggleCommandsButton, refreshButton)
          );
        } else {
          container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent('### 🎮 Command Management\n*No commands have been discovered yet*\n\n**Getting Started:**\nClick the button below to scan your bot for available commands. This will find all slash commands and set up their permissions.')
          );

          const discoverButton = new ButtonBuilder()
            .setCustomId('config_discover_commands')
            .setLabel('🔍 Discover Available Commands')
            .setStyle(ButtonStyle.Primary);

          container.addActionRowComponents(
            new ActionRowBuilder().addComponents(discoverButton)
          );
        }
        break;

      case 'logs':
        const blacklistedChannelsText = config.messageLogsBlacklist && config.messageLogsBlacklist.length > 0
          ? config.messageLogsBlacklist.map(id => `<#${id}>`).join(', ')
          : '❌ No channels blacklisted';

        container.addTextDisplayComponents(
          new TextDisplayBuilder().setContent(`### 📋 Logging Configuration\n*Control your bot's logging and appeals systems*\n\n**🔧 System Status:**\n📝 **Moderation Logging:** ${loggingEnabled ? '✅ Enabled' : '❌ Disabled'}\n💬 **Message Logging:** ${messageLoggingEnabled ? '✅ Enabled' : '❌ Disabled'}\n⚖️ **User Appeals System:** ${appealsEnabled ? '✅ Enabled' : '❌ Disabled'}\n\n**📍 Configuration:**\n**Moderation Logs:** ${logsChannelText}\n*Where moderation actions (mutes, bans, etc.) are recorded*\n\n**Message Logs:** ${messageLogsChannelText}\n*Where message edits, deletions, and other events are logged*\n\n**Message Logs Blacklist:** ${blacklistedChannelsText}\n*Channels excluded from message logging*\n\n**Appeal Server Invite:** ${appealsInviteText}\n*Discord server where users can appeal their punishments*`)
        );

        const toggleLoggingButton = new ButtonBuilder()
          .setCustomId('toggle_logging_system')
          .setLabel(loggingEnabled ? '📝 Disable Moderation Logging' : '📝 Enable Moderation Logging')
          .setStyle(loggingEnabled ? ButtonStyle.Danger : ButtonStyle.Success);

        const toggleMessageLoggingButton = new ButtonBuilder()
          .setCustomId('toggle_message_logging_system')
          .setLabel(messageLoggingEnabled ? '💬 Disable Message Logging' : '💬 Enable Message Logging')
          .setStyle(messageLoggingEnabled ? ButtonStyle.Danger : ButtonStyle.Success);

        const toggleAppealsButton = new ButtonBuilder()
          .setCustomId('toggle_appeals_system')
          .setLabel(appealsEnabled ? '⚖️ Disable Appeals' : '⚖️ Enable Appeals')
          .setStyle(appealsEnabled ? ButtonStyle.Danger : ButtonStyle.Success);

        container.addActionRowComponents(
          new ActionRowBuilder().addComponents(toggleLoggingButton, toggleMessageLoggingButton, toggleAppealsButton)
        );

        if (loggingEnabled || appealsEnabled || messageLoggingEnabled) {
          const channelButtons = [];
          
          if (loggingEnabled) {
            channelButtons.push(
              new ButtonBuilder()
                .setCustomId('set_logs_channel')
                .setLabel('📝 Set Moderation Logs Channel')
                .setStyle(ButtonStyle.Secondary)
            );
          }

          if (messageLoggingEnabled) {
            channelButtons.push(
              new ButtonBuilder()
                .setCustomId('set_message_logs_channel')
                .setLabel('💬 Set Message Logs Channel')
                .setStyle(ButtonStyle.Secondary)
            );
          }
          
          if (appealsEnabled) {
            channelButtons.push(
              new ButtonBuilder()
                .setCustomId('set_appeals_invite')
                .setLabel('⚖️ Set Appeal Server Invite')
                .setStyle(ButtonStyle.Secondary)
            );
          }

          if (channelButtons.length > 0) {
            container.addActionRowComponents(
              new ActionRowBuilder().addComponents(channelButtons)
            );
          }

          if (messageLoggingEnabled) {
            const configMessageLogsButton = new ButtonBuilder()
              .setCustomId('config_message_logs')
              .setLabel('⚙️ Configure Message Logging')
              .setStyle(ButtonStyle.Secondary);

            container.addActionRowComponents(
              new ActionRowBuilder().addComponents(configMessageLogsButton)
            );
          }
        }

        const banEmbedButton = new ButtonBuilder()
          .setCustomId('set_ban_embed_template')
          .setLabel('🎨 Customize Ban Message')
          .setStyle(ButtonStyle.Secondary);

        const resetBanEmbedButton = new ButtonBuilder()
          .setCustomId('reset_ban_embed_template')
          .setLabel('🔄 Reset to Default')
          .setStyle(ButtonStyle.Danger);

        container.addActionRowComponents(
          new ActionRowBuilder().addComponents(banEmbedButton, resetBanEmbedButton)
        );
        break;

      case 'automod':
        const automodRules = config.automodRules || [];
        const automodEnabled = config.automodEnabled !== false;
        
        let rulesText = '❌ No automod rules configured';
        if (automodRules.length > 0) {
          rulesText = automodRules
            .sort((a, b) => a.threshold - b.threshold)
            .map(rule => `**${rule.threshold} warnings** → ${rule.action === 'mute' ? `Mute for ${rule.duration}` : rule.action === 'kick' ? 'Kick' : 'Ban'}`)
            .join('\n');
        }

        container.addTextDisplayComponents(
          new TextDisplayBuilder().setContent(`### 🤖 Automatic Moderation\n*Automatically punish users when they reach warning thresholds*\n\n**🔧 System Status:**\n🤖 **Automod System:** ${automodEnabled ? '✅ Enabled' : '❌ Disabled'}\n\n**📋 Current Rules:**\n${rulesText}\n\n*Rules are applied in order from lowest to highest threshold*`)
        );

        const toggleAutomodButton = new ButtonBuilder()
          .setCustomId('toggle_automod_system')
          .setLabel(automodEnabled ? '🤖 Disable Automod' : '🤖 Enable Automod')
          .setStyle(automodEnabled ? ButtonStyle.Danger : ButtonStyle.Success);

        container.addActionRowComponents(
          new ActionRowBuilder().addComponents(toggleAutomodButton)
        );

        if (automodEnabled) {
          const addRuleButton = new ButtonBuilder()
            .setCustomId('add_automod_rule')
            .setLabel('➕ Add Rule')
            .setStyle(ButtonStyle.Success);

          const manageRulesButton = new ButtonBuilder()
            .setCustomId('manage_automod_rules')
            .setLabel('⚙️ Manage Rules')
            .setStyle(ButtonStyle.Secondary);

          container.addActionRowComponents(
            new ActionRowBuilder().addComponents(addRuleButton, manageRulesButton)
          );
        }
        break;

      case 'general':
      default:
        container.addTextDisplayComponents(
          new TextDisplayBuilder().setContent(`### 📊 Configuration Overview\n*Quick summary of your bot's current settings*\n\n**👥 Staff Roles:** ${staffRolesText}\n**🎮 Commands Available:** ${Object.keys(config.commands).length} commands discovered\n**📝 Moderation Logging:** ${loggingEnabled ? '✅ Enabled' : '❌ Disabled'} - ${logsChannelText}\n**💬 Message Logging:** ${messageLoggingEnabled ? '✅ Enabled' : '❌ Disabled'} - ${messageLogsChannelText}\n**⚖️ User Appeals:** ${appealsEnabled ? '✅ Enabled' : '❌ Disabled'} - ${appealsInviteText}\n\n*Use the tabs below to configure each section in detail*`)
        );
        break;
    }

    container.addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
    );

    const components = [container];

    const buttons = [
      { id: 'config_general', label: '📊 Overview', emoji: '📊' },
      { id: 'config_staff', label: '👥 Staff Roles', emoji: '👥' },
      { id: 'config_commands', label: '🎮 Commands', emoji: '🎮' },
      { id: 'config_logs', label: '📋 Logging', emoji: '📋' },
      { id: 'config_automod', label: '🤖 Automod', emoji: '🤖' },
    ];

    const buttonRow = new ActionRowBuilder().addComponents(
      buttons.map(btn =>
        new ButtonBuilder()
          .setCustomId(btn.id)
          .setLabel(btn.label)
          .setStyle(btn.id === `config_${section}` ? ButtonStyle.Primary : ButtonStyle.Secondary)
      )
    );

    components.push(buttonRow);

    return { components };

  } catch (error) {
    console.log('[ERROR] Error rendering config section:', error);
    
    const container = new ContainerBuilder();
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent('## 🎛️ Tomo Bot Configuration\n*Something went wrong while loading your settings*'),
      new TextDisplayBuilder().setContent('❌ **Error loading configuration.** Please try refreshing or contact support if this persists.')
    );

    const buttonRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('config_general')
        .setLabel('🔄 Try Again')
        .setStyle(ButtonStyle.Primary)
    );

    return { components: [container, buttonRow] };
  }
};
