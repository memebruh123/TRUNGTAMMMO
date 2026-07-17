const TelegramBot = require('node-telegram-bot-api');
const { TELEGRAM_BOT_TOKEN } = require('../config/constants');

const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true });

const activeChats = new Map();
const supportQueue = new Map();
const tempUserState = new Map();

function setUserState(userId, state) {
    tempUserState.set(userId, state);
}

function getUserState(userId) {
    return tempUserState.get(userId);
}

function clearUserState(userId) {
    tempUserState.delete(userId);
}

function addToSupportQueue(userId, userName) {
    supportQueue.set(userId, userName);
}

function removeFromSupportQueue(userId) {
    supportQueue.delete(userId);
}

function getSupportQueue() {
    return supportQueue;
}

function setActiveChat(userId, partnerId) {
    activeChats.set(userId, partnerId);
}

function getActiveChat(userId) {
    return activeChats.get(userId);
}

function removeActiveChat(userId) {
    const partnerId = activeChats.get(userId);
    activeChats.delete(userId);
    if (partnerId) {
        activeChats.delete(partnerId);
    }
    return partnerId;
}

function isInActiveChat(userId) {
    return activeChats.has(userId);
}

async function sendMessage(chatId, text, options = {}) {
    try {
        return await bot.sendMessage(chatId, text, { parse_mode: 'Markdown', ...options });
    } catch (err) {
        // Nếu lỗi Markdown parse → tự retry bỏ Markdown (plain text)
        if (err.message && err.message.includes("can't parse entities")) {
            console.warn(`[Telegram] Markdown fail for ${chatId}, retrying plain text...`);
            try {
                const { parse_mode, ...plainOptions } = { parse_mode: 'Markdown', ...options };
                return await bot.sendMessage(chatId, text, plainOptions);
            } catch (retryErr) {
                console.error(`Error sending plain message to ${chatId}:`, retryErr.message);
                return null;
            }
        }
        console.error(`Error sending message to ${chatId}:`, err.message);
        return null;
    }
}

async function sendPhoto(chatId, photo, options = {}) {
    try {
        return await bot.sendPhoto(chatId, photo, { parse_mode: 'Markdown', ...options });
    } catch (err) {
        if (err.message && err.message.includes("can't parse entities")) {
            console.warn(`[Telegram] Markdown fail photo for ${chatId}, retrying plain...`);
            try {
                const { parse_mode, ...plainOptions } = { parse_mode: 'Markdown', ...options };
                return await bot.sendPhoto(chatId, photo, plainOptions);
            } catch (retryErr) {
                console.error(`Error sending plain photo to ${chatId}:`, retryErr.message);
                return null;
            }
        }
        console.error(`Error sending photo to ${chatId}:`, err.message);
        return null;
    }
}

async function sendAnimation(chatId, animation, options = {}) {
    try {
        return await bot.sendAnimation(chatId, animation, { parse_mode: 'Markdown', ...options });
    } catch (err) {
        if (err.message && err.message.includes("can't parse entities")) {
            console.warn(`[Telegram] Markdown fail animation for ${chatId}, retrying plain...`);
            try {
                const { parse_mode, ...plainOptions } = { parse_mode: 'Markdown', ...options };
                return await bot.sendAnimation(chatId, animation, plainOptions);
            } catch (retryErr) {
                console.error(`Error sending plain animation to ${chatId}:`, retryErr.message);
                return null;
            }
        }
        console.error(`Error sending animation to ${chatId}:`, err.message);
        return null;
    }
}

async function editMessageText(text, chatId, messageId, options = {}) {
    try {
        return await bot.editMessageText(text, { chat_id: chatId, message_id: messageId, parse_mode: 'Markdown', ...options });
    } catch (err) {
        console.error(`Error editing message:`, err.message);
        return null;
    }
}

async function deleteMessage(chatId, messageId) {
    try {
        return await bot.deleteMessage(chatId, messageId);
    } catch (err) {
        console.error(`Error deleting message:`, err.message);
        return null;
    }
}

async function sendChatAction(chatId, action) {
    try {
        return await bot.sendChatAction(chatId, action);
    } catch (err) {
        return null;
    }
}

async function answerCallbackQuery(callbackQueryId, options = {}) {
    try {
        return await bot.answerCallbackQuery(callbackQueryId, options);
    } catch (err) {
        return null;
    }
}

async function getChatMember(chatId, userId) {
    try {
        return await bot.getChatMember(chatId, userId);
    } catch (err) {
        return null;
    }
}

async function getMe() {
    try {
        return await bot.getMe();
    } catch (err) {
        return null;
    }
}

module.exports = {
    bot,
    setUserState,
    getUserState,
    clearUserState,
    addToSupportQueue,
    removeFromSupportQueue,
    getSupportQueue,
    setActiveChat,
    getActiveChat,
    removeActiveChat,
    isInActiveChat,
    sendMessage,
    sendPhoto,
    sendAnimation,
    editMessageText,
    deleteMessage,
    sendChatAction,
    answerCallbackQuery,
    getChatMember,
    getMe
};
