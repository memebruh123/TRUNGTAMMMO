function extractUIDFromText(text) {
    if (!text) return null;

    // Prefer a long digit sequence (Facebook UID)
    const digitMatch = text.match(/\b\d{6,20}\b/);
    if (digitMatch) return digitMatch[0];

    // Or a facebook link
    const linkMatch = text.match(/https?:\/\/(?:www\.)?facebook\.com\/[^\s]+/i);
    if (linkMatch) return linkMatch[0];

    return null;
}

async function handleCheckUID(bot, chatId, raw) {
    const { getUIDFromLink, getProfileInfo } = require('../services/facebookInfo');

    const parsed = await getUIDFromLink(raw);
    const uid = parsed && parsed.uid ? parsed.uid : null;

    if (!uid) {
        await bot.sendMessage(chatId, '❌ Không nhận diện được UID. Gửi UID số hoặc link Facebook.');
        return;
    }

    let info = null;
    try {
        info = await getProfileInfo(uid);
    } catch (e) {
        info = null;
    }

    const name = info && info.name ? info.name : '(Không rõ)';
    const profileLink = `https://facebook.com/${uid}`;
    const msg = `✅ **THÔNG TIN UID**\n\n` +
        `👤 Họ tên: ${name}\n` +
        `🆔 ID: \`${uid}\`\n` +
        `🔗 Link: ${profileLink}`;

    await bot.sendMessage(chatId, msg, { disable_web_page_preview: true });
}

function registerHandlers(botInstance) {
    const bot = botInstance.bot;
    if (!bot) return;

    // /start command
    bot.onText(/\/start/, async (msg) => {
        const chatId = msg.chat.id;
        try {
            await bot.sendMessage(chatId,
                `🤖 Bot Con (Minimalist Check Bot)\n\n` +
                `📡 Bot: @${botInstance.botInfo.username || 'unknown'}\n\n` +
                `✅ Cách dùng:\n` +
                `- Gửi UID số hoặc link Facebook để check\n` +
                `- Hoặc dùng: /check <uid|link>\n\n` +
                `🧾 Telegram ID của bạn: \`${msg.from.id}\``
            );
        } catch (e) {
            console.error(`[ChildBot:${botInstance.userId}] /start error:`, e.message);
        }
    });

    bot.onText(/\/check(\s+.+)?/i, async (msg, match) => {
        const chatId = msg.chat.id;
        const raw = (match && match[1] ? match[1] : '').trim();

        if (!raw) {
            await bot.sendMessage(chatId, '⚠️ Cú pháp: /check <uid|link>');
            return;
        }

        try {
            await handleCheckUID(bot, chatId, raw);
        } catch (e) {
            try { await bot.sendMessage(chatId, `❌ Lỗi check UID: ${e.message}`); } catch (err) { }
        }
    });

    // Callback queries (minimal)
    bot.on('callback_query', async (query) => {
        try {
            await bot.answerCallbackQuery(query.id, { text: 'Dùng /check <uid|link> để check' });
        } catch (err) {
            console.error(`[ChildBot:${botInstance.userId}] Callback error:`, err.message);
            try { await bot.answerCallbackQuery(query.id); } catch (e) { }
        }
    });

    // Mọi message khác → fallback
    bot.on('message', async (msg) => {
        if (!msg || !msg.text) return;
        if (msg.text.startsWith('/start')) return; // đã xử lý ở trên
        if (msg.text.toLowerCase().startsWith('/check')) return; // đã xử lý ở trên

        const candidate = extractUIDFromText(msg.text);
        if (!candidate) return;

        try {
            await handleCheckUID(bot, msg.chat.id, candidate);
        } catch (e) {
            try { await bot.sendMessage(msg.chat.id, `❌ Lỗi check UID: ${e.message}`); } catch (err) { }
        }
    });
}

module.exports = { registerHandlers };
