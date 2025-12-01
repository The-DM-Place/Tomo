const ConfigModel = require("../models/ConfigModel");
const logger = require("./logger");
const { EmbedBuilder } = require("discord.js");

let PERMISSION_MAP = null;
let lastConfigSync = 0;
const CONFIG_SYNC_TTL = 60 * 1000;

function compilePermissionMap(config) {
  const map = {};

  for (const [commandName, cmd] of Object.entries(config.commands || {})) {
    map[commandName] = {
      enabled: cmd.enabled !== false,
      isPublic: cmd.isPublic === true,
      whitelisted: new Set(cmd.whitelist || []),
      blacklisted: new Set(cmd.blacklist || []),
      staffRoles: new Set(config.staffRoles || [])
    };
  }

  PERMISSION_MAP = map;
  lastConfigSync = Date.now();

  logger.info("[PERMISSIONS] Permission map compiled.");
}

async function ensurePermissionMap() {
  if (!PERMISSION_MAP || Date.now() - lastConfigSync > CONFIG_SYNC_TTL) {
    const config = await ConfigModel.getConfig();
    compilePermissionMap(config);
  }
}

function evaluatePermissionCached(commandName, userRoles, isOwner) {
  const cmd = PERMISSION_MAP[commandName];

  if (!cmd) {
    return { allowed: false, reason: "Command not registered" };
  }

  if (isOwner) {
    return { allowed: true, reason: "Owner bypass" };
  }

  if (!cmd.enabled) {
    return { allowed: false, reason: "Command disabled" };
  }

  if (cmd.isPublic) {
    return { allowed: true, reason: "Public command" };
  }

  for (const r of userRoles) {
    if (cmd.blacklisted.has(r)) {
      return { allowed: false, reason: "Role is blacklisted" };
    }
  }

  for (const r of userRoles) {
    if (cmd.whitelisted.has(r)) {
      return { allowed: true, reason: "Whitelisted role" };
    }
  }

  for (const r of userRoles) {
    if (cmd.staffRoles.has(r)) {
      return { allowed: true, reason: "Staff role" };
    }
  }

  return { allowed: false, reason: "No permission" };
}

class PermissionChecker {
  getUserContext(interaction) {
    return {
      userRoles: interaction.member?.roles?.cache
        ? Array.from(interaction.member.roles.cache.keys())
        : [],
      isOwner: interaction.guild?.ownerId === interaction.user.id
    };
  }

  async checkCommandPermission(interaction, commandName) {
    try {
      await ensurePermissionMap();

      const { userRoles, isOwner } = this.getUserContext(interaction);
      const result = evaluatePermissionCached(
        commandName,
        userRoles,
        isOwner
      );

      logger.info(
        `[PERMISSION] User ${interaction.user.tag} -> ${commandName}: ${result.allowed ? "ALLOWED" : "DENIED"} (${result.reason})`
      );

      return result;
    } catch (err) {
      logger.error("Permission error:", err);
      return { allowed: false, reason: "Internal error" };
    }
  }

  async requirePermission(interaction, commandName) {
    const permission = await this.checkCommandPermission(
      interaction,
      commandName
    );

    if (permission.allowed) return true;

    const embed = new EmbedBuilder()
      .setColor(0xffb6c1)
      .setTitle("🌸 Oops! Access Denied")
      .setDescription(
        `Sorry ${interaction.user}, you can't use this command right now~`
      )
      .addFields({
        name: "💭 Reason",
        value: `\`${permission.reason}\``
      })
      .setFooter({
        text: "Contact staff if you think this is a mistake! 💌",
        iconURL: interaction.client.user.displayAvatarURL()
      })
      .setTimestamp();

    if (permission.reason.includes("disabled")) {
      embed.setTitle("🚫 Command Disabled").setDescription(
        "This command is currently disabled.\nAsk an admin to enable it! 🌙"
      );
    } else if (permission.reason.includes("blacklisted")) {
      embed
        .setTitle("⛔ Access Restricted")
        .setDescription(
          "You're restricted from using this command.\nContact staff for assistance! 💔"
        );
    } else if (permission.reason.includes("staff")) {
      embed
        .setTitle("🛡️ Staff Only")
        .setDescription(
          "This command is for staff members only.\nBecome part of the team! ✨"
        );
    }

    await interaction.reply({ embeds: [embed], ephemeral: true });
    return false;
  }

  async hasPermission(interaction, commandName) {
    return (await this.checkCommandPermission(interaction, commandName))
      .allowed;
  }

  async getPermissionDetails(interaction, commandName) {
    await ensurePermissionMap();

    const { userRoles, isOwner } = this.getUserContext(interaction);

    return {
      commandName,
      user: interaction.user.tag,
      userRoles,
      isOwner,
      compiledRules: PERMISSION_MAP[commandName] || null,
      result: evaluatePermissionCached(commandName, userRoles, isOwner)
    };
  }
}

module.exports = new PermissionChecker();
