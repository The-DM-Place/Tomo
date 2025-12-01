const { EmbedBuilder } = require("discord.js");
const ConfigModel = require("../models/ConfigModel");
const logger = require("./logger");

const ACTION_EMOJIS = {
  ban: "🔨",
  tempban: "⏰",
  unban: "🕊️",
  kick: "👢",
  mute: "🔇",
  unmute: "🔊",
  warn: "⚠️",
  timeout: "⏱️",
  untimeout: "✨",
  purge: "🧹",
  lock: "🔒",
  unlock: "🔓",
  slowmode: "🐌",
  note: "📝"
};

const ACTION_TITLES = {
  ban: "User Banned",
  tempban: "User Temporarily Banned",
  unban: "User Unbanned",
  kick: "User Kicked",
  mute: "User Muted",
  unmute: "User Unmuted",
  warn: "User Warned",
  timeout: "User Timed Out",
  untimeout: "User Timeout Removed",
  purge: "Messages Purged",
  lock: "Channel Locked",
  unlock: "Channel Unlocked",
  slowmode: "Slowmode Updated",
  note: "Moderation Note Added"
};

const getEmoji = (type) => ACTION_EMOJIS[type] || "🛡️";
const getTitle = (type) => ACTION_TITLES[type] || "Moderation Action";

let cachedConfig = null;
let cachedLogsChannel = null;
let lastConfigSync = 0;
const CONFIG_TTL = 60 * 1000;

async function syncConfig(client) {
  const now = Date.now();
  if (cachedConfig && now - lastConfigSync < CONFIG_TTL) return;

  cachedConfig = await ConfigModel.getConfig();
  lastConfigSync = now;

  const id = cachedConfig.logsChannelId;
  if (id) {
    cachedLogsChannel = await client.channels.fetch(id).catch(() => null);
  } else {
    cachedLogsChannel = null;
  }
}

class ModerationLogger {
  async logAction(client, action) {
    try {
      await syncConfig(client);

      if (!cachedConfig.loggingEnabled) {
        logger.info("Moderation logging disabled – skipping.");
        return false;
      }

      if (!cachedLogsChannel) {
        logger.info("Logs channel not configured or unavailable.");
        return false;
      }

      const emoji = getEmoji(action.type);
      const title = getTitle(action.type);

      const embed = new EmbedBuilder()
        .setColor(0xffb6c1)
        .setDescription(
          `${emoji} **${title}** | ${action.target} by ${action.moderator}\n` +
          `📝 **Reason:** ${action.reason || "No reason provided"}` +
          (action.duration ? `\n⏰ **Duration:** ${action.duration}` : "")
        )
        .setFooter({
          text: action.caseId ? `Case ${action.caseId}` : "No case ID",
        })
        .setTimestamp();

      await cachedLogsChannel.send({ embeds: [embed] });

      logger.info(
        `Logged ${action.type} by ${action.moderator.tag} on ${action.target.tag}`
      );

      return true;
    } catch (error) {
      logger.error("Moderation logging failed:", error);
      return false;
    }
  }

  logBan(client, moderator, target, reason, duration = null) {
    return this.logAction(client, {
      type: duration ? "tempban" : "ban",
      moderator,
      target,
      reason,
      duration,
    });
  }

  logKick(client, moderator, target, reason) {
    return this.logAction(client, {
      type: "kick",
      moderator,
      target,
      reason,
    });
  }

  logMute(client, moderator, target, reason, duration = null) {
    return this.logAction(client, {
      type: "mute",
      moderator,
      target,
      reason,
      duration,
    });
  }

  logWarn(client, moderator, target, reason) {
    return this.logAction(client, {
      type: "warn",
      moderator,
      target,
      reason,
    });
  }

  logTimeout(client, moderator, target, reason, duration) {
    return this.logAction(client, {
      type: "timeout",
      moderator,
      target,
      reason,
      duration,
    });
  }

  async logPurge(client, moderator, reason, count, channel) {
    return this.logAction(client, {
      type: "purge",
      moderator,
      target: { tag: `#${channel.name}`, id: channel.id },
      reason,
      additionalInfo: {
        "📊 Messages Deleted": `${count}`,
        "📍 Channel": `<#${channel.id}>`,
      },
    });
  }

  async logReasonUpdate(client, { caseId, moderator, target, oldReason, newReason, actionType }) {
    try {
      await syncConfig(client);

      if (!cachedLogsChannel) return false;

      const embed = new EmbedBuilder()
        .setColor(0xffb6c1)
        .setDescription(
          `📝 **Case Reason Updated** | Case ${caseId}\n` +
          `👤 **Target:** ${target.tag}\n` +
          `🔨 **Updated by:** ${moderator.tag}\n` +
          `⚡ **Action Type:** ${actionType}`
        )
        .addFields(
          { name: "📝 Old Reason", value: `\`${oldReason}\`` },
          { name: "✨ New Reason", value: `\`${newReason}\`` }
        )
        .setFooter({ text: `Case ${caseId} • Reason Updated` })
        .setTimestamp();

      await cachedLogsChannel.send({ embeds: [embed] });

      logger.info(`Logged reason update for case ${caseId}`);
      return true;
    } catch (err) {
      logger.error("Failed to log reason update:", err);
      return false;
    }
  }

  async isLoggingEnabled(client) {
    await syncConfig(client);
    return !!cachedLogsChannel;
  }
}

module.exports = new ModerationLogger();
