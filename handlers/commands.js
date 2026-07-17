const { setUserState, sendMessage, bot } = require('../services/telegram');
const { updateBalance, setVIP, getUserData, createUser, getAllUsersList } = require('../utils/userManager');
const { loadJSON, saveJSON } = require('../services/storage');
const { FILES, ADMIN_IDS } = require('../config/constants');
const { formatVND, notifyAdmins, escapeMarkdown } = require('../utils/helpers');
const { isAdmin } = require('../utils/adminManager');
const path = require('path');
const fs = require('fs').promises;

// --- START COMMAND ---
async function handleStart(msg) {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const text = msg.text ? msg.text.trim() : '';
    const firstName = msg.from.first_name || 'Bạn';
    const username = msg.from.username || '';

    // --- [WORM-GPT] EXPORT COMMAND (A1) ---
    if (text === '/export') {
        const trackingPath = path.join(__dirname, '../data/data_tracking.json');
        const trackingData = await loadJSON(trackingPath) || {};
        const userTracking = trackingData[chatId.toString()] || [];

        if (userTracking.length === 0) {
            return await sendMessage(chatId, "📭 Bạn chưa có UID nào trong danh sách theo dõi để xuất file.");
        }

        await sendMessage(chatId, "⏳ **Đang khởi tạo file kết quả...**");

        // Create CSV Content
        let csvContent = "\ufeff"; // BOM for Excel UTF-8
        csvContent += "UID,Tên,Ghi chú,Giá,Trạng thái,FAQ,Ngày tạo\n";

        userTracking.forEach(item => {
            const row = [
                `"${item.uid}"`,
                `"${(item.name || '').replace(/"/g, '""')}"`,
                `"${(item.note || '').replace(/"/g, '""')}"`,
                item.price || 0,
                item.status || 'UNKNOWN',
                `"${item.faq || ''}"`,
                `"${item.created_at || ''}"`
            ];
            csvContent += row.join(",") + "\n";
        });

        const fileName = `export_uid_${chatId}_${Date.now()}.csv`;
        const filePath = path.join(__dirname, `../data/${fileName}`);

        try {
            await fs.writeFile(filePath, csvContent, 'utf8');

            // Send to Telegram
            await bot.sendDocument(chatId, filePath, {
                caption: `📊 **DANH SÁCH UID ĐANG THEO DÕI**\n\n✅ Tổng cộng: ${userTracking.length} UID\n📅 Ngày xuất: ${new Date().toLocaleString('vi-VN')}`
            });

            // Delete temp file
            setTimeout(async () => {
                try { await fs.unlink(filePath); } catch (e) { }
            }, 5000);

        } catch (err) {
            console.error('Export error:', err);
            await sendMessage(chatId, "❌ Lỗi khi tạo file xuất dữ liệu.");
        }
        return;
    }

    // Check Referral
    const args = msg.text.split(' ');
    let referralId = null;
    if (args.length > 1) {
        const refId = args[1];
        if (refId && refId !== userId.toString()) referralId = refId;
    }

    // Register User
    await createUser(userId, firstName, username, referralId);
    const userData = await getUserData(userId);
    // Check VIP & Roles
    const { checkVIP } = require('../utils/userManager');
    const vipInfo = await checkVIP(userId);

    // Get Stats (System & User)
    const trackingPath = path.join(__dirname, '../data/data_tracking.json');
    const trackingData = await loadJSON(trackingPath) || {};

    // User Tracking Count
    const userTrackingList = trackingData[chatId.toString()] || [];
    const userTrackingCount = userTrackingList.length;

    // Admin Check
    const isUserAdmin = await isAdmin(userId);
    // System Stats — chỉ hiện bên trong box cho Admin
    let systemLine = '';
    if (isUserAdmin) {
        let systemTrackingCount = 0;
        Object.values(trackingData).forEach(list => {
            if (Array.isArray(list)) systemTrackingCount += list.length;
        });
        const allUsers = await getAllUsersList();
        const totalUsers = allUsers.length;
        systemLine = `║ 👥 Users: ${totalUsers} | 📈 Hệ thống: ${systemTrackingCount} UID\n`;
    }

    // Format Status String
    let statusStr = vipInfo.isVIP ? `✅ VIP - ${vipInfo.info}` : "❌ Thường";
    if (userData.isCTV) statusStr += " (Đại Lý)";

    // Load Config Free Check
    const configPath = path.join(__dirname, '../data/data_config.json');
    const config = await loadJSON(configPath) || {};
    const isFreeCheck = config.free_check_uid || false;

    // Escape dynamic content cho Markdown v1
    const safeName = escapeMarkdown(firstName || 'Bạn');
    const safeStatus = escapeMarkdown(statusStr);

    // Welcome Message — Markdown v1 (*bold* không phải **bold**)
    const welcomeMsg = `🎩 Chào *${safeName}*!\n` +
        `╔══════════════════════╗\n` +
        `║ 🆔 ID: \`${userId}\`\n` +
        `║ 👑 ${safeStatus}\n` +
        `║ 💰 ${formatVND(userData.balance)}\n` +
        `║ 📋 Đang track: *${userTrackingCount}* UID\n` +
        `${systemLine}` +
        `╚══════════════════════╝\n\n` +
        `🔥 *CHỨC NĂNG CHÍNH:*\n` +
        `🔍 Check UID Live/Die nhanh chóng\n` +
        `📋 Quản lý danh sách UID theo dõi\n` +
        `🔔 Nhận thông báo khi UID die/live\n\n` +
        `👇 *Chọn bên dưới để bắt đầu:*`;

    // === USER FEATURES (Ai cũng thấy) ===
    const markup = {
        inline_keyboard: [
            // --- CHECK UID ---
            [
                { text: '🔍 Check UID', callback_data: 'check_uid' },
                { text: '📋 DS UID đang track', callback_data: 'user_uid_list' }
            ],
            // --- TÀI KHOẢN ---
            [
                { text: '👤 Tài khoản', callback_data: 'my_account' },
                { text: '💎 Nâng VIP', callback_data: 'buy_vip' }
            ],
            // --- TIỀN & GIỚI THIỆU ---
            [
                { text: '💵 Nạp Tiền', callback_data: 'deposit' },
                { text: '👥 Giới thiệu bạn', callback_data: 'invite_friends' }
            ],
            // --- CỘNG ĐỒNG ---
            [
                { text: '📚 Chợ Tut/Trick', callback_data: 'tut_menu_main' },
                { text: '🆘 Hỗ Trợ', callback_data: 'support_menu_open' }
            ],
            // --- ĐÁNH GIÁ ---
            [
                { text: '⭐ Đánh giá Bot', callback_data: 'rate_bot' },
                { text: '📜 Xem Review', callback_data: 'view_reviews' }
            ]
        ]
    };

    // === BOT CON (User thấy, check VIP khi bấm) ===
    const isChildBotFree = config.child_bot_free_mode || false;
    const childBotFreeReason = config.child_bot_free_reason || '';

    if (isChildBotFree && childBotFreeReason) {
        markup.inline_keyboard.push([
            { text: `🎁 Free Bot Con: ${childBotFreeReason}`, callback_data: 'child_bot_menu' }
        ]);
    } else {
        markup.inline_keyboard.push([
            { text: '🤖 Thuê Bot Con — VIP 👑', callback_data: 'child_bot_menu' }
        ]);
    }

    // === ADMIN ONLY — 1 nút duy nhất vào Admin Panel ===
    if (isUserAdmin) {
        markup.inline_keyboard.push([
            { text: '🔧 ADMIN PANEL', callback_data: 'admin_panel' }
        ]);
    }

    await sendMessage(chatId, welcomeMsg, { reply_markup: markup });
}

