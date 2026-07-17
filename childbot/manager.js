const { loadJSON, saveJSON } = require('../services/storage');
const { FILES, MAX_CHILD_BOTS, TELEGRAM_BOT_TOKEN } = require('../config/constants');
const { sendMessage } = require('../services/telegram');
const ChildBotInstance = require('./instance');
const { registerHandlers } = require('./handlers');

// Singleton — Map giữ instances đang chạy trong memory
const instances = new Map();

const restartMeta = new Map();

function normalizeError(err) {
    if (!err) return 'Unknown error';
    if (typeof err === 'string') return err;
    return err.message || String(err);
}

async function loadConfig(userId) {
    const data = await loadJSON(FILES.child_bots);
    return data[userId.toString()] || null;
}

async function sendNotificationByChildBot(ownerUserId, targetChatIds, text, options = {}) {
    const inst = getBotInstance(ownerUserId);
    if (!inst || !inst.isRunning()) {
        return { success: false, error: 'Bot con không chạy' };
    }

    const ids = Array.isArray(targetChatIds) ? targetChatIds : [targetChatIds];
    let ok = 0;
    let fail = 0;
    for (const chatId of ids) {
        try {
            await inst.sendMessage(chatId, text, options);
            ok++;
        } catch (e) {
            fail++;
        }
    }

    return { success: true, ok, fail };
}

async function sendNotificationAllChildBots(targetChatIds, text, options = {}) {
    const ids = Array.isArray(targetChatIds) ? targetChatIds : [targetChatIds];
    const results = [];

    for (const [ownerId, inst] of instances.entries()) {
        if (!inst || !inst.isRunning()) continue;
        let ok = 0;
        let fail = 0;
        for (const chatId of ids) {
            try {
                await inst.sendMessage(chatId, text, options);
                ok++;
            } catch (e) {
                fail++;
            }
        }
        results.push({ ownerId: ownerId, ok, fail });
    }

    return { success: true, results };
}

async function saveConfig(userId, config) {
    const data = await loadJSON(FILES.child_bots);
    data[userId.toString()] = { ...config, updated_at: Math.floor(Date.now() / 1000) };
    await saveJSON(FILES.child_bots, data);
}

function getBotStatus(userId) {
    const config = instances.get(userId.toString());
    if (config) return 'on';
    return null; // caller should check JSON for "off"
}

async function getBotStatusFull(userId) {
    if (instances.has(userId.toString())) return 'on';
    const cfg = await loadConfig(userId);
    if (cfg) return cfg.status || 'off';
    return null;
}

function getActiveCount() {
    return instances.size;
}

function getBotInstance(userId) {
    return instances.get(userId.toString()) || null;
}

async function isTokenInUse(token, excludeUserId) {
    const data = await loadJSON(FILES.child_bots);
    for (const [uid, cfg] of Object.entries(data)) {
        if (excludeUserId && uid === excludeUserId.toString()) continue;
        if (cfg.token === token) return true;
    }
    return false;
}

async function startBot(userId) {
    const strId = userId.toString();

    if (instances.has(strId)) {
        return { success: false, error: 'Bot con đã đang chạy' };
    }

    if (instances.size >= MAX_CHILD_BOTS) {
        return { success: false, error: '⚠️ Hệ thống đang đầy, vui lòng thử lại sau' };
    }

    const cfg = await loadConfig(userId);
    if (!cfg || !cfg.token) {
        return { success: false, error: 'Chưa có token' };
    }

    // Set status starting
    await saveConfig(userId, { ...cfg, status: 'starting', last_error: null });

    try {
        const inst = new ChildBotInstance(userId, cfg.token, {
            username: cfg.bot_username,
            first_name: cfg.bot_name
        });

        inst.status = 'starting';

        // On crash callback
        inst.onCrash = async (uid, err) => {
            const errMsg = normalizeError(err);
            console.error(`[ChildBot] Crash for user ${uid}: ${errMsg}`);

            const uidStr = uid.toString();
            instances.delete(uidStr);

            const meta = restartMeta.get(uidStr) || { attempts: 0, timer: null };
            meta.attempts += 1;
            restartMeta.set(uidStr, meta);

            const latestCfg = await loadConfig(uid);
            if (latestCfg) {
                await saveConfig(uid, {
                    ...latestCfg,
                    status: meta.attempts >= 3 ? 'off' : 'error',
                    last_error: errMsg
                });
            }

            if (meta.attempts >= 3) {
                restartMeta.delete(uidStr);
                try {
                    await sendMessage(uid, '❌ Bot con gặp lỗi liên tục, đã tắt tự động. Vui lòng bật lại sau.');
                } catch (e) { }
                return;
            }

            try {
                await sendMessage(uid, `⚠️ Bot con bị lỗi, tự khởi động lại sau 10 giây... (${meta.attempts}/3)`);
            } catch (e) { }

            if (meta.timer) {
                try { clearTimeout(meta.timer); } catch (e) { }
            }

            meta.timer = setTimeout(async () => {
                try {
                    await startBot(uid);
                } catch (e) {
                    // startBot sẽ tự log + save status off khi lỗi start
                }
            }, 10000);
        };

        await inst.start();
        registerHandlers(inst);
        instances.set(strId, inst);

        inst.status = 'on';
        restartMeta.delete(strId);
        await saveConfig(userId, { ...cfg, status: 'on', last_error: null });

        return { success: true };
    } catch (err) {
        console.error(`[ChildBot] Error starting bot for user ${strId}:`, err.message);
        await saveConfig(userId, { ...cfg, status: 'error', last_error: normalizeError(err) });
        return { success: false, error: err.message };
    }
}

async function stopBot(userId) {
    const strId = userId.toString();
    const inst = instances.get(strId);

    if (inst) {
        await inst.stop();
        instances.delete(strId);
    }

    const meta = restartMeta.get(strId);
    if (meta && meta.timer) {
        try { clearTimeout(meta.timer); } catch (e) { }
    }
    restartMeta.delete(strId);

    const cfg = await loadConfig(userId);
    if (cfg) {
        await saveConfig(userId, { ...cfg, status: 'off' });
    }

    return { success: true };
}

async function restoreAllBots() {
    const data = await loadJSON(FILES.child_bots);
    let restored = 0, failed = 0;

    for (const [uid, cfg] of Object.entries(data)) {
        if (cfg.status === 'on' || cfg.status === 'starting') {
            const result = await startBot(uid);
            if (result.success) {
                restored++;
                console.log(`[ChildBot] Restored bot for user ${uid}`);
            } else {
                failed++;
                console.error(`[ChildBot] Failed to restore bot for user ${uid}: ${result.error}`);
            }
        }
    }

    // console.log(`[ChildBot] Restore complete: ${restored} OK, ${failed} failed`);
    return { restored, failed };
}

async function handleVIPExpiry(userId) {
    await stopBot(userId);
    try {
        await sendMessage(userId, '⏰ VIP đã hết hạn, bot con đã tắt tự động. Gia hạn VIP để tiếp tục sử dụng.');
    } catch (e) {
        console.error(`[ChildBot] Failed to notify VIP expiry for ${userId}`);
    }
}

module.exports = {
    startBot,
    stopBot,
    restoreAllBots,
    getBotStatus,
    getBotStatusFull,
    getBotInstance,
    getActiveCount,
    isTokenInUse,
    saveConfig,
    loadConfig,
    handleVIPExpiry,
    sendNotificationByChildBot,
    sendNotificationAllChildBots
};
