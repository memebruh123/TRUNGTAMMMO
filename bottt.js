require('dotenv').config();
const { bot, sendMessage } = require('./services/telegram');
const { initFiles } = require('./services/storage');
const { autoCheckThread } = require('./workers/autoCheck');
const { cookieCheckThread } = require('./workers/cookieChecker');
const { handleStart, handleAdmin, handleAddMoney, handleTangVIP, handleNapTien, handleSetCookie, handleAddUID, handleCTV } = require('./handlers/commands');
const { handleCallbackQuery } = require('./handlers/callbacks');
const { handleMessage } = require('./handlers/messages');
const { getAllUsersList } = require('./utils/userManager');
const childBotManager = require('./childbot/manager');

async function notifyBotStart() {
    try {
        const { getAdmins } = require('./utils/adminManager');
        const admins = await getAdmins();

        const now = new Date().toLocaleString('vi-VN');
        // Thông báo cho Admin là Bot đã Online
        const startupMsg = `🚀 **BOT ĐÃ KHỞI ĐỘNG (RESTART)**\n\n` +
            `🕒 Thời gian: \`${now}\`\n` +
            `✅ Trạng thái: **Sẵn sàng**\n` +
            `🔄 Auto Check: **Running**\n` +
            `👤 Admin Online: ${admins.size}\n\n` +
            `❓ **Sếp có muốn thông báo cho User biết Bot đã Online lại không?**`;

        const broadcastMarkup = {
            inline_keyboard: [
                [
                    { text: '✅ Duyệt (Báo User)', callback_data: 'confirm_startup_broadcast' },
                    { text: '❌ Thôi (Im lặng)', callback_data: 'close_panel' }
                ]
            ]
        };

        for (const adminId of admins) {
            try {
                await bot.sendMessage(adminId, startupMsg, { reply_markup: broadcastMarkup });
            } catch (err) {
                console.error(`Error sending message to ${adminId}:`, err.message);
            }
        }
    } catch (err) {
        console.error('Error notifying bot start:', err.message);
    }
}

const shutdown = async () => {
    console.log('\n⚠️ Shutting down bot...');

    // Tắt các thread/interval nếu cần
    if (global.autoCheckInterval) clearInterval(global.autoCheckInterval);
    if (global.cookieCheckInterval) clearInterval(global.cookieCheckInterval);

    // Báo Admin nếu kịp (timeout ngắn để không treo)
    /*
    try {
        const pLimit = require('p-limit');
        const limit = pLimit(5);
        const notifyTasks = [...ADMIN_IDS].map(id => limit(() => 
            bot.sendMessage(id, '🛑 **BOT ĐANG TẮT**\n\nAd bảo trì hoặc restart. Hẹn gặp lại!').catch(() => {})
        ));
        await Promise.race([Promise.all(notifyTasks), new Promise(r => setTimeout(r, 2000))]);
    } catch (e) {}
    */

    console.log('🛑 Bot stopped');
    process.exit(0);
};

async function main() {
    const startTime = Date.now();
    console.log('');
    console.log('═══════════════════════════════════════');
    console.log('   🤖 WORM-GPT BOT — STARTING UP...');
    console.log('═══════════════════════════════════════');
    console.log('');

    await initFiles();
    console.log('  ✅ Files initialized');

    // Start Auto Check Worker (Background Loop)
    autoCheckThread().catch(err => {
        console.error('Auto-check thread error:', err.message);
    });
    console.log('  ✅ Auto-check worker');

    // Start Cookie Check Worker
    cookieCheckThread().catch(err => {
        console.error('Cookie checker error:', err.message);
    });
    console.log('  ✅ Cookie checker');

    // [WORM-GPT v2] Start Admin Report Worker
    try {
        const { adminReportThread } = require('./workers/adminReport');
        adminReportThread().catch(err => {
            console.error('Admin report error:', err.message);
        });
        console.log('  ✅ Admin report (6h)');
    } catch (e) {
        console.log('  ⚠️ Admin report: SKIP');
    }

    // [WORM-GPT v2] Start Proxy Monitor Worker
    try {
        const { proxyMonitorThread } = require('./workers/proxyMonitor');
        proxyMonitorThread().catch(err => {
            console.error('Proxy monitor error:', err.message);
        });
        console.log('  ✅ Proxy monitor (15m)');
    } catch (e) {
        console.log('  ⚠️ Proxy monitor: SKIP');
    }

    // [WORM-GPT v2] Start Auto Backup Worker
    try {
        const { autoBackupThread } = require('./workers/autoBackup');
        autoBackupThread().catch(err => {
            console.error('Auto backup error:', err.message);
        });
        console.log('  ✅ Auto backup (24h)');
    } catch (e) {
        console.log('  ⚠️ Auto backup: SKIP');
    }

    // Restore child bots
    childBotManager.restoreAllBots().then(res => {
        console.log(`  ✅ Child bots: ${res.restored} OK, ${res.failed} failed`);
    }).catch(err => {
        console.error('  ❌ Child bot restore:', err.message);
    });

    bot.onText(/\/start/, handleStart);
    bot.onText(/\/ctv/, handleCTV);
    bot.onText(/\/admin/, handleAdmin);
    bot.onText(/\/setcookie/, handleSetCookie);

    bot.on('callback_query', handleCallbackQuery);

    bot.on('message', (msg) => {
        handleMessage(msg);
    });

    // Load config + stats cho startup info
    const { loadJSON } = require('./services/storage');
    const { FILES } = require('./config/constants');
    const config = await loadJSON(FILES.config) || {};
    const tracking = await loadJSON(FILES.tracking) || {};
    const users = await getAllUsersList();

    let totalUID = 0;
    Object.values(tracking).forEach(list => {
        if (list && typeof list === 'object') totalUID += Object.keys(list).length;
    });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log('');
    console.log('───────────────────────────────────────');
    console.log('  📊 SYSTEM INFO:');
    console.log(`  👥 Users: ${users.length} | 📋 UIDs: ${totalUID}`);
    console.log(`  📡 Proxy xoay: ${config.proxy_xoay_enabled !== false ? 'BẬT' : 'TẮT'}`);
    console.log(`  🔕 Admin log: ${config.admin_log_level || 'ALL'}`);
    console.log(`  🆓 Free check: ${config.free_check_uid ? 'BẬT' : 'TẮT'}`);
    console.log('───────────────────────────────────────');
    console.log(`  ⏱️  Started in ${elapsed}s`);
    console.log('  🟢 BOT IS RUNNING');
    console.log('═══════════════════════════════════════');
    console.log('');

    setTimeout(() => {
        notifyBotStart();
    }, 2000);

}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
