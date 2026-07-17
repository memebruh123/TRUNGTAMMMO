/**
 * [WORM-GPT v2] USER DASHBOARD MODULE
 * Quản lý danh sách UID, stats, filter, format caption cho user
 */

const { loadJSON } = require('../services/storage');
const { FILES } = require('../config/constants');
const { formatVND, getTimeDiff, escapeMarkdown } = require('./helpers');

/**
 * Lấy danh sách UID của user kèm filter
 * @param {string} chatId 
 * @param {string} filter — 'ALL' | 'LIVE' | 'DIE' | 'DONE'
 * @returns {Array} 
 */
async function getUserUIDList(chatId, filter = 'ALL') {
    const tracking = await loadJSON(FILES.tracking);
    const userUIDs = tracking[chatId.toString()];
    if (!userUIDs || typeof userUIDs !== 'object') return [];

    const result = [];
    for (const [uid, info] of Object.entries(userUIDs)) {
        const status = (info.last_check || 'UNKNOWN').toUpperCase();
        const isDone = info.status === 'done';

        if (filter === 'LIVE' && status !== 'LIVE') continue;
        if (filter === 'DIE' && status !== 'DIE') continue;
        if (filter === 'DONE' && !isDone) continue;
        if (filter === 'ACTIVE' && isDone) continue;

        result.push({
            uid,
            name: info.name || 'N/A',
            note: info.note || '',
            price: info.price || 0,
            status: isDone ? 'DONE' : status,
            part: info.part || 0,
            start_time: info.start_time || 0,
            last_check: info.last_check,
            isDone
        });
    }

    return result;
}

/**
 * Lấy thống kê UID của user
 */
async function getUserUIDStats(chatId) {
    const list = await getUserUIDList(chatId, 'ALL');

    let live = 0, die = 0, unknown = 0, done = 0;
    for (const item of list) {
        if (item.status === 'LIVE') live++;
        else if (item.status === 'DIE') die++;
        else if (item.status === 'DONE') done++;
        else unknown++;
    }

    return {
        total: list.length,
        live,
        die,
        unknown,
        done,
        active: list.length - done
    };
}

/**
 * Format thời gian chi tiết
 * @returns {string} "3d 4h 12p"
 */
function formatDuration(seconds) {
    if (!seconds || seconds <= 0) return '0d 0h 0p';

    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    return `${days}d ${hours}h ${minutes}p`;
}

/**
 * Format thời gian tương đối "X phút trước"
 */
function formatTimeAgo(timestamp) {
    if (!timestamp) return 'N/A';
    const now = Math.floor(Date.now() / 1000);
    const diff = now - timestamp;

    if (diff < 60) return 'Vừa xong';
    if (diff < 3600) return `${Math.floor(diff / 60)} phút trước`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} giờ trước`;
    return `${Math.floor(diff / 86400)} ngày trước`;
}

/**
 * Build caption cho khi ADD UID thành công
 */
function buildAddSuccessCaption({ name, fbName, uid, status, part, price, note, startTime }) {
    const now = new Date();
    const timeStr = now.toLocaleString('vi-VN', {
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        day: '2-digit', month: '2-digit', year: 'numeric'
    });
    const statusText = status === 'LIVE' ? '🟢 LIVE' : '🔴 DIE';
    const dieCount = part || 0;

    const safeName = escapeMarkdown(name || 'N/A');
    const safeFbName = escapeMarkdown(fbName || '');
    let displayName = safeName;
    if (safeFbName && safeFbName !== safeName && fbName !== 'Name not found') {
        displayName += ` (${safeFbName})`;
    }

    let c = `✅ *THÊM UID THÀNH CÔNG*\n`;
    c += `━━━━━━━━━━━━━━━━━━━━━\n`;
    c += `┃ 👤 UID: \`${uid}\`\n`;
    c += `┃ 📛 Tên: ${displayName}\n`;
    c += `┃ 📊 Status: ${statusText}\n`;
    c += `┃ 💀 Số lần DIE: ${dieCount}\n`;
    c += `┃ 💰 Giá: ${formatVND(price)}\n`;
    c += `┃ 📝 Ghi chú: ${note || 'Không có'}\n`;
    c += `┃ 🔗 FB: facebook.com/${uid}\n`;
    if (status !== 'LIVE') {
        c += `━━━━━━━━━━━━━━━━━━━━━\n`;
        const prediction = dieCount <= 1 ? '956' : '282';
        c += `┃ 🔮 Dự đoán: ${prediction}\n`;
    }
    c += `┃ 📅 Bắt đầu: ${timeStr}\n`;
    c += `━━━━━━━━━━━━━━━━━━━━━\n`;
    c += status === 'LIVE' ? `🔄 Đang theo dõi chờ DIE...` : `⏳ Chờ sống lại...`;

    return c;
}

