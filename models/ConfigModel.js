let configCache = null;
let lastLoaded = 0;
const CACHE_TTL = 60 * 1000;

function setCache(data) {
  configCache = data;
  lastLoaded = Date.now();
}

function getCache() {
  if (!configCache) return null;
  if (Date.now() - lastLoaded > CACHE_TTL) {
    configCache = null;
    return null;
  }
  return configCache;
}

const { Schema, model } = require('mongoose');
const logger = require('../utils/logger');
const { config } = require('dotenv');

const configSchema = new Schema({
  configType: {
    type: String,
    required: true,
    default: "global",
    unique: true
  },

  staffRoles: { type: [String], default: [] },
  commands: { type: Object, default: {} },

  logsChannelId: { type: String, default: null },
  messageLogsChannelId: { type: String, default: null },
  appealsChannelId: { type: String, default: null },
  appealInvite: { type: String, default: null },

  messageLoggingEnabled: { type: Boolean, default: false },
  messageLogsBlacklist: { type: [String], default: [] },

  loggingEnabled: { type: Boolean, default: true },
  appealsEnabled: { type: Boolean, default: true },

  automodEnabled: { type: Boolean, default: true },
  automodRules: { type: Array, default: [] },

  banEmbed: {
    type: Object,
    default: () => ({
      title: '🔨 You have been banned',
      description: 'You have been banned from **{server}**',
      color: 0xFFB6C1,
      footer: 'Contact staff if you believe this is a mistake'
    })
  }

}, { timestamps: true });

configSchema.index({ configType: 1 }, { unique: true });

const DEFAULT_CONFIG = {
  configType: "global",

  staffRoles: [],
  commands: {},

  logsChannelId: null,
  messageLogsChannelId: null,
  appealsChannelId: null,
  appealInvite: null,

  messageLoggingEnabled: false,
  messageLogsBlacklist: [],

  loggingEnabled: true,
  appealsEnabled: true,

  automodEnabled: true,
  automodRules: [],

  banEmbed: {
    title: '🔨 You have been banned',
    description: 'You have been banned from **{server}**',
    color: 0xFFB6C1,
    footer: 'Contact staff if you believe this is a mistake'
  }
};

function applyDefaults(config) {
  return Object.assign({}, DEFAULT_CONFIG, config);
}

configSchema.statics.getConfig = async function () {
  const cached = getCache();
  if (cached) return cached;

  let config = await this.findOne({ configType: "global" }).lean();

  if (!config) {
    config = await this.create(DEFAULT_CONFIG);
    config = config.toObject();
  }

  const merged = applyDefaults(config);
  setCache(merged);

  return merged;
};

configSchema.statics.updateConfig = async function (update) {
  const updated = await this.findOneAndUpdate(
    { configType: "global" },
    update,
    { new: true, upsert: true }
  ).lean();

  const merged = applyDefaults(updated);
  setCache(merged);

  return merged;
};

configSchema.statics.getAppealInvite = async function () {
  return (await this.getConfig()).appealInvite;
};

configSchema.statics.setAppealInvite = async function (invite) {
  return this.updateConfig({ $set: { appealInvite: invite } });
};

configSchema.statics.isAppealsEnabled = async function () {
  return (await this.getConfig()).appealsEnabled !== false;
};

configSchema.statics.setAppealsEnabled = async function (enabled) {
  return this.updateConfig({ $set: { appealsEnabled: enabled } });
};

configSchema.statics.isLoggingEnabled = async function () {
  return (await this.getConfig()).loggingEnabled !== false;
};

configSchema.statics.setLoggingEnabled = async function (enabled) {
  return this.updateConfig({ $set: { loggingEnabled: enabled } });
};

configSchema.statics.registerCommand = async function (commandName, isPublic = false, enabled = true) {
  const config = await this.getConfig();

  const commands = { ...config.commands };

  if (!commands[commandName]) {
    commands[commandName] = {
      enabled,
      isPublic,
      whitelist: [],
      blacklist: []
    };
  }

  return this.updateConfig({ $set: { commands } });
};

