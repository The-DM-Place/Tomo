const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const permissionChecker = require('../../utils/permissionChecker');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('serverinfo')
        .setDescription('Get information about the server.'),

    isPublic: true,

    async execute(interaction) {
        const hasPermission = await permissionChecker.requirePermission(interaction, 'serverinfo');
        if (!hasPermission) return;

        const { guild } = interaction;
        const memberCount = guild.memberCount;
        const owner = await guild.fetchOwner();
        const creationDate = guild.createdAt;
        const botCount = guild.members.cache.filter(member => member.user.bot).size;
        const roleCount = guild.roles.cache.size;

        const serverInfoEmbed = new EmbedBuilder()
            .setTitle(`🏰 Server Information: ${guild.name}`)
            .setThumbnail(guild.iconURL({ dynamic: true }))
            .addFields(
                { name: '🆔 Server ID', value: guild.id, inline: true },
                { name: '👑 Owner', value: `${owner.user.tag}`, inline: true },
                { name: '👥 Member Count', value: `${memberCount}`, inline: true },
                { name: '🤖 Bot Count', value: `${botCount}`, inline: true },
                { name: '📜 Role Count', value: `${roleCount}`, inline: true },
                { name: '📅 Created On', value: `<t:${Math.floor(creationDate.getTime() / 1000)}:D>`, inline: true }
            )
            .setColor(0xFFB6C1);

        await interaction.reply({ embeds: [serverInfoEmbed], flags: MessageFlags.Ephemeral });
    },
};