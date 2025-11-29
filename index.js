const { Client, GatewayIntentBits, Collection, Partials } = require('discord.js');
const path = require('path');
require('dotenv').config();

const { loadCommands } = require('./handlers/commandHandler');
const { loadEvents } = require('./handlers/eventHandler');
const { loadButtons } = require('./handlers/buttonHandler');
const { loadModals } = require('./handlers/modalHandler');
const { loadSelectMenus } = require('./handlers/selectMenuHandler');

// this shit actually works
const logger = require('./utils/logger');
console.log("CONSOLE CALLED");
process.stdout.write("STDOUT CALLED\n");

const client = new Client({
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.MessageContent,
		GatewayIntentBits.GuildMembers,
		GatewayIntentBits.GuildModeration,
	],
	partials: [
		Partials.Message,
		Partials.Channel,
		Partials.User,
	],
});

client.commands = new Collection();
client.buttons = new Collection();
client.modals = new Collection();
client.selectMenus = new Collection();

async function initializeBot() {
	try {
		console.log('[INFO] Connecting to database...');
		require('./database/connection');

		console.log('[INFO] Loading commands...');
		await loadCommands(client);

		console.log('[INFO] Loading events...');
		await loadEvents(client);

		console.log('[INFO] Loading button handlers...');
		await loadButtons(client);

		console.log('[INFO] Loading modal handlers...');
		await loadModals(client);

		console.log('[INFO] Loading select menu handlers...');
		await loadSelectMenus(client);

		console.log('[INFO] Bot initialization complete!');
	} catch (error) {
		console.log('[ERROR] Error during bot initialization:', error);
		process.exit(1);
	}
}

initializeBot().then(() => {
	console.log('Bot initialization completed, attempting login...');
	client.login(process.env.DISCORD_TOKEN);
});

client.once('ready', async () => {
	console.log(`Bot is ready! Logged in as ${client.user.tag}`);
	console.log(`Select menus loaded: ${client.selectMenus.size}`);
	console.log(`Available select menu IDs: ${Array.from(client.selectMenus.keys()).join(', ')}`);
});

process.on('unhandledRejection', (error) => {
	logger.error('Unhandled promise rejection:', error);
});

process.on('uncaughtException', (error) => {
	logger.error('Uncaught exception:', error);
	process.exit(1);
});

module.exports = client;