configSchema.statics.discoverAndRegisterCommands = async function (client, forceRefresh = false) {
  try {
    const config = await this.getConfig();

    const existingCommands = config.commands || {};
    const updatedCommands = {};

    let changes = 0;

    for (const [commandName, commandModule] of client.commands) {
      const isPublic = commandModule.isPublic === true;

      if (existingCommands[commandName]) {
        const existing = existingCommands[commandName];

        const updated = {
          enabled: existing.enabled !== false,
          isPublic,
          whitelist: existing.whitelist || [],
          blacklist: existing.blacklist || []
        };

        if (
          existing.isPublic !== isPublic ||
          existing.enabled !== updated.enabled
        ) {
          changes++;
        }

        updatedCommands[commandName] = updated;
      }

      else {
        updatedCommands[commandName] = {
          enabled: true,
          isPublic,
          whitelist: [],
          blacklist: []
        };
        changes++;
      }
    }

    for (const oldName of Object.keys(existingCommands)) {
      if (!client.commands.has(oldName)) {
        changes++;
      }
    }

    if (changes === 0 && !forceRefresh) {
      return {
        changed: false,
        message: "No command configuration changes detected."
      };
    }

    const newConfig = await this.updateConfig({ $set: { commands: updatedCommands } });

    return {
      changed: true,
      config: newConfig,
      message: `${Object.keys(updatedCommands).length} commands synced (${changes} changes).`
    };

  } catch (err) {
    logger.error("Error in discoverAndRegisterCommands:", err);
    return {
      changed: false,
      error: err
    };
  }
};

configSchema.statics.setCommandEnabled = async function (commandName, enabled) {
  const config = await this.getConfig();
  const commands = { ...config.commands };

  if (!commands[commandName]) {
    commands[commandName] = { enabled, whitelist: [], blacklist: [] };
  } else {
    commands[commandName].enabled = enabled;
  }

  return this.updateConfig({ $set: { commands } });
};

configSchema.statics.setCommandPublic = async function (commandName, isPublic) {
  const config = await this.getConfig();
  const commands = { ...config.commands };
  if (!commands[commandName]) {
    commands[commandName] = { enabled: true, isPublic, whitelist: [], blacklist: [] };
  } else {
    commands[commandName].isPublic = isPublic;
  }
  return this.updateConfig({ $set: { commands } });;
};

configSchema.statics.getCommandWhitelist = async function (commandName) {
  const config = await this.getConfig();
  const command = config.commands[commandName];
  return command ? command.whitelist || [] : [];
};

configSchema.statics.getCommandBlacklist = async function (commandName) {
  const config = await this.getConfig();
  const command = config.commands[commandName];
  return command ? command.blacklist || [] : [];
};

configSchema.statics.setCommandWhitelist = async function (commandName, roleIds, guildId = null) {
  if (!Array.isArray(roleIds)) {
    roleIds = typeof roleIds === 'string' && roleIds.length > 0 ? [roleIds] : [];
  }
  const config = await this.getConfig(guildId);
  if (!config.commands) config.commands = {};
  if (!config.commands[commandName]) {
    config.commands[commandName] = {
      enabled: true,
      whitelist: roleIds,
      blacklist: []
    };
  } else {
    const currentWhitelist = new Set(config.commands[commandName].whitelist || []);
    roleIds.forEach(roleId => currentWhitelist.add(roleId));
    config.commands[commandName].whitelist = Array.from(currentWhitelist);
  }
  return await this.setConfig(config);
};

configSchema.statics.setCommandBlacklist = async function (commandName, roleIds) {
  const config = await this.getConfig();
  const commands = { ...config.commands };
  if (!commands[commandName]) {
    commands[commandName] = { enabled: true, whitelist: [], blacklist: roleIds };
  } else {
    commands[commandName].blacklist = roleIds;
  }
  return this.updateConfig({ $set: { commands } });
};

configSchema.statics.removeCommandWhitelistRole = async function (commandName, roleId) {
  const config = await this.getConfig();
  const commands = { ...config.commands };
  if (commands[commandName]) {
    if (!Array.isArray(commands[commandName].whitelist)) {
      commands[commandName].whitelist = typeof commands[commandName].whitelist === 'string' && commands[commandName].whitelist.length > 0
        ? [commands[commandName].whitelist]
        : [];
    }
    commands[commandName].whitelist = commands[commandName].whitelist.filter(id => id !== roleId);
  }
  return this.updateConfig({ $set: { commands } });
};

configSchema.removeCommandBlacklistRole = async function (commandName, roleId) {
  const config = await this.getConfig();
  const commands = { ...config.commands };
  if (commands[commandName]) {
    commands[commandName].blacklist = commands[commandName].blacklist.filter(id => id !== roleId);
  }
  return this.updateConfig({ $set: { commands } });
};

configSchema.checkCommandPermission = async function (commandName, roleId) {
  const config = await this.getConfig();
  const cmd = config.commands?.[commandName];
  if (!cmd) return false;
};

configSchema.statics.canRoleUseCommand = function (config, roleId, command) {
  const cmd = config.commands?.[command];
  if (!cmd) return false;

  if (cmd.blacklist?.includes(roleId)) return false;
  if (cmd.whitelist?.includes(roleId)) return true;

  return config.staffRoles?.includes(roleId) ?? false;
};