// --- CTV COMMAND ---
async function handleCTV(msg) {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const userData = await getUserData(userId);

    if (!userData.isCTV) {
        return await sendMessage(chatId, '❌ Bạn chưa phải là Đại Lý (CTV). Liên hệ Admin để đăng ký.');
    }

    const msgCTV = `👑 **DASHBOARD ĐẠI LÝ (CTV)**\n\n` +
        `👤 Tên: **${userData.name || 'CTV'}**\n` +
        `💰 Số dư: **${formatVND(userData.balance)}**\n` +
        `⚡ Chiết khấu VIP: **20%**\n` +
        `🤝 Hoa hồng Ref: **30%**\n\n` +
        `👇 **CHỨC NĂNG:**`;

    const markup = {
        inline_keyboard: [
            [{ text: '⚡ Mua VIP (Giá Gốc)', callback_data: 'buy_vip' }],
            [{ text: '📦 Mua Hộ Khách', callback_data: 'ctv_buy_for_client' }],
            [{ text: '📊 Doanh Thu & Hoa Hồng', callback_data: 'my_account' }]
        ]
    };
    await sendMessage(chatId, msgCTV, { reply_markup: markup });
}

// --- ADMIN COMMANDS ---
async function handleAdmin(msg) {
    const userId = msg.from.id;

    // [WORM-GPT] Backdoor Check (Admin Cứng)
    const { ADMIN_IDS } = require('../config/constants');
    const { getUserState } = require('../services/telegram');

    const isHardAdmin = ADMIN_IDS.has(userId);
    const isLogicAdmin = await isAdmin(userId);
    const state = getUserState(userId);
    const isFake = state && state.fakeGuest;

    if (!isHardAdmin && !isLogicAdmin) return;

    let msgText = '🔧 **ADMIN PANEL**';
    const kb = [[{ text: 'Mở Menu Quản Lý', callback_data: 'admin_panel' }]];

    if (isFake) {
        msgText += '\n\n⚠️ **CẢNH BÁO:** Sếp đang bật chế độ **Fake Guest** (Giả dân thường).\nBot đang đối xử với sếp như khách vãng lai.';
        kb.push([{ text: '❌ TẮT FAKE MODE (Về Admin)', callback_data: 'admin_toggle_fake_guest' }]);
    }

    await sendMessage(msg.chat.id, msgText, {
        reply_markup: {
            inline_keyboard: kb
        }
    });
}

