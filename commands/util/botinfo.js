const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const permissionChecker = require('../../utils/permissionChecker');
const os = require('os');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('botinfo')
        .setDescription('Get information about the bot.'),

    isPublic: true,

    async execute(interaction) {
        const hasPermission = await permissionChecker.requirePermission(interaction, 'botinfo');
        if (!hasPermission) return;

        const cpuUsage = process.cpuUsage();
        const memoryUsage = process.memoryUsage();
        const uptime = process.uptime();

        const botInfoEmbed = new EmbedBuilder()
            .setTitle('🤖 Tomo Bot Information')
            .setDescription('Tomo is a moderation bot designed to help manage Discord servers effectively.')
            .addFields(
                { name: '⚙️ Version', value: 'v0.1.0-alpha', inline: true },
                { name: '👩‍💻 Developer', value: '[Synz](https://synz.xyz/)', inline: true },
                { name: '🏓 Ping', value: `${interaction.client.ws.ping}ms`, inline: true },
                { name: '💾 RAM Usage', value: `${(memoryUsage.heapUsed / 1024 / 1024).toFixed(2)} MB`, inline: true },
                { name: '⏱️ Uptime', value: `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m`, inline: true },
                { name: '🖥️ CPU Model', value: os.cpus()[0].model, inline: false }
            )
            .setColor(0xFFB6C1);

        await interaction.reply({ embeds: [botInfoEmbed], flags: MessageFlags.Ephemeral });
    },
};