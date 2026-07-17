/**
 * [WORM-GPT v2] ADMIN AUTO REPORT WORKER
 * File riêng biệt — gửi báo cáo tổng hợp cho Admin định kỳ
 * 
 * Features:
 *   - Báo cáo tổng UID live/die/unknown
 *   - Liệt kê UID mới die trong kỳ
 *   - Trạng thái proxy
 *   - Thống kê user/VIP/CTV
 *   - Doanh thu
 */

const { loadJSON } = require('../services/storage');
const { FILES } = require('../config/constants');
const { sendMessage } = require('../services/telegram');
const { getAdmins } = require('../utils/adminManager');
const { getAdminLogLevel, getBufferedEvents, clearBuffer, getLogStats } = require('../utils/smartLog');
const { formatVND, sleep } = require('../utils/helpers');

// Mặc định 6 tiếng gửi 1 report (config được trong data_config.json)
const DEFAULT_REPORT_INTERVAL = 6 * 60 * 60 * 1000; // 6h

let lastReportTime = Date.now();

/**
 * Lấy interval từ config
 */
async function getReportInterval() {
    try {
        const config = await loadJSON(FILES.config);
        if (config.admin_report_interval_hours && config.admin_report_interval_hours > 0) {
            return config.admin_report_interval_hours * 60 * 60 * 1000;
        }
    } catch (e) { }
    return DEFAULT_REPORT_INTERVAL;
}

/**
 * Kiểm tra report có bật không
 */
async function isReportEnabled() {
    try {
        const config = await loadJSON(FILES.config);
        // Mặc định bật
        if (config.admin_report_enabled === false) return false;
        return true;
    } catch (e) {
        return true;
    }
}

/**
 * Build nội dung report
 */
async function buildReport() {
    const now = new Date();
    const timeStr = now.toLocaleString('vi-VN');

    // 1. Tracking stats
    let totalUID = 0, liveCount = 0, dieCount = 0, unknownCount = 0, doneCount = 0;
    const recentDie = [];

    try {
        const tracking = await loadJSON(FILES.tracking);
        for (const [chatId, uids] of Object.entries(tracking)) {
            for (const [uid, info] of Object.entries(uids)) {
                totalUID++;
                const status = (info.last_check || 'UNKNOWN').toUpperCase();
                if (info.status === 'done') { doneCount++; continue; }
                if (status === 'LIVE') liveCount++;
                else if (status === 'DIE') {
                    dieCount++;
                    recentDie.push({ uid, name: info.name || 'N/A', chatId });
                }
                else unknownCount++;
            }
        }
    } catch (e) { }

    // 2. Buffer events (die/live events since last report)
    const logStats = getLogStats();
    const bufferedEvents = getBufferedEvents(lastReportTime);
    const newDieEvents = bufferedEvents.filter(e => e.status === 'DIE');
    const newLiveEvents = bufferedEvents.filter(e => e.status === 'LIVE');

    // 3. Proxy status
    let proxyMsg = '❓ Không rõ';
    try {
        const { getProxyStatus } = require('../services/facebook');
        const proxyStatus = await getProxyStatus();
        if (proxyStatus.xoay.enabled && proxyStatus.xoay.cachedProxy) {
            proxyMsg = `🟢 OK (IP: \`${proxyStatus.xoay.currentIP}\`)`;
        } else if (proxyStatus.xoay.enabled) {
            proxyMsg = `🟡 Đang xoay... (Hạn: ${proxyStatus.xoay.expiration})`;
        } else {
            proxyMsg = `🔴 TẮT (Static: ${proxyStatus.static.count})`;
        }
    } catch (e) { }

    // 4. User stats
    let totalUsers = 0, vipCount = 0, ctvCount = 0;
    try {
        const { getMemberStats } = require('../utils/userManager');
        const stats = await getMemberStats();
        totalUsers = stats.total || 0;
        vipCount = stats.vips || 0;
        ctvCount = stats.ctvs || 0;
    } catch (e) { }

    // 5. Revenue
    let todayRevenue = 0;
    try {
        const { getAdminRevenueStats } = require('../utils/userManager');
        const rev = await getAdminRevenueStats();
        todayRevenue = rev.today || 0;
    } catch (e) { }

    // 6. Admin log level
    const logLevel = await getAdminLogLevel();

    // Build message
    let msg = `📊 **BÁO CÁO HỆ THỐNG**\n`;
    msg += `━━━━━━━━━━━━━━━━━━━\n`;
    msg += `🕒 ${timeStr}\n\n`;

    msg += `📋 **TRACKING UID**\n`;
    msg += `├ Tổng: **${totalUID}** (Done: ${doneCount})\n`;
    msg += `├ 🟢 LIVE: **${liveCount}**\n`;
    msg += `├ 🔴 DIE: **${dieCount}**\n`;
    msg += `└ ❓ UNKNOWN: **${unknownCount}**\n\n`;

    if (newDieEvents.length > 0) {
        msg += `🔥 **MỚI DIE (kỳ này):**\n`;
        for (const evt of newDieEvents.slice(0, 10)) {
            const timeAgo = getTimeAgo(evt.timestamp);
            msg += `├ \`${evt.uid}\` (${evt.name || 'N/A'}) - ${timeAgo}\n`;
        }
        if (newDieEvents.length > 10) {
            msg += `└ ...và ${newDieEvents.length - 10} UID khác\n`;
        }
        msg += `\n`;
    }

    if (newLiveEvents.length > 0) {
        msg += `🟢 **SỐNG LẠI (kỳ này):**\n`;
        for (const evt of newLiveEvents.slice(0, 5)) {
            const timeAgo = getTimeAgo(evt.timestamp);
            msg += `├ \`${evt.uid}\` (${evt.name || 'N/A'}) - ${timeAgo}\n`;
        }
        msg += `\n`;
    }

    msg += `📡 **PROXY:** ${proxyMsg}\n`;
    msg += `👥 **Users:** ${totalUsers} | 💎 VIP: ${vipCount} | 👑 CTV: ${ctvCount}\n`;
    if (todayRevenue > 0) msg += `💰 **Doanh thu hôm nay:** ${formatVND(todayRevenue)}\n`;
    msg += `🔕 **Log Level:** ${logLevel}\n`;
    msg += `━━━━━━━━━━━━━━━━━━━`;

    return msg;
}