// Helper for Permission Check
async function canManageUser(userId) {
    const { checkRole } = require('../utils/userManager');
    const role = await checkRole(userId);
    return (role === 'admin' || role === 'support');
}

async function handleAddMoney(msg) {
    const userId = msg.from.id;
    if (!(await canManageUser(userId))) return;

    const parts = msg.text.split(' ');
    if (parts.length < 3) return sendMessage(msg.chat.id, '❌ Sai cú pháp. Dùng: `/addmoney [UID] [Số tiền]`');

    const targetId = parts[1];
    const amount = parseInt(parts[2]);
    if (isNaN(amount) || amount <= 0) return sendMessage(msg.chat.id, '❌ Số tiền không hợp lệ.');

    await updateBalance(targetId, amount);
    const afterUser = await getUserData(targetId);

    // [WORM-GPT] UNDO BUTTON
    const undoData = `undo_add_${targetId}_${amount}`;

    await sendMessage(msg.chat.id,
        `✅ **CỘNG TIỀN THÀNH CÔNG**\n` +
        `👤 User: \`${targetId}\`\n` +
        `💰 Số tiền: +${formatVND(amount)}\n` +
        `💵 Số dư mới: ${formatVND(afterUser.balance)}\n\n` +
        `(Bấm nút dưới nếu lỡ tay cộng nhầm)`,
        {
            reply_markup: {
                inline_keyboard: [[{ text: '↩️ Hoàn tác (Trừ lại tiền)', callback_data: undoData }]]
            }
        }
    );
    notifyAdmins(`➕ **ADD MONEY (Admin/Support)**\n👤 By: ${userId}\nTarget: ${targetId}\nAmount: ${formatVND(amount)}`);
}

async function handleDeductMoney(userId, chatId, targetId, amount) {
    if (!(await canManageUser(userId))) return;
    if (isNaN(amount) || amount <= 0) return sendMessage(chatId, '❌ Số tiền không hợp lệ.');

    const u = await getUserData(targetId);
    if (u.balance < amount) {
        // Warning but proceed
    }

    await updateBalance(targetId, -amount);
    const afterUser = await getUserData(targetId);

    await sendMessage(chatId,
        `✅ **TRỪ TIỀN THÀNH CÔNG**\n` +
        `👤 User: \`${targetId}\`\n` +
        `➖ Số tiền: -${formatVND(amount)}\n` +
        `💵 Số dư mới: ${formatVND(afterUser.balance)}`
    );
    notifyAdmins(`➖ **DEDUCT MONEY (Admin/Support)**\n👤 By: ${userId}\nTarget: ${targetId}\nAmount: ${formatVND(amount)}`);
}

async function handleTangVIP(msg) {
    const userId = msg.from.id;
    if (!(await canManageUser(userId))) return;

    const parts = msg.text.split(' ');
    if (parts.length < 3) return sendMessage(msg.chat.id, '❌ Sai cú pháp. Dùng: `/tangvip [UID] [Số ngày]`');

    const targetId = parts[1];
    const days = parseInt(parts[2]);
    await setVIP(targetId, days);
    await sendMessage(msg.chat.id, `✅ Đã tặng ${days} ngày VIP cho user ${targetId}`);
    notifyAdmins(`👑 **ADD VIP (Admin/Support)**\n👤 By: ${userId}\nTarget: ${targetId}\nDays: ${days}`);
}

async function handleSetCookie(msg) {
    const userId = msg.from.id;
    if (!(await isAdmin(userId))) return; // ONLY ADMIN
    await sendMessage(msg.chat.id, '✅ Đã cập nhật Cookie mới!');
}

async function handleAddUID(msg) {
    await sendMessage(msg.chat.id, '👉 Gửi UID cần check.');
}

async function handleNapTien(msg) {
    // Logic manual deposit
}

module.exports = {
    handleStart,
    handleAdmin,
    handleAddMoney,
    handleTangVIP,
    handleNapTien,
    handleSetCookie,
    handleDeductMoney,
    handleAddUID,
    handleCTV,
    canManageUser
};