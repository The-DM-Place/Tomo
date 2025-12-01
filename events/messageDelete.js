const { Events, EmbedBuilder, AuditLogEvent } = require("discord.js");
const ConfigModel = require("../models/ConfigModel");
const logger = require("../utils/logger");

let cachedConfig = null;
let cachedChannel = null;
let lastSync = 0;
const TTL = 60 * 1000;

async function syncConfig(message) {
  const now = Date.now();
  if (!cachedConfig || now - lastSync > TTL) {
    cachedConfig = await ConfigModel.getConfig();
    lastSync = now;

    if (cachedConfig.messageLogsChannelId) {
      cachedChannel = message.guild.channels.cache.get(
        cachedConfig.messageLogsChannelId
      );
    } else {
      cachedChannel = null;
    }
  }
}

module.exports = {
  name: Events.MessageDelete,

  async execute(message) {
    try {
      if (!message || message.partial) return;

      if (message.author?.bot) return;

      await syncConfig(message);

      const config = cachedConfig;
      if (!config?.messageLoggingEnabled) return;

      const logsChannel = cachedChannel;
      if (!logsChannel) return;

      const blacklist = config._blacklistSet ||
        (config._blacklistSet = new Set(config.messageLogsBlacklist || []));

      if (blacklist.has(message.channel.id)) return;

      const embed = new EmbedBuilder()
        .setColor(0xff6b6b)
        .setAuthor({
          name: message.author.tag,
          iconURL: message.author.displayAvatarURL({ dynamic: true }),
        })
        .setDescription(`Message Deleted in ${message.channel}`)
        .setTimestamp()
        .setFooter({ text: `User ID: ${message.author.id}` });

      let deletedBy = null;

      if (message.guild) {
        try {
          const auditLogs = await message.guild.fetchAuditLogs({
            type: AuditLogEvent.MessageDelete,
            limit: 3,
          });

          const entry = auditLogs.entries.find(
            (log) =>
              log.target.id === message.author.id &&
              log.extra.channel.id === message.channel.id &&
              Date.now() - log.createdTimestamp < 5000
          );

          if (entry) deletedBy = entry.executor;
        } catch (_) {}
      }

      if (deletedBy && deletedBy.id !== message.author.id) {
        embed.setDescription(
          `Message Deleted in ${message.channel} by ${deletedBy.tag}`
        );
      }

      if (message.content) {
        const trimmed =
          message.content.length > 1024
            ? message.content.slice(0, 1021) + "..."
            : message.content;

        embed.addFields({
          name: "Content",
          value: trimmed || "*No content*",
        });
      }

      if (message.attachments.size > 0) {
        const names = message.attachments.map((a) => a.name).join(", ");

        embed.addFields({
          name: "Attachments",
          value: names,
        });
      }

      await logsChannel.send({ embeds: [embed] });

    } catch (error) {
      logger.error("messageDelete event error:", error);
    }
  },
};