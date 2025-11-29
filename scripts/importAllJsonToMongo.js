const mongoose = require('mongoose');
require('dotenv').config();
const fs = require('fs');
const path = require('path');

const Config = require('../models/ConfigModel');
const ModerationAction = require('../models/ModerationActionModel');
const User = require('../models/UserModel');
const Warnings = require('../models/WarningsModel');

mongoose.connect(process.env.DB_URI);

async function importAll() {
  try {
    const configPath = path.join(__dirname, '../data/config.json');
    const configData = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    if (Array.isArray(configData)) {
      for (const config of configData) {
        await Config.updateOne(
          { configType: config.configType || 'global' },
          { $set: config },
          { upsert: true }
        );
      }
    } else {
      await Config.updateOne(
        { configType: configData.configType || 'global' },
        { $set: configData },
        { upsert: true }
      );
    }
    console.log('Config data imported!');
  } catch (err) {
    console.error('Error importing config.json:', err.message);
  }

  // Import moderationaction.json (bulkWrite for speed)
  try {
    const modActionPath = path.join(__dirname, '../data/moderationaction.json');
    const modActions = JSON.parse(fs.readFileSync(modActionPath, 'utf8'));
    const bulkOps = modActions.map(action => ({
      updateOne: {
        filter: { caseId: action.caseId },
        update: { $set: action },
        upsert: true
      }
    }));
    if (bulkOps.length > 0) {
      await ModerationAction.bulkWrite(bulkOps);
    }
    console.log('Moderation actions imported!');
  } catch (err) {
    console.error('Error importing moderationaction.json:', err.message);
  }

  try {
    const userPath = path.join(__dirname, '../data/user.json');
    const users = JSON.parse(fs.readFileSync(userPath, 'utf8'));
    const bulkOps = users.map(user => ({
      updateOne: {
        filter: { userId: user.userId },
        update: { $set: user },
        upsert: true
      }
    }));
    if (bulkOps.length > 0) {
      await User.bulkWrite(bulkOps);
    }
    console.log('User data imported!');
  } catch (err) {
    console.error('Error importing user.json:', err.message);
  }

  try {
    const warningsPath = path.join(__dirname, '../data/warnings.json');
    const warnings = JSON.parse(fs.readFileSync(warningsPath, 'utf8'));
    const bulkOps = warnings.map(warning => ({
      updateOne: {
        filter: { caseId: warning.caseId },
        update: { $set: warning },
        upsert: true
      }
    }));
    if (bulkOps.length > 0) {
      await Warnings.bulkWrite(bulkOps);
    }
    console.log('Warnings data imported!');
  } catch (err) {
    console.error('Error importing warnings.json:', err.message);
  }

  mongoose.disconnect();
}

importAll();
