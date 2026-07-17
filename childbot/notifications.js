const mainBot = require('../services/telegram');

// Lazy require manager to avoid circular dependency
function getManager() {
    return require('./manager');
}

async function sendText(chatId, text, options = {}) {
    const manager = getManager();
    const inst = manager.getBotInstance(chatId);

    if (inst && inst.isRunning()) {
        try {
            return await inst.sendMessage(chatId, text, options);
        } catch (err) {
            console.log(`[ChildBot] Fallback to main bot for text to ${chatId}`);
        }
    }

    return await mainBot.sendMessage(chatId, text, options);
}

async function sendPhoto(chatId, photo, options = {}) {
    const manager = getManager();
    const inst = manager.getBotInstance(chatId);

    if (inst && inst.isRunning()) {
        try {
            return await inst.sendPhoto(chatId, photo, options);
        } catch (err) {
            console.log(`[ChildBot] Fallback to main bot for photo to ${chatId}`);
        }
    }

    return await mainBot.sendPhoto(chatId, photo, options);
}

async function sendAnimation(chatId, animation, options = {}) {
    const manager = getManager();
    const inst = manager.getBotInstance(chatId);

    if (inst && inst.isRunning()) {
        try {
            return await inst.sendAnimation(chatId, animation, options);
        } catch (err) {
            console.log(`[ChildBot] Fallback to main bot for animation to ${chatId}`);
        }
    }

    return await mainBot.sendAnimation(chatId, animation, options);
}

module.exports = { sendText, sendPhoto, sendAnimation };
