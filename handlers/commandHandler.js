const fs = require('fs').promises;
const path = require('path');
const { REST, Routes } = require('discord.js');
const logger = require('../utils/logger');

async function getCommandFiles(dir, baseDir = dir) {
	let commandFiles = [];

	try {
		const files = await fs.readdir(dir, { withFileTypes: true });

		for (const file of files) {
			const filePath = path.join(dir, file.name);

			if (file.isDirectory()) {
				const subDirFiles = await getCommandFiles(filePath, baseDir);
				commandFiles = commandFiles.concat(subDirFiles);
			} else if (file.name.endsWith('.js')) {
				commandFiles.push(filePath);
			}
		}
	} catch (error) {
		console.log(`[ERROR] Error reading directory ${dir}:`, error);
	}

	return commandFiles;
}

async function loadCommands(client) {
	const commandsPath = path.join(__dirname, '..', 'commands');
	const commands = [];

	try {
		await fs.access(commandsPath);

		const commandFiles = await getCommandFiles(commandsPath);

		console.log(`[INFO] Found ${commandFiles.length} command files`);

		for (const filePath of commandFiles) {
			try {
				delete require.cache[require.resolve(filePath)];

				const command = require(filePath);

				if (!command.data || !command.execute) {
					console.log(
						`[WARN] Command at ${filePath} is missing required properties (data or execute)`
					);
					continue;
				}

				client.commands.set(command.data.name, command);
				commands.push(command.data.toJSON());

				const relativePath = path.relative(commandsPath, filePath);
				console.log(
					`[SUCCESS] Loaded command: ${command.data.name} (${relativePath})`
				);
			} catch (error) {
				console.log(`[ERROR] Error loading command from ${filePath}:`, error);
			}
		}

		if (commands.length > 0) {
			await registerSlashCommands(commands);
		} else {
			console.log('[WARN] No valid commands found to register');
		}
	} catch (error) {
		if (error.code === 'ENOENT') {
			console.log('[WARN] Commands directory not found, creating it...');
			await fs.mkdir(commandsPath, { recursive: true });
		} else {
			console.log('[ERROR] Error loading commands:', error);
		}
	}
}

async function registerSlashCommands(commands) {
	const rest = new REST().setToken(process.env.DISCORD_TOKEN);

	try {
		console.log(
			`[INFO] Started refreshing ${commands.length} application (/) commands.`
		);

		if (process.env.GUILD_ID) {
			await rest.put(
				Routes.applicationGuildCommands(
					process.env.CLIENT_ID,
					process.env.GUILD_ID
				),
				{ body: commands }
			);
			console.log(
				`[SUCCESS] Successfully reloaded ${commands.length} guild application (/) commands.`
			);
		} else {
			await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), {
				body: commands,
			});
			console.log(
				`[SUCCESS] Successfully reloaded ${commands.length} global application (/) commands.`
			);
		}
	} catch (error) {
		console.log('[ERROR] Error registering slash commands:', error);
	}
}

async function reloadCommand(client, commandName) {
	const commandsPath = path.join(__dirname, '..', 'commands');
	const commandFiles = await getCommandFiles(commandsPath);

	for (const filePath of commandFiles) {
		try {
			delete require.cache[require.resolve(filePath)];
			const command = require(filePath);

			if (command.data && command.data.name === commandName) {
				client.commands.set(command.data.name, command);
				console.log(`[SUCCESS] Reloaded command: ${commandName}`);
				return true;
			}
		} catch (error) {
			console.log(`[ERROR] Error reloading command ${commandName}:`, error);
		}
	}

	return false;
}

module.exports = {
	loadCommands,
	reloadCommand,
	getCommandFiles,
};