/**
 * Build caption cho thông báo DIE/LIVE
 */
function buildStatusChangeCaption({ telegramName, name, uid, isLive, part, price, note, startTime, statusChangeTime }) {
    const now = new Date();
    const timeStr = now.toLocaleString('vi-VN', {
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        day: '2-digit', month: '2-digit', year: 'numeric'
    });

    const aliveSeconds = startTime ? Math.floor(Date.now() / 1000) - startTime : 0;
    const aliveDuration = formatDuration(aliveSeconds);
    const dieCount = part || 0;

    // Ngày bắt đầu tracking
    const startDate = startTime ? new Date(startTime * 1000) : null;
    const startDateStr = startDate ? startDate.toLocaleString('vi-VN', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    }) : 'N/A';

    const safeTelegramName = escapeMarkdown(telegramName || '');
    const safeName = escapeMarkdown(name || 'N/A');

    const title = isLive
        ? `🟢 SỐNG LẠI RỒI *${safeTelegramName}* ƠI! 🟢`
        : `💀 DIE RỒI *${safeTelegramName}* ƠI! 💀`;

    const headerIcon = isLive ? '✅ THAY ĐỔI TRẠNG THÁI' : '❌ THAY ĐỔI TRẠNG THÁI';
    const statusText = isLive ? 'DIE 🔴 ➔ LIVE 🟢' : 'LIVE 🟢 ➔ DIE 🔴';
    const timeLabel = isLive ? '⏱️ Thời gian theo dõi' : '⚰️ Thời gian sống';

    let c = `${title}\n`;
    c += `${headerIcon}\n`;
    c += `━━━━━━━━━━━━━━━━━━━━━\n`;
    c += `┃ 👤 UID: \`${uid}\`\n`;
    c += `┃ 📛 Tên: ${safeName}\n`;
    c += `┃ 🔄 Status: ${statusText}\n`;
    c += `┃ ${timeLabel}: *${aliveDuration}*\n`;
    c += `┃ 💀 Số lần DIE: ${dieCount}\n`;
    c += `┃ 💰 Giá: ${formatVND(price)}\n`;
    c += `┃ 📝 Ghi chú: ${note || 'Không có'}\n`;
    c += `┃ 🔗 FB: facebook.com/${uid}\n`;
    c += `━━━━━━━━━━━━━━━━━━━━━\n`;
    if (!isLive) {
        const prediction = dieCount <= 1 ? '956' : '282';
        c += `┃ 🔮 Dự đoán: ${prediction}\n`;
    }
    c += `┃ 📅 Bắt đầu: ${startDateStr}\n`;
    c += `┃ 🕒 Cập nhật: ${timeStr}\n`;
    c += `━━━━━━━━━━━━━━━━━━━━━`;

    return c;
}

/**
 * Build buttons cho caption UID (dùng chung cho add + die/live)
 */
function buildUIDButtons(uid, status) {
    const isLive = status === 'LIVE';
    const buttons = [];

    // Row 1: Actions
    if (!isLive) {
        buttons.push([
            { text: '🔍 Check FAQ', callback_data: `checkfaq_${uid}` },
            { text: '🔄 Check lại', callback_data: `recheck_${uid}` }
        ]);
    } else {
        buttons.push([
            { text: '🔄 Check lại', callback_data: `recheck_${uid}` },
            { text: '📱 Xem FB', url: `https://facebook.com/${uid}` }
        ]);
    }

    // Row 2: Manage
    buttons.push([
        { text: '🗑️ Xóa', callback_data: `del_${uid}` },
        { text: '✅ Done', callback_data: `done_${uid}` }
    ]);

    // Row 3: Navigation
    buttons.push([
        { text: '📋 Danh sách UID', callback_data: 'user_uid_list' },
        { text: '➕ Thêm tiếp', callback_data: 'check_uid' }
    ]);

    return buttons;
}

/**
 * Build bảng danh sách UID cho user
 */
