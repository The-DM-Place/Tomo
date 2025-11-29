const fs = require('fs').promises;
const path = require('path');
const logger = require('../utils/logger');

async function getAllJsFiles(dir) {
    const dirents = await fs.readdir(dir, { withFileTypes: true });
    const files = await Promise.all(
        dirents.map((dirent) => {
            const res = path.resolve(dir, dirent.name);
            if (dirent.isDirectory()) {
                return getAllJsFiles(res);
            } else if (dirent.isFile() && res.endsWith('.js')) {
                return res;
            }
            return [];
        })
    );
    return Array.prototype.concat(...files);
}

async function loadSelectMenus(client) {
    const selectMenusPath = path.join(__dirname, '..', 'interactions', 'menus');

    console.log(`[INFO] Loading select menus from: ${selectMenusPath}`);

    try {
        await fs.access(selectMenusPath);

        const jsFiles = await getAllJsFiles(selectMenusPath);

        console.log(`[INFO] Found ${jsFiles.length} select menu handler files`);

        for (const filePath of jsFiles) {
            const file = path.basename(filePath);

            try {
                delete require.cache[require.resolve(filePath)];

                const selectMenu = require(filePath);

                if (!selectMenu.customId || !selectMenu.execute) {
                    console.log(
                        `[WARN] Select menu file ${file} is missing required properties (customId or execute)`
                    );
                    continue;
                }

                client.selectMenus.set(selectMenu.customId, selectMenu);

                console.log(
                    `[SUCCESS] Loaded select menu: ${selectMenu.customId} (${file})`
                );
            } catch (error) {
                console.log(`[ERROR] Error loading select menu from ${file}:`, error);
            }
        }

        console.log(`[INFO] Total select menus loaded: ${client.selectMenus.size}`);
        console.log(`[INFO] Loaded select menu IDs: ${Array.from(client.selectMenus.keys()).join(', ')}`);
    } catch (error) {
        if (error.code === 'ENOENT') {
            console.log('[WARN] Select menus directory not found, creating it...');
            await fs.mkdir(selectMenusPath, { recursive: true });
        } else {
            console.log('[ERROR] Error loading select menus:', error);
        }
    }
}

async function handleSelectMenuInteraction(interaction) {
    console.log(`[INFO] Handling select menu interaction: ${interaction.customId}`);
    console.log(`[INFO] Available select menus: ${Array.from(interaction.client.selectMenus.keys()).join(', ')}`);
    
    let selectMenu = interaction.client.selectMenus.get(interaction.customId);
    console.log(`[INFO] Exact match result: ${selectMenu ? 'Found' : 'Not found'}`);
    if (!selectMenu) {
        console.log('[INFO] Trying regex patterns...');
        for (const [key, selectMenuHandler] of interaction.client.selectMenus) {
            console.log(`[INFO] Checking pattern: ${key} (${selectMenuHandler.customId})`);
            if (
                selectMenuHandler.customId instanceof RegExp &&
                selectMenuHandler.customId.test(interaction.customId)
            ) {
                selectMenu = selectMenuHandler;
                console.log(`[INFO] Regex match found: ${key}`);
                break;
            }
        }
    }

    if (!selectMenu) {
        console.log(
            `[WARN] No select menu handler found for customId: ${interaction.customId}. Available handlers: ${Array.from(interaction.client.selectMenus.keys()).join(', ')}`
        );
        
        try {
            await interaction.reply({
                content: 'This selection menu is not currently available. Please try again later.',
                ephemeral: true,
            });
        } catch (error) {
            console.log('[ERROR] Failed to send select menu not found message:', error);
        }
        return;
    }

    console.log(`[INFO] Executing select menu: ${interaction.customId}`);
    try {
        await selectMenu.execute(interaction);
        console.log(
            `[INFO] Select menu executed: ${interaction.customId} by ${interaction.user.tag}`
        );
    } catch (error) {
        console.log(
            `[ERROR] Error executing select menu ${interaction.customId}:`,
            error
        );

        const errorMessage =
            'There was an error while processing this selection! Please try again.';

        try {
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({
                    content: errorMessage,
                    ephemeral: true,
                });
            } else {
                await interaction.reply({ content: errorMessage, ephemeral: true });
            }
        } catch (followUpError) {
            console.log('[ERROR] Failed to send error message to user:', followUpError);
        }
    }
}

async function reloadSelectMenu(client, customId) {
    const selectMenusPath = path.join(__dirname, '..', 'interactions', 'menus');

    try {
        const jsFiles = await getAllJsFiles(selectMenusPath);

        for (const filePath of jsFiles) {
            try {
                delete require.cache[require.resolve(filePath)];
                const selectMenu = require(filePath);

                if (selectMenu.customId === customId) {
                    client.selectMenus.set(selectMenu.customId, selectMenu);
                    console.log(`[INFO] Reloaded select menu: ${customId}`);
                    return true;
                }
            } catch (error) {
                console.log(`[ERROR] Error reloading select menu ${customId}:`, error);
            }
        }

        return false;
    } catch (error) {
        console.log(`[ERROR] Error reloading select menu ${customId}:`, error);
        return false;
    }
}

module.exports = {
    loadSelectMenus,
    handleSelectMenuInteraction,
    reloadSelectMenu,
};