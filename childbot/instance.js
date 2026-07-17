const TelegramBot = require('node-telegram-bot-api');

class ChildBotInstance {
    constructor(userId, token, botInfo) {
        this.userId = userId.toString();
        this.token = token;
        this.botInfo = botInfo || {};
        this.bot = null;
        this.running = false;
        this.onCrash = null;
    }

    async start() {
        this.bot = new TelegramBot(this.token, { polling: true });
        this.running = true;

        this.bot.on('polling_error', async (err) => {
            console.error(`[ChildBot:${this.userId}] Polling error:`, err.message);
            if (!this.running) return;
            this.running = false;
            try { await this.bot.stopPolling(); } catch (e) { }
            if (this.onCrash) {
                try { await this.onCrash(this.userId, err); } catch (e) { }
            }
        });

        return true;
    }

    async stop() {
        this.running = false;
        if (this.bot) {
            try {
                await this.bot.stopPolling();
            } catch (e) {
                console.error(`[ChildBot:${this.userId}] Error stopping polling:`, e.message);
            }
            this.bot = null;
        }
    }

    isRunning() {
        return this.running && this.bot !== null;
    }

    async sendMessage(chatId, text, options = {}) {
        if (!this.bot) throw new Error('Bot not running');
        return await this.bot.sendMessage(chatId, text, { parse_mode: 'Markdown', ...options });
    }

    async sendPhoto(chatId, photo, options = {}) {
        if (!this.bot) throw new Error('Bot not running');
        return await this.bot.sendPhoto(chatId, photo, { parse_mode: 'Markdown', ...options });
    }

    async sendAnimation(chatId, animation, options = {}) {
        if (!this.bot) throw new Error('Bot not running');
        return await this.bot.sendAnimation(chatId, animation, { parse_mode: 'Markdown', ...options });
    }

    async testConnection() {
        try {
            await this.bot.sendMessage(this.userId, '✅ Bot con đang hoạt động bình thường!');
            return true;
        } catch (err) {
            console.error(`[ChildBot:${this.userId}] Test failed:`, err.message);
            return false;
        }
    }
}

module.exports = ChildBotInstance;