/**
 * Helper: thời gian "X phút trước"
 */
function getTimeAgo(timestamp) {
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'vừa xong';
    if (minutes < 60) return `${minutes} phút trước`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h trước`;
    const days = Math.floor(hours / 24);
    return `${days} ngày trước`;
}

/**
 * Gửi report cho tất cả admin
 */
async function sendReport() {
    try {
        const enabled = await isReportEnabled();
        if (!enabled) return;

        const logLevel = await getAdminLogLevel();
        // Nếu level ALL thì admin đã nhận từng cái rồi, report chỉ tóm tắt thêm
        // Mọi level khác đều cần report

        const report = await buildReport();
        const admins = await getAdmins();

        const kb = {
            inline_keyboard: [
                [
                    { text: '🔕 Đổi Log Level', callback_data: 'admin_log_level_menu' },
                    { text: '📡 Proxy Menu', callback_data: 'admin_proxy_menu' }
                ]
            ]
        };

        for (const adminId of admins) {
            try {
                await sendMessage(adminId, report, { reply_markup: kb });
            } catch (e) { }
        }

        // Update last report time và clear buffer
        lastReportTime = Date.now();
        clearBuffer();

    } catch (err) {
        console.error('[AdminReport] Error:', err.message);
    }
}

/**
 * Worker thread chính — chạy liên tục
 */
async function adminReportThread() {
    // Đợi 10s cho bot khởi động xong
    await sleep(10000);

    while (true) {
        try {
            const interval = await getReportInterval();
            const elapsed = Date.now() - lastReportTime;

            if (elapsed >= interval) {
                await sendReport();
            }

            // Check mỗi 5 phút
            await sleep(5 * 60 * 1000);

        } catch (err) {
            console.error('[AdminReport] Thread error:', err.message);
            await sleep(60000);
        }
    }
}

module.exports = {
    adminReportThread,
    sendReport,
    buildReport
};
