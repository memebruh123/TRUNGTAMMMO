/**
 * [WORM-GPT v2] PROXY HEALTH MONITOR
 * File riêng biệt — tự kiểm tra proxy mỗi 15 phút
 * 
 * Features:
 *   - Test proxy bằng check UID Mark Zuckerberg (luôn LIVE)
 *   - Nếu fail → tự xoay IP + cảnh báo admin
 *   - Log trạng thái proxy liên tục
 */

const { sleep } = require('../utils/helpers');
const { sendMessage } = require('../services/telegram');
const { getAdmins } = require('../utils/adminManager');

const CHECK_INTERVAL = 15 * 60 * 1000; // 15 phút
let consecutiveFails = 0;
let lastAlertTime = 0;
const ALERT_COOLDOWN = 30 * 60 * 1000; // 30 phút mới alert lại

/**
 * Test proxy bằng cách check UID 4 (Mark Zuckerberg)
 */
async function testProxy() {
    try {
        const { checkUIDLiveDie, getProxyStatus, clearProxyCache } = require('../services/facebook');

        const result = await checkUIDLiveDie('4');

        if (result.status === 'LIVE') {
            // Proxy OK
            if (consecutiveFails > 0) {
                console.log(`[ProxyMonitor] ✅ Proxy recovered! (was failing ${consecutiveFails} times)`);
                // Nếu trước đó bị fail → báo admin proxy đã khôi phục
                if (consecutiveFails >= 3) {
                    const admins = await getAdmins();
                    const status = await getProxyStatus();
                    for (const adminId of admins) {
                        try {
                            await sendMessage(adminId, `✅ **PROXY ĐÃ KHÔI PHỤC!**\n\n` +
                                `📡 IP: \`${status.xoay.currentIP}\`\n` +
                                `🔄 Sau ${consecutiveFails} lần fail, proxy đã hoạt động lại bình thường.`);
                        } catch (e) { }
                    }
                }
            }
            consecutiveFails = 0;
            return { ok: true, result };
        } else {
            // Proxy fail hoặc trả sai
            consecutiveFails++;
            console.log(`[ProxyMonitor] ⚠️ Proxy check failed (${consecutiveFails}x): ${result.status} - ${result.info}`);

            // Thử clear cache và xoay IP mới
            await clearProxyCache();

            // Nếu fail >= 3 lần liên tục → cảnh báo admin (cooldown 30 phút)
            if (consecutiveFails >= 3 && (Date.now() - lastAlertTime > ALERT_COOLDOWN)) {
                lastAlertTime = Date.now();
                const admins = await getAdmins();
                const status = await getProxyStatus();

                for (const adminId of admins) {
                    try {
                        await sendMessage(adminId, `⚠️ **CẢNH BÁO PROXY!**\n\n` +
                            `📡 Proxy check **FAIL ${consecutiveFails} lần liên tục**!\n` +
                            `❓ Kết quả test: ${result.status} (${result.info})\n` +
                            `🔑 Key: \`${status.xoay.key}\`\n` +
                            `📅 Hạn: ${status.xoay.expiration}\n\n` +
                            `🔧 **Hành động tự động:**\n` +
                            `├ Đã xóa cache proxy\n` +
                            `└ Đang xoay IP mới...\n\n` +
                            `💡 Kiểm tra: Proxy Panel → Admin → 📡 Quản lý Proxy`, {
                            reply_markup: {
                                inline_keyboard: [
                                    [{ text: '📡 Quản lý Proxy', callback_data: 'admin_proxy_menu' }],
                                    [{ text: '🧪 Test lại', callback_data: 'proxy_test' }]
                                ]
                            }
                        });
                    } catch (e) { }
                }
            }

            return { ok: false, result };
        }
    } catch (err) {
        consecutiveFails++;
        console.error(`[ProxyMonitor] Error: ${err.message}`);
        return { ok: false, error: err.message };
    }
}

/**
 * Lấy trạng thái monitor
 */
function getMonitorStatus() {
    return {
        consecutiveFails,
        lastAlertTime: lastAlertTime ? new Date(lastAlertTime).toLocaleString('vi-VN') : 'N/A',
        isHealthy: consecutiveFails < 3
    };
}

/**
 * Worker thread chính — chạy liên tục
 */
async function proxyMonitorThread() {
    // console.log('🛡️ Proxy monitor started');

    // Đợi 30s cho bot khởi động xong
    await sleep(30000);

    // Test ngay lúc start
    await testProxy();

    while (true) {
        try {
            await sleep(CHECK_INTERVAL);
            await testProxy();
        } catch (err) {
            console.error('[ProxyMonitor] Thread error:', err.message);
            await sleep(60000);
        }
    }
}

module.exports = {
    proxyMonitorThread,
    testProxy,
    getMonitorStatus
};
