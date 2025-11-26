const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

/**
 * Converts Dyno moderation logs to the format used by ModerationActionModel
 * 
 * Dyno format:
 * {
 *   "time": "Tue, Nov 18, 2025 3:13 PM",
 *   "case_number": "44858",
 *   "action": "Ban",
 *   "user_id": "1411301431847419906",
 *   "username": "@marina068306",
 *   "moderator": "@zayyyy3",
 *   "reason": "Bot / NSFW"
 * }
 * 
 * Target format:
 * {
 *   "type": "ban",
 *   "userId": "1411301431847419906",
 *   "moderatorId": "unknown",
 *   "reason": "Bot / NSFW",
 *   "duration": null,
 *   "caseId": "44858",
 *   "timestamp": "2025-11-18T15:13:00.000Z",
 *   "createdAt": "2025-11-18T15:13:00.000Z",
 *   "updatedAt": "2025-11-18T15:13:00.000Z",
 *   "id": "uuid"
 * }
 */

const moderatorMap = {
};

function parseTimeString(timeStr) {
    // Parse "Tue, Nov 18, 2025 3:13 PM" format
    try {
        const date = new Date(timeStr);
        if (isNaN(date.getTime())) {
            console.warn(`Failed to parse date: ${timeStr}`);
            return new Date();
        }
        return date;
    } catch (error) {
        console.error(`Error parsing date "${timeStr}":`, error.message);
        return new Date();
    }
}

function normalizeAction(action) {
    const actionMap = {
        'Ban': 'ban',
        'ban': 'ban',
        'Mute': 'mute',
        'mute': 'mute',
        'Kick': 'kick',
        'kick': 'kick',
        'Warn': 'warn',
        'warn': 'warn',
        'Warning': 'warn',
        'Unban': 'unban',
        'unban': 'unban',
        'Unmute': 'unmute',
        'unmute': 'unmute',
        'Role Persist': 'role persist',
        'role persist': 'role persist'
    };

    return actionMap[action] || action.toLowerCase();
}

function convertDynoLog(dynoEntry, moderatorMap) {
    const timestamp = parseTimeString(dynoEntry.time);
    const type = normalizeAction(dynoEntry.action);

    // Try to get moderator ID from map, otherwise use a placeholder
    const moderatorId = moderatorMap[dynoEntry.moderator] || '000000000000000000';

    return {
        type: type,
        userId: dynoEntry.user_id,
        moderatorId: moderatorId,
        reason: dynoEntry.reason || 'No reason provided',
        duration: null, // Dyno logs don't seem to include duration
        caseId: dynoEntry.case_number,
        timestamp: timestamp.toISOString(),
        createdAt: timestamp.toISOString(),
        updatedAt: timestamp.toISOString(),
        id: uuidv4()
    };
}

async function convertLogs(inputFileName) {
    const fileName = inputFileName || 'dyno_logs_20251119_151409.json';
    const inputFile = path.join(__dirname, '../data', fileName);
    const outputFileName = fileName.replace('.json', '_converted.json');
    const outputFile = path.join(__dirname, '../data', outputFileName);
    const moderatorMapFile = path.join(__dirname, '../data/moderator_map.json');

    console.log(`Reading Dyno logs from: ${fileName}...`);
    const dynoLogs = JSON.parse(fs.readFileSync(inputFile, 'utf8'));

    console.log(`Found ${dynoLogs.length} log entries`);

    let moderatorMap = {};
    if (fs.existsSync(moderatorMapFile)) {
        const rawMap = JSON.parse(fs.readFileSync(moderatorMapFile, 'utf8'));
        Object.entries(rawMap).forEach(([key, value]) => {
            if (value !== 'REPLACE_WITH_DISCORD_ID' && value !== '') {
                moderatorMap[key] = value;
            }
        });
        console.log(`Loaded ${Object.keys(moderatorMap).length} moderator mappings`);
    } else {
        console.log('No moderator map found. Creating template...');
        const uniqueModerators = [...new Set(dynoLogs.map(log => log.moderator))];
        const template = {};
        uniqueModerators.forEach(mod => {
            template[mod] = 'REPLACE_WITH_DISCORD_ID';
        });
        fs.writeFileSync(moderatorMapFile, JSON.stringify(template, null, 2));
        console.log(`Created moderator map template at: ${moderatorMapFile}`);
        console.log('Please fill in the Discord IDs and run the script again.');
        return;
    }

    console.log('Converting logs...');
    const convertedLogs = dynoLogs.map(log => convertDynoLog(log, moderatorMap));

    fs.writeFileSync(outputFile, JSON.stringify(convertedLogs, null, 2));
    console.log(`✓ Converted logs saved to: ${outputFile}`);

    const stats = {
        total: convertedLogs.length,
        byType: {},
        unknownModerators: 0,
        uniqueModerators: new Set(),
        caseIdRange: {
            min: Math.min(...convertedLogs.map(l => parseInt(l.caseId))),
            max: Math.max(...convertedLogs.map(l => parseInt(l.caseId)))
        }
    };

    convertedLogs.forEach(log => {
        stats.byType[log.type] = (stats.byType[log.type] || 0) + 1;
        stats.uniqueModerators.add(log.moderatorId);
        if (log.moderatorId === 'unknown') {
            stats.unknownModerators++;
        }
    });

    stats.uniqueModerators = stats.uniqueModerators.size;

    console.log('\n=== Conversion Statistics ===');
    console.log(`Total entries: ${stats.total}`);
    console.log(`Case ID range: ${stats.caseIdRange.min} - ${stats.caseIdRange.max}`);
    console.log(`\nBy action type:`);
    Object.entries(stats.byType).forEach(([type, count]) => {
        console.log(`  ${type}: ${count}`);
    });
    console.log(`\nUnique moderators: ${stats.uniqueModerators}`);
    if (stats.unknownModerators > 0) {
        console.log(`⚠ Entries with unknown moderator: ${stats.unknownModerators}`);
    }

    console.log('\n✓ Conversion complete!');
}

if (require.main === module) {
    const inputFileName = process.argv[2];
    convertLogs(inputFileName).catch(console.error);
}

module.exports = { convertDynoLog, parseTimeString, normalizeAction };
