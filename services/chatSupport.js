const { bot, sendMessage } = require('./telegram');
const { ADMIN_IDS } = require('../config/constants');

// Memory storage (Reset khi restart bot - chấp nhận được vì chat live)
let supportQueue = new Map(); // uid -> { name, time }
let activeChats = new Map();  // uid1 <-> uid2 (User <-> Admin)

// --- USER ACTIONS ---

async function requestSupport(userId, name) {
    const strUserId = userId.toString();
    if (activeChats.has(strUserId)) {
        return sendMessage(userId, '⚠️ Bạn đang trong cuộc trò chuyện với hỗ trợ viên.');
    }
    if (supportQueue.has(strUserId)) {
        return sendMessage(userId, '✅ Yêu cầu của bạn đang trong hàng chờ. Vui lòng đợi...');
    }

    // Add to queue
    supportQueue.set(strUserId, { name, time: Date.now() });

    // Notify User
    await sendMessage(userId, '👨‍💻 **YÊU CẦU HỖ TRỢ**\n\nĐã gửi yêu cầu! Vui lòng chờ Admin kết nối...\n_(Bạn có thể mô tả vấn đề trước tại đây)_');

    // Notify Admins (Use dynamic admin list)
    const { getAdmins } = require('../utils/adminManager');
    const admins = await getAdmins();

    if (admins.size === 0) {
        return sendMessage(userId, '⚠️ Hiện tại chưa có Admin nào online. Vui lòng thử lại sau!');
    }

    const adminMsg = `🆘 **YÊU CẦU HỖ TRỢ MỚI**\n\n👤 User: **${name}** (ID: \`${userId}\`)\n🕒 Lúc: ${new Date().toLocaleTimeString('vi-VN')}`;
    const markup = {
        inline_keyboard: [[{ text: '📞 Kết nối ngay', callback_data: `admin_connect_${userId}` }]]
    };

    for (const adminId of admins) {
        try { await sendMessage(adminId, adminMsg, { reply_markup: markup }); } catch (e) { }
    }
}

// --- ADMIN ACTIONS ---

async function connectChat(adminId, targetUserId) {
    const strTargetId = targetUserId.toString();
    const strAdminId = adminId.toString();

    if (!supportQueue.has(strTargetId)) {
        return sendMessage(adminId, '❌ User này không còn trong hàng chờ (Đã hủy hoặc disconnect).');
    }

    // Remove from queue
    const userInfo = supportQueue.get(strTargetId);
    supportQueue.delete(strTargetId);

    // Set active pair
    activeChats.set(strAdminId, strTargetId);
    activeChats.set(strTargetId, strAdminId);

    const endMarkup = {
        inline_keyboard: [[{ text: '❌ Kết thúc Chat', callback_data: 'end_support_chat' }]]
    };

    // Notify Admin
    await sendMessage(adminId, `✅ **ĐÃ KẾT NỐI**\n\nBạn đang chat với: **${userInfo.name}**\nStart chatting...`, { reply_markup: endMarkup });

    // Notify User
    await sendMessage(targetUserId, `👨‍💼 **SUPPORT CONNECTED**\n\nAdmin đã tham gia chat. Bạn có thể trao đổi ngay bây giờ!`, { reply_markup: endMarkup });
}

// --- COMMON ACTIONS ---

async function endChat(userId) {
    const strUserId = userId.toString();
    if (!activeChats.has(strUserId)) return;

    const partnerId = activeChats.get(strUserId);

    // Remove both
    activeChats.delete(strUserId);
    activeChats.delete(partnerId);

    await sendMessage(userId, '🛑 **Đã kết thúc cuộc trò chuyện.**');
    await sendMessage(partnerId, '🛑 **Đối phương đã rời cuộc trò chuyện.**');
}

// --- RELAY MESSAGE ---

async function handleSupportMessage(msg) {
    const senderId = msg.chat.id.toString();

    if (activeChats.has(senderId)) {
        const receiverId = activeChats.get(senderId);

        // Forward text
        if (msg.text) {
            const prefix = ADMIN_IDS.has(senderId) ? '👨‍💻 **Admin:** ' : '👤 **User:** ';
            await sendMessage(receiverId, `${prefix}${msg.text}`);
        }
        // Có thể mở rộng forward ảnh/video sau nếu cần
        return true; // Handled
    }
    return false; // Not handled
}

module.exports = {
    requestSupport,
    connectChat,
    endChat,
    handleSupportMessage
};
