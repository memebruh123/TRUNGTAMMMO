const { createCode } = require('../utils/codeManager');
const { updateBalance, setVIP } = require('../utils/userManager');
const { saveJSON, loadJSON } = require('../services/storage');
const { FILES } = require('../config/constants');
const { formatVND } = require('../utils/helpers');

async function executeAdminCommand(cmdJson) {
    if (!cmdJson || !cmdJson.cmd) {
        return { success: false, message: "⚠️ AI không hiểu lệnh này." };
    }

    try {
        switch (cmdJson.cmd) {
            case 'create_code':
                return await handleCreateCode(cmdJson);

            case 'give_vip':
                return await handleGiveVIP(cmdJson);

            case 'remove_vip':
                return await handleRemoveVIP(cmdJson);

            case 'give_vip_all':
                return await handleGiveVIPAll(cmdJson);

            case 'add_money':
                return await handleAddMoney(cmdJson);

            case 'set_price_vip':
                return await handleSetPrice(cmdJson, 'vip_price_30d');

            case 'set_bank_info':
                return await handleSetBankInfo(cmdJson);

            case 'get_user_info':
                return await handleGetUserInfo(cmdJson);

            case 'view_stats':
                return await handleViewStats(cmdJson);

            default:
                return { success: false, message: `⚠️ Lệnh '${cmdJson.cmd}' chưa được hỗ trợ.\n👉 Gửi **UID hoặc Link** cần check vào đây để Bot xử lý.` };
        }
    } catch (err) {
        return { success: false, message: `❌ Lỗi thực thi: ${err.message}` };
    }
}

async function handleCreateCode(data) {
    // data: { code_name, code_type, value, max_uses, expiry_days, min_amount, reason }
    const entry = await createCode(
        data.code_name,
        data.code_type, // 'DISCOUNT', 'FREE_VIP', 'MONEY', 'BONUS_DAYS'
        data.value,
        data.max_uses || 999,
        data.expiry_days || 30,
        null, // expiry_date
        data.min_amount || 0
    );

    let msg = `✅ **ĐÃ TẠO CODE THÀNH CÔNG**\n\n`;
    msg += `🎟️ Code: \`${entry.code_name}\`\n`;
    msg += `📊 Loại: ${entry.code_type}\n`;
    msg += `💰 Giá trị: ${entry.value} ${entry.code_type === 'DISCOUNT' ? '%' : ''}\n`;
    msg += `🔢 Lượt dùng: ${entry.max_uses}\n`;
    msg += `📅 Hạn dùng: ${entry.expiry_days} ngày\n`;
    if (data.reason) msg += `📝 Note: ${data.reason}`;

    return { success: true, message: msg };
}

async function handleGiveVIP(data) {
    // data: { uid, days, reason }
    const days = parseInt(data.days);
    const uid = data.uid;

    if (!uid || isNaN(days)) return { success: false, message: "Thiếu UID hoặc số ngày." };

    const newExpiry = await setVIP(uid, days);
    const dateStr = new Date(newExpiry * 1000).toLocaleString('vi-VN');

    return {
        success: true,
        message: `✅ Đã tặng VIP ${days} ngày cho UID \`${uid}\`.\n📅 Hết hạn: ${dateStr}\n📝 Lý do: ${data.reason || 'None'}`,
        targetUid: uid,
        notifyMsg: `🎁 **BẠN ĐÃ ĐƯỢC TẶNG VIP!**\n\nThời hạn: ${days} ngày\nLý do: ${data.reason || 'Quà tặng từ Admin'}\nChúc bạn sử dụng vui vẻ!`
    };
}

async function handleRemoveVIP(data) {
    // data: { uid, reason }
    const uid = data.uid;
    if (!uid) return { success: false, message: "Thiếu UID." };

    await setVIP(uid, 0); // 0 days = remove VIP

    return {
        success: true,
        message: `✅ Đã xóa VIP của UID \`${uid}\`.`,
        targetUid: uid,
        notifyMsg: `⚠️ **THÔNG BÁO VIP**\n\nGói VIP của bạn đã bị thu hồi.\nLý do: ${data.reason || 'Hết hạn hoặc vi phạm'}`
    };
}

async function handleAddMoney(data) {
    // data: { uid, amount }
    const uid = data.uid;
    const amount = parseInt(data.amount);

    if (!uid || isNaN(amount)) return { success: false, message: "Thiếu UID hoặc số tiền." };

    const newBalance = await updateBalance(uid, amount);

    return {
        success: true,
        message: `✅ Đã cộng ${formatVND(amount)} cho UID \`${uid}\`.\n💰 Số dư mới: ${formatVND(newBalance)}`,
        targetUid: uid,
        notifyMsg: `💰 **BIẾN ĐỘNG SỐ DƯ**\n\nSố tiền: +${formatVND(amount)}\nSố dư mới: ${formatVND(newBalance)}\nNội dung: Admin cộng tiền`
    };
}

async function handleGiveVIPAll(data) {
    // data: { days, reason }
    // Hàm này cần chạy loop qua all_users, hơi nặng nên xử lý background sau
    return { success: false, message: "⚠️ Tính năng tặng VIP toàn server tạm khóa để bảo trì." };
}

async function handleSetPrice(data) {
    const config = await loadJSON(FILES.config);
    config.vip_price_30d = data.amount;
    await saveJSON(FILES.config, config);
    return { success: true, message: `✅ Đã cập nhật giá VIP 30 ngày: ${formatVND(data.amount)}` };
}

async function handleSetBankInfo(data) {
    const config = await loadJSON(FILES.config);
    config.bank_info = data.text;
    await saveJSON(FILES.config, config);
    return { success: true, message: `✅ Đã cập nhật thông tin Ngân hàng:\n${data.text}` };
}

async function handleGetUserInfo(data) {
    const { getUserData, checkVIP } = require('../utils/userManager');
    const uid = data.uid;
    if (!uid) return { success: false, message: "Thiếu UID cần tra cứu." };

    const uData = await getUserData(uid);
    const vipInfo = await checkVIP(uid);

    let msg = `👤 **THÔNG TIN USER: \`${uid}\`**\n━━━━━━━━━━━━━━━━━━━\n`;
    msg += `💰 Số dư: **${formatVND(uData.balance || 0)}**\n`;
    msg += `💎 Trạng thái: **${vipInfo.isVIP ? 'VIP' : 'Thường'}**\n`;
    if (vipInfo.isVIP) msg += `📅 Hết hạn: ${vipInfo.info}\n`;
    msg += `📊 Tổng check: ${uData.stats?.done || 0} UID\n`;
    msg += `🤝 Cộng tác viên: ${uData.isCTV ? '✅' : '❌'}\n`;

    return { success: true, message: msg };
}

async function handleViewStats(data) {
    const { getAllUsersList, getAdminRevenueStats } = require('../utils/userManager');
    const allUsers = await getAllUsersList();
    const revenue = await getAdminRevenueStats();

    let msg = `📊 **THỐNG KÊ HỆ THỐNG**\n━━━━━━━━━━━━━━━━━━━\n`;
    msg += `👥 Tổng User: **${allUsers.length}**\n`;
    msg += `📅 Doanh thu hôm nay: **${formatVND(revenue.today)}**\n`;
    msg += `💰 Tổng doanh thu: **${formatVND(revenue.total)}**\n`;

    return { success: true, message: msg };
}

module.exports = {
    executeAdminCommand
};