async function buildUIDListMessage(chatId, filter = 'ALL', page = 0) {
    const stats = await getUserUIDStats(chatId);
    const list = await getUserUIDList(chatId, filter === 'ALL' ? 'ALL' : filter);

    const PER_PAGE = 8;
    const totalPages = Math.ceil(list.length / PER_PAGE) || 1;
    const pageItems = list.slice(page * PER_PAGE, (page + 1) * PER_PAGE);

    let msg = `📋 *DANH SÁCH UID CỦA BẠN*\n`;
    msg += `━━━━━━━━━━━━━━━━━━━\n`;
    msg += `📊 Tổng: *${stats.total}* | 🟢 ${stats.live} | 🔴 ${stats.die} | ✅ ${stats.done}\n`;
    msg += `🔎 Filter: *${filter}* | Trang ${page + 1}/${totalPages}\n`;
    msg += `━━━━━━━━━━━━━━━━━━━\n\n`;

    if (pageItems.length === 0) {
        msg += `📭 Không có UID nào${filter !== 'ALL' ? ` ở trạng thái ${filter}` : ''}.\n`;
    } else {
        for (let i = 0; i < pageItems.length; i++) {
            const item = pageItems[i];
            const idx = page * PER_PAGE + i + 1;
            const icon = item.status === 'LIVE' ? '🟢' :
                item.status === 'DIE' ? '🔴' :
                    item.status === 'DONE' ? '✅' : '❓';

            const trackDuration = item.start_time ? formatTimeAgo(item.start_time) : '';
            const shortName = item.name.length > 15 ? item.name.substring(0, 15) + '..' : item.name;

            msg += `${idx}. ${icon} \`${item.uid}\`\n`;
            msg += `    ${shortName}`;
            if (item.price > 0) msg += ` • ${formatVND(item.price)}`;
            if (trackDuration) msg += ` • ${trackDuration}`;
            msg += `\n`;
        }
    }

    // Buttons
    const kb = [];

    // Filter buttons
    const filterRow = [];
    if (filter !== 'ALL') filterRow.push({ text: '📊 Tất cả', callback_data: 'uidlist_ALL_0' });
    if (filter !== 'LIVE') filterRow.push({ text: '🟢 LIVE', callback_data: 'uidlist_LIVE_0' });
    if (filter !== 'DIE') filterRow.push({ text: '🔴 DIE', callback_data: 'uidlist_DIE_0' });
    if (filterRow.length > 0) kb.push(filterRow);

    // Pagination
    const navRow = [];
    if (page > 0) navRow.push({ text: '⬅️ Trước', callback_data: `uidlist_${filter}_${page - 1}` });
    if (page < totalPages - 1) navRow.push({ text: '➡️ Sau', callback_data: `uidlist_${filter}_${page + 1}` });
    if (navRow.length > 0) kb.push(navRow);

    // Action buttons
    kb.push([
        { text: '📤 Export', callback_data: 'export_uid_csv' },
        { text: '🔄 Check tất cả', callback_data: 'recheck_all' }
    ]);
    kb.push([
        { text: '🔙 Menu chính', callback_data: 'go_home' }
    ]);

    return { msg, kb };
}

/**
 * Build User Stats Card (nâng cấp my_account)
 */
async function buildUserStatsCard(userId, userData, vipInfo) {
    const stats = await getUserUIDStats(userId);

    // Tính thời gian dùng
    let usageDuration = 'N/A';
    if (userData.created_at) {
        const created = new Date(userData.created_at);
        const diffDays = Math.floor((Date.now() - created.getTime()) / 86400000);
        usageDuration = diffDays > 0 ? `${diffDays} ngày` : 'Hôm nay';
    }

    const statusIcon = vipInfo.isVIP ? '✅' : '❌';
    const vipText = vipInfo.isVIP ? `VIP (${vipInfo.info})` : 'Thường';
    const roleText = userData.isCTV ? '👑 ĐẠI LÝ (CTV)' : '👤 Thành viên';

    let msg = `👤 *THÔNG TIN TÀI KHOẢN*\n`;
    msg += `╔══════════════════════╗\n`;
    msg += `║ 🆔 ID: \`${userId}\`\n`;
    msg += `║ 🎭 Vai trò: *${roleText}*\n`;
    msg += `║ 💰 Số dư: *${formatVND(userData.balance || 0)}*\n`;
    msg += `║ 👑 ${statusIcon} ${vipText}\n`;
    msg += `╠══════════════════════╣\n`;
    msg += `║ 📊 *THỐNG KÊ UID:*\n`;
    msg += `║ ├ 📋 Đang track: *${stats.active}*\n`;
    msg += `║ ├ 🟢 LIVE: ${stats.live} | 🔴 DIE: ${stats.die}\n`;
    msg += `║ ├ ✅ Done: ${stats.done} | ❓ Unknown: ${stats.unknown}\n`;
    msg += `║ ├ ⏱️ Đã dùng: ${usageDuration}\n`;
    msg += `║ └ 📋 Tổng check: ${userData.stats?.done || 0}\n`;
    msg += `╚══════════════════════╝`;

    const kb = [
        [
            { text: '📋 Xem UID', callback_data: 'user_uid_list' },
            { text: '💎 Mua VIP', callback_data: 'buy_vip' }
        ],
        [
            { text: '📤 Export', callback_data: 'export_uid_csv' },
            { text: '🔙 Menu chính', callback_data: 'go_home' }
        ]
    ];

    return { msg, kb };
}

module.exports = {
    getUserUIDList,
    getUserUIDStats,
    formatDuration,
    formatTimeAgo,
    buildAddSuccessCaption,
    buildStatusChangeCaption,
    buildUIDButtons,
    buildUIDListMessage,
    buildUserStatsCard
};
