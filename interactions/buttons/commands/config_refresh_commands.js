const { PermissionFlagsBits } = require('discord.js');
const ConfigModel = require('../../../models/ConfigModel');
const renderConfigSection = require('../../../helpers/renderConfigSection');
const logger = require('../../../utils/logger');

module.exports = {
	customId: /^config_refresh_commands$/,
	permissions: PermissionFlagsBits.Administrator,

	async execute(interaction) {
		try {
			await interaction.deferUpdate();


			logger.info(`🔄 Admin ${interaction.user.tag} requested command list refresh`);
			const refreshedCount = await ConfigModel.discoverAndRegisterCommands(interaction.client, true);

			const response = await renderConfigSection('commands', interaction.guild.id);

			await interaction.editReply({
				components: response.components
			});

			logger.success(`🔄 Command refresh completed by ${interaction.user.tag} - ${refreshedCount} commands updated`);

		} catch (error) {
			logger.error('❌ Error refreshing commands:', error);

			try {
				const response = await renderConfigSection('commands', interaction.guild.id);
				if (interaction.deferred) {
					await interaction.editReply({ components: response.components });
				} else {
					await interaction.reply({ components: response.components, ephemeral: true });
				}
			} catch (renderError) {
				logger.error('❌ Error rendering config after failure:', renderError);
				// Fallback to simple message without components
				const fallbackMessage = "❌ Failed to refresh commands. Check console for details.";
				if (interaction.deferred) {
					await interaction.editReply({ content: fallbackMessage, components: [] });
				} else {
					await interaction.reply({ content: fallbackMessage, ephemeral: true });
				}
			}
		}
	}
};