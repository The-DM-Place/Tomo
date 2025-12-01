const API_ENDPOINT = process.env.METRICS_API_ENDPOINT;
const BOT_NAME = process.env.BOT_NAME;
const BOT_API_KEY = process.env.BOT_API_KEY;

function sendMetric(data) {
    if (!API_ENDPOINT || !BOT_API_KEY || !BOT_NAME) return;

    fetch(API_ENDPOINT, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-API-Key': BOT_API_KEY,
            'X-Bot-Name': BOT_NAME
        },
        body: JSON.stringify(data)
    }).catch(() => {
    });
}

module.exports = {
    wrapCommandHandler(commandExecuteFunction) {
        return async function (interaction) {
            const start = performance.now();

            try {
                const result = await commandExecuteFunction(interaction);
                const duration = performance.now() - start;

                sendMetric({
                    command: interaction.commandName,
                    success: 1,
                    ms: Math.round(duration),
                    userId: interaction.user.id,
                    guildId: interaction.guild?.id ?? null,
                    shard: interaction.client.shard?.ids?.[0] ?? 0,
                    apiPing: interaction.client.ws.ping,
                    timestamp: Date.now()
                });

                return result;
            } catch (error) {
                const duration = performance.now() - start;

                sendMetric({
                    command: interaction.commandName,
                    success: 0,
                    ms: Math.round(duration),
                    userId: interaction.user.id,
                    guildId: interaction.guild?.id ?? null,
                    shard: interaction.client.shard?.ids?.[0] ?? 0,
                    apiPing: interaction.client.ws.ping,
                    timestamp: Date.now(),
                    error: error.message
                });

                throw error;
            }
        };
    }
};