configSchema.statics.getBanEmbedTemplate = async function () {
  return (await this.getConfig()).banEmbed;
};

configSchema.statics.setBanEmbedTemplate = async function (data) {
  const base = (await this.getConfig()).banEmbed;
  return this.updateConfig({
    $set: {
      banEmbed: {
        title: data.title ?? base.title,
        description: data.description ?? base.description,
        color: data.color ?? base.color,
        footer: data.footer ?? base.footer
      }
    }
  });
};

configSchema.statics.getAutomodActionForWarnings = async function (warnCount) {
  const config = await this.getConfig();

  if (!config.automodEnabled) return null;
  if (!Array.isArray(config.automodRules)) return null;

  let matched = null;

  for (const rule of config.automodRules) {
    if (warnCount >= rule.count) {
      matched = rule;
    }
  }

  return matched;
};

configSchema.statics.setStaffRole = async function (roleIds) {
  const config = await this.getConfig();
  let currentRoles = Array.isArray(config.staffRoles) ? config.staffRoles : [];
  if (!Array.isArray(roleIds)) {
    roleIds = typeof roleIds === 'string' && roleIds.length > 0 ? [roleIds] : [];
  }
  const updatedRoles = Array.from(new Set([...currentRoles, ...roleIds]));
  return this.updateConfig({ $set: { staffRoles: updatedRoles } });
};

configSchema.statics.getStaffRoles = async function () {
  const config = await this.getConfig();
  return config.staffRoles || [];
};

configSchema.statics.removeStaffRole = async function (roleId) {
  const config = await this.getConfig();
  const staffRoles = (config.staffRoles || []).filter(r => r !== roleId);
  return this.updateConfig({ $set: { staffRoles } });
};

configSchema.statics.getAutomodRules = async function () {
  return (await this.getConfig()).automodRules || [];
};

configSchema.statics.isAutomodEnabled = async function () {
  return (await this.getConfig()).automodEnabled !== false;
};

configSchema.statics.setAutomodEnabled = async function (enabled) {
  return this.updateConfig({ $set: { automodEnabled: enabled } });
};

configSchema.statics.removeAutomodRule = async function (threshold) {
  const config = await this.getConfig();
  const updatedRules = (config.automodRules || []).filter(rule => rule.threshold !== threshold);
  return this.updateConfig({ $set: { automodRules: updatedRules } });
};

configSchema.statics.setLogsChannel = async function (channelId) {
  return this.updateConfig({ $set: { logsChannelId: channelId } });
};

configSchema.statics.setConfig = async function (config) {
  return this.updateConfig({ $set: config });
};


configSchema.statics.getAppealsChannel = async function () {
  return (await this.getConfig()).appealsChannelId;
};

configSchema.statics.addAutomodRule = async function (threshold, action, duration) {
  const config = await this.getConfig();
  const rules = config.automodRules || [];
  const filtered = rules.filter(rule => rule.threshold !== threshold);
  filtered.push({ threshold, action, duration });
  return this.updateConfig({ $set: { automodRules: filtered } });
};

configSchema.statics.addCommandBlacklistRole = async function (commandName, roleId) {
  const config = await this.getConfig();
  if (!config.commands) config.commands = {};
  if (!config.commands[commandName]) {
    config.commands[commandName] = {
      enabled: true,
      whitelist: [],
      blacklist: [roleId]
    };
  } else {
    if (!Array.isArray(config.commands[commandName].blacklist)) {
      config.commands[commandName].blacklist = typeof config.commands[commandName].blacklist === 'string' && config.commands[commandName].blacklist.length > 0
        ? [config.commands[commandName].blacklist]
        : [];
    }
    if (!config.commands[commandName].blacklist.includes(roleId)) {
      config.commands[commandName].blacklist.push(roleId);
    }
  }
  return this.setConfig(config);
};

configSchema.statics.removeCommandBlacklistRole = async function (commandName, roleId) {
  const config = await this.getConfig();
  const commands = { ...config.commands };
  if (commands[commandName]) {
    if (!Array.isArray(commands[commandName].blacklist)) {
      commands[commandName].blacklist = typeof commands[commandName].blacklist === 'string' && commands[commandName].blacklist.length > 0
        ? [commands[commandName].blacklist]
        : [];
    }
    commands[commandName].blacklist = commands[commandName].blacklist.filter(id => id !== roleId);
  }
  return this.updateConfig({ $set: { commands } });
};

module.exports = model("Config", configSchema);
