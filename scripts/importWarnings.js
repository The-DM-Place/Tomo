const fs = require('fs');
const path = require('path');
require('dotenv').config();

require('../database/connection');
const WarningsModel = require('../models/WarningsModel');

function parseTimeString(timeStr) {
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

function findMatchingCaseId(warning, modLogs, toleranceMs = 3600000, debug = false) {
    const warningTime = parseTimeString(warning.time).getTime();
    
    const matchingWarns = modLogs.filter(log => 
        log.type === 'warn' && 
        log.userId === warning.user_id
    );

    if (matchingWarns.length === 0) {
        if (debug) {
            console.log(`No warn logs found for user ${warning.user_id} (${warning.username})`);
        }
        return null;
    }

    if (debug) {
        console.log(`Found ${matchingWarns.length} warn logs for ${warning.username}`);
    }

    let closestMatch = null;
    let smallestDiff = Infinity;

    for (const log of matchingWarns) {
        const logTime = new Date(log.timestamp).getTime();
        const diff = Math.abs(logTime - warningTime);
        
        if (debug) {
            console.log(`  Comparing: Warning time ${new Date(warningTime).toISOString()} vs Log time ${log.timestamp}`);
            console.log(`  Difference: ${(diff / 1000 / 60).toFixed(2)} minutes (case ${log.caseId})`);
        }
        
        if (diff < smallestDiff && diff <= toleranceMs) {
            smallestDiff = diff;
            closestMatch = log;
        }
    }

    if (debug && closestMatch) {
        console.log(`  ✓ Matched to case ${closestMatch.caseId} (${(smallestDiff / 1000 / 60).toFixed(2)} min diff)`);
    } else if (debug) {
        console.log(`  ✗ No match within tolerance (closest was ${(smallestDiff / 1000 / 60).toFixed(2)} min)`);
    }

    return closestMatch ? closestMatch.caseId : null;
}


function findMatchingCaseNumber(warning, modLogs, toleranceMs = 300000) {
    const warningTime = parseTimeString(warning.time).getTime();
    
    const matchingWarns = modLogs.filter(log => 
        log.action === 'Warn' && 
        log.user_id === warning.user_id
    );

    if (matchingWarns.length === 0) {
        return null;
    }

    let closestMatch = null;
    let smallestDiff = Infinity;

    for (const log of matchingWarns) {
        const logTime = parseTimeString(log.time).getTime();
        const diff = Math.abs(logTime - warningTime);
        
        const reasonsMatch = log.reason?.toLowerCase() === warning.reason?.toLowerCase();
        
        if (diff < smallestDiff && diff <= toleranceMs) {
            if (reasonsMatch || diff < smallestDiff) {
                smallestDiff = diff;
                closestMatch = log;
                
                if (diff < 60000 && reasonsMatch) {
                    break;
                }
            }
        }
    }

    return closestMatch ? closestMatch.case_number : null;
}

async function importWarnings(warningsFileName) {
    const warningsFile = path.join(__dirname, '../data', warningsFileName || 'dyno_warnings_20251129_163014.json');
    const modLogsFile = path.join(__dirname, '../data/moderationaction.json');
    const moderatorMapFile = path.join(__dirname, '../data/moderator_map.json');

    console.log('Reading warnings file...');
    const warnings = JSON.parse(fs.readFileSync(warningsFile, 'utf8'));
    console.log(`Found ${warnings.length} warnings\n`);

    console.log('Reading mod logs...');
    if (!fs.existsSync(modLogsFile)) {
        console.error(`Error: Mod logs not found at ${modLogsFile}`);
        process.exit(1);
    }
    const modLogs = JSON.parse(fs.readFileSync(modLogsFile, 'utf8'));
    console.log(`Found ${modLogs.length} mod log entries`);
    
    const totalWarnLogs = modLogs.filter(log => log.type === 'warn').length;
    console.log(`Found ${totalWarnLogs} warn entries in mod logs\n`);

    console.log('Loading moderator map...');
    let moderatorMap = {};
    if (fs.existsSync(moderatorMapFile)) {
        const rawMap = JSON.parse(fs.readFileSync(moderatorMapFile, 'utf8'));
        Object.entries(rawMap).forEach(([key, value]) => {
            if (value !== 'REPLACE_WITH_DISCORD_ID' && value !== '') {
                moderatorMap[key] = value;
            }
        });
        console.log(`Loaded ${Object.keys(moderatorMap).length} moderator mappings\n`);
    } else {
        console.warn('⚠ No moderator map found. Moderator IDs will be set to placeholder.\n');
    }

    const stats = {
        total: warnings.length,
        matched: 0,
        unmatched: 0,
        imported: 0,
        skipped: 0,
        errors: 0,
        unknownModerators: 0
    };

    console.log('Matching warnings with case numbers...');
    
    for (let i = 0; i < warnings.length; i++) {
        const warning = warnings[i];
        
        if (i % 1000 === 0) {
            console.log(`Processing ${i}/${warnings.length}...`);
        }

        try {
            let caseId = findMatchingCaseId(warning, modLogs, 3600000, false);
            
            if (!caseId) {
                stats.unmatched++;
                caseId = warning.warning_id;
                console.log(`No match for ${warning.username}, using warning_id: ${caseId}`);
            }

            stats.matched++;

            const existingWarning = await WarningsModel.getWarningByCaseId(caseId);
            if (existingWarning) {
                stats.skipped++;
                continue;
            }

            const moderatorId = moderatorMap[warning.moderator] || '000000000000000000';
            if (moderatorId === '000000000000000000') {
                stats.unknownModerators++;
            }

            const timestamp = parseTimeString(warning.time);

            const warningDoc = await WarningsModel.addWarning(
                warning.user_id,
                moderatorId,
                warning.reason,
                caseId
            );
            warningDoc.timestamp = timestamp;
            await warningDoc.save();

            stats.imported++;

        } catch (error) {
            console.error(`Error processing warning for ${warning.username}:`, error.message);
            stats.errors++;
        }
    }

    console.log('\n=== Import Statistics ===');
    console.log(`Total warnings processed: ${stats.total}`);
    console.log(`Matched with case IDs: ${stats.matched} (${((stats.matched/stats.total)*100).toFixed(1)}%)`);
    console.log(`Unmatched (no case found): ${stats.unmatched} (${((stats.unmatched/stats.total)*100).toFixed(1)}%)`);
    console.log(`Successfully imported: ${stats.imported}`);
    console.log(`Skipped (already exists): ${stats.skipped}`);
    console.log(`Errors: ${stats.errors}`);
    if (stats.unknownModerators > 0) {
        console.log(`⚠ Warnings with unknown moderator: ${stats.unknownModerators}`);
    }

    if (stats.unmatched > 0) {
        console.log(`\n⚠ ${stats.unmatched} warnings imported using warning_id (no matching case found in mod logs)`);
    }

    console.log('\n✓ Import complete!');
    
    console.log('\nVerifying import...');
    const sampleUserId = warnings[0].user_id;
    const userWarnings = await WarningsModel.getUserWarnings(sampleUserId);
    console.log(`Sample check: User ${warnings[0].username} has ${userWarnings.length} warning(s) in database`);

    process.exit(0);
}

if (require.main === module) {
    const warningsFileName = process.argv[2];
    
    importWarnings(warningsFileName).catch(error => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
}

module.exports = { importWarnings, findMatchingCaseId, parseTimeString };
