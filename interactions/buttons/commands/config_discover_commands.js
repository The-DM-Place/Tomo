const { PermissionFlagsBits } = require('discord.js');
const ConfigModel = require('../../../models/ConfigModel');
const renderConfigSection = require('../../../helpers/renderConfigSection');
const logger = require('../../../utils/logger');

module.exports = {
	customId: /^config_discover_commands$/,
	permissions: PermissionFlagsBits.Administrator,

	async execute(interaction) {
		try {
			await interaction.deferUpdate();


			logger.info(`🔍 Admin ${interaction.user.tag} requested command discovery`);
			const discoveredCount = await ConfigModel.discoverAndRegisterCommands(interaction.client, false);

			const response = await renderConfigSection('commands', interaction.guild.id);

			await interaction.editReply({
				components: response.components
			});

			logger.success(`🔍 Command discovery completed by ${interaction.user.tag} - ${discoveredCount} new commands found`);

		} catch (error) {
			logger.error('❌ Error discovering commands:', error);

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
				const fallbackMessage = "❌ Failed to discover commands. Check console for details.";
				if (interaction.deferred) {
					await interaction.editReply({ content: fallbackMessage, components: [] });
				} else {
					await interaction.reply({ content: fallbackMessage, ephemeral: true });
				}
			}
		}
	}
};