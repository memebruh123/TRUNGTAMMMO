const {
    setUserState,
    getUserState,
    clearUserState,
    sendMessage,
    answerCallbackQuery,
    deleteMessage,
    editMessageText,
    bot,
    sendPhoto
} = require('../services/telegram');

const {
    updateBalance,
    setVIP,
    getUserData,
    getAllUsersList,
    checkVIP,
    updateUserStats,
    saveUserData,
    getAdminRevenueStats
} = require('../utils/userManager');

const { getRatingStats, getAllRatings } = require('../utils/ratingManager');
const { markDoneUID, removeTrackingUID, getTracking } = require('../utils/trackingManager');
const { requestSupport, connectChat, endChat } = require('../services/chatSupport');
const { formatVND, notifyAdmins, escapeMarkdown } = require('../utils/helpers');
const { ADMIN_IDS } = require('../config/constants');
const { loadJSON } = require('../services/storage');
const childBotManager = require('../childbot/manager');
const path = require('path');

async function handleCallbackQuery(query) {
    const chatId = query.message.chat.id;
    const userId = query.from.id;
    const data = query.data;

    // Check Admin Quyền (Dynamic)
    const { isAdmin, getAdmins, addAdmin, removeAdmin } = require('../utils/adminManager');
    const isUserAdmin = await isAdmin(userId);

    try {
        if (data === 'deposit') {
            await sendMessage(chatId, '💵 **NHẬP SỐ TIỀN CẦN NẠP:**\n\nVí dụ: Nhập `50000` để nạp 50k.');
            setUserState(userId, { mode: 'deposit', step: 'wait_amount' });
            await answerCallbackQuery(query.id);
        }
        else if (data === 'buy_vip') {
            const configPath = path.join(__dirname, '../data/data_config.json');
            const config = await loadJSON(configPath) || {};
            const basePrice = config.vip_price || 45000;

            const userData = await getUserData(userId);
            const balance = userData.balance || 0;
            const totalSpent = userData.stats?.total_spent || 0;
            const isLoyal = totalSpent > 0;

            let aiMessage = "";
            let specialOffer = null;

            // --- SMART SALES LOGIC ---
            // 1. LOGIC VÉT VÍ
            if (isLoyal && balance < basePrice && balance >= 30000) {
                specialOffer = { months: 1, price: balance, label: '🔥 Gói 1 Tháng (Vét Ví)', bonus: 0 };
                aiMessage = `👋 **Chào sếp!**\n\nVí sếp còn đúng **${formatVND(balance)}**. Tuy thiếu một chút so với giá gốc, nhưng vì sếp là **Khách Quen**...\n\n🤝 Em **FIX GIÁ** bán luôn cho sếp gói 1 tháng với giá **${formatVND(balance)}**. Chốt ngay!`;
            }
            // 2. LOGIC ĐẠI GIA
            else if (balance >= 500000) {
                const richPrice = 360000;
                specialOffer = { months: 12, price: richPrice, label: '👑 Gói 1 Năm (Đại Gia)', bonus: 0 };
                aiMessage = `🎩 **Chào "Sếp Lớn"!**\n\nVí sếp đang có **${formatVND(balance)}** - quá uy tín! 😎\n\nThay vì mua lẻ, em kính mời sếp **Gói 1 Năm** ưu đãi **GIẢM SỐC**.\n\n💰 Gốc: 400k → Giá Sếp: **${formatVND(richPrice)}**.\n(Tiết kiệm 40k)`;
            }
            // 3. LOGIC TRUNG LƯU
            else if (balance >= 120000) {
                const midPrice = 110000;
                specialOffer = { months: 3, price: midPrice, label: '🌟 Gói 3 Tháng (Ưu Đãi)', bonus: 5 };
                aiMessage = `👋 **Chào bạn!**\n\nSố dư: **${formatVND(balance)}**.\n\nSếp ơi, quất luôn **Gói 3 Tháng** đi! Em giảm thêm **10k** và tặng thêm **5 ngày** VIP nhé!`;
            }
            // 4. MẶC ĐỊNH
            else {
                aiMessage = `💎 **MUA GÓI VIP**\n\n💰 Số dư: **${formatVND(balance)}**\n\n👇 Chọn gói phù hợp bên dưới nhé!`;
            }

            // --- KIỂM TRA CTV (GIẢM GIÁ 20% GÓC MUA) ---
            if (userData.isCTV) {
                aiMessage += `\n\n🌟 **ĐẶC QUYỀN ĐẠI LÝ (CTV):**\nBạn được **GIẢM 20%** tất cả các gói (Giá hiển thị bên dưới đã giảm).`;
            }

            // --- RENDER KEYBOARD ---
            const keyboard = [];

            if (specialOffer) {
                let sPrice = specialOffer.price;
                if (userData.isCTV) sPrice = Math.floor(sPrice * 0.8);

                keyboard.push([{
                    text: `${specialOffer.label} | ${formatVND(sPrice)}`,
                    callback_data: `buy_vip_pkg_${specialOffer.months}_${sPrice}_${specialOffer.bonus}`
                }]);
            }

            const standardPackages = [
                { months: 1, label: 'Gói 1 Tháng', price: basePrice },
                { months: 3, label: 'Gói 3 Tháng', price: basePrice * 3 - 15000 },
                { months: 6, label: 'Gói 6 Tháng', price: basePrice * 6 - 45000 },
                { months: 12, label: 'Gói 1 Năm', price: 400000 }
            ];

            for (const pkg of standardPackages) {
                if (specialOffer && specialOffer.months === pkg.months) continue;

                let finalPkgPrice = pkg.price;
                let btnText = `${pkg.label} | ${formatVND(pkg.price)}`;

                // Áp dụng label giảm giá hiển thị
                if (pkg.months === 3) btnText = `Gói 3 Tháng (-15k) | ${formatVND(pkg.price)}`;
                if (pkg.months === 6) btnText = `Gói 6 Tháng (-45k) | ${formatVND(pkg.price)}`;
                if (pkg.months === 12) btnText = `Gói 1 Năm (-140k) | ${formatVND(pkg.price)}`;

                // Áp dụng giảm giá CTV
                if (userData.isCTV) {
                    finalPkgPrice = Math.floor(pkg.price * 0.8);
                    btnText = `${pkg.label} (-20%) | ${formatVND(finalPkgPrice)}`;
                }

                keyboard.push([{
                    text: btnText,
                    callback_data: `buy_vip_pkg_${pkg.months}_${finalPkgPrice}_0`
                }]);
            }

            if (balance < basePrice && !userData.isCTV && !specialOffer) {
                keyboard.push([{ text: '💵 Nạp Tiền Ngay', callback_data: 'deposit' }]);
                aiMessage += `\n\n*(Bạn thiếu ${formatVND(basePrice - balance)} để mua gói cơ bản)*`;
            }

            keyboard.push([{ text: '❌ Đóng', callback_data: 'close_panel' }]);

            await sendMessage(chatId, aiMessage, { reply_markup: { inline_keyboard: keyboard } });
            await answerCallbackQuery(query.id);
        }
        else if (data.startsWith('buy_vip_pkg_')) {
            const parts = data.split('_');
            const months = parseInt(parts[3]);
            const price = parseInt(parts[4]);
            const bonusDays = parseInt(parts[5] || 0);

            const userData = await getUserData(userId);

            if (userData.balance < price) {
                return await answerCallbackQuery(query.id, { text: '❌ Số dư không đủ! Vui lòng nạp thêm.', show_alert: true });
            }

            const newBal = await updateBalance(userId, -price);
            const totalDays = (months * 30) + bonusDays;
            const newExpiry = await setVIP(userId, totalDays);

            // LOG MUA VIP
            const userLink = query.from.username ? `@${escapeMarkdown(query.from.username)}` : `ID ${userId}`;
            notifyAdmins(`✅ **ĐÃ MUA VIP (DOANH THU)**\n▬▬▬▬▬▬▬▬▬▬▬▬\n👤 **User:** ${userLink}\n📦 **Gói:** ${months} Tháng ${bonusDays > 0 ? `(+${bonusDays} ngày)` : ''}\n💰 **Giá:** ${formatVND(price)}\n💳 **Số dư còn:** ${formatVND(newBal)}\n💎 **Hết hạn:** ${new Date(newExpiry * 1000).toLocaleDateString('vi-VN')}\n▬▬▬▬▬▬▬▬▬▬▬▬`);

            // AFFILIATE SYSTEM (Logic CTV: 30%)
            if (userData.referrer) {
                const configPath = path.join(__dirname, '../data/data_config.json');
                const config = await loadJSON(configPath) || {};
                let percent = config.ref_settings?.commission_percent || 10;

                // Check if referrer is CTV
                try {
                    const referrerData = await getUserData(userData.referrer);
                    if (referrerData && referrerData.isCTV) {
                        percent = 30; // CTV nhận 30%
                    }
                } catch (e) { }

                if (percent > 0) {
                    const commission = Math.floor(price * percent / 100);
                    if (commission > 0) {
                        await updateBalance(userData.referrer, commission);
                        try {
                            const ctvLabel = percent >= 30 ? "👑 (ĐẠI LÝ)" : "";
                            await sendMessage(userData.referrer, `💰 **NHẬN HOA HỒNG ${ctvLabel}!**\n\nF1 vừa mua gói VIP.\nBạn nhận được: +${formatVND(commission)} (${percent}%)\n\n👉 Mời thêm để nhận thêm!`);
                        } catch (e) { }

                        // ADMIN NOTIFY
                        notifyAdmins(`💸 **HOA HỒNG REF**\n\n👤 Nhận: \`${userData.referrer}\` (${percent}%)\n💰 Tiền: +${formatVND(commission)}\n🛒 Nguồn: F1 \`${userId}\` mua VIP`);
                    }
                }
            }

            const dateStr = new Date(newExpiry * 1000).toLocaleDateString('vi-VN');
            await sendMessage(chatId, `✅ **MUA VIP THÀNH CÔNG!**\n\n📅 Hạn dùng: ${dateStr}\n💰 Số dư còn lại: ${formatVND(newBal)}`);
            await answerCallbackQuery(query.id);
        }
        else if (data === 'request_md_appeal') {
            // REMOVED: Private feature (Request MDanh/Dame)
            await sendMessage(chatId, "⚠️ Tính năng này đã bị gỡ.");
            await answerCallbackQuery(query.id);
        }

        else if (data === 'tut_menu_main') {
            const { handleTutMenu } = require('./tuts');
            await handleTutMenu(chatId, userId);
            await answerCallbackQuery(query.id);
        }
        else if (data === 'tut_post_new') {
            const { startPostTut } = require('./tuts');
            await startPostTut(chatId, userId);
            await answerCallbackQuery(query.id);
        }
        else if (data === 'tut_list_view') {
            const { viewTutList } = require('./tuts');
            await viewTutList(chatId, userId, 0); // View Page 0
            await answerCallbackQuery(query.id);
        }
        else if (data.startsWith('tut_buy_')) {
            const tutId = data.split('_')[2];
            const { handleBuyTut } = require('./tuts');
            await handleBuyTut(chatId, userId, tutId);
            await answerCallbackQuery(query.id);
        }
        else if (data === 'tut_admin_approve') {
            // Admin Only
            const { handleAdminApprove } = require('./tuts');
            await handleAdminApprove(chatId, userId);
            await answerCallbackQuery(query.id);
        }
        else if (data.startsWith('tut_adm_ok_') || data.startsWith('tut_adm_no_') || data.startsWith('tut_adm_steal_')) {
            // Admin Action
            const parts = data.split('_');
            const action = parts[2]; // ok / no / steal
            const tutId = parts[3];

            const { handleAdminAction } = require('./tuts');
            await handleAdminAction(action, tutId, chatId);
            await answerCallbackQuery(query.id, { text: `Đã xử lý: ${action.toUpperCase()}`, show_alert: true });
        }
        else if (data === 'admin_toggle_free_check') {
            if (!isUserAdmin) return;

            // Check Current State but DO NOT toggle yet
            const cfgP = path.join(__dirname, '../data/data_config.json');
            const cfg = await loadJSON(cfgP) || {};
            const curState = cfg.free_check_uid || false;
            const action = curState ? 'ĐÓNG 🔒' : 'MỞ 🔓'; // Current=True -> Action=Close

            await sendMessage(chatId, `🔧 **QUẢN LÝ FREE CHECK**\n\n` +
                `Trạng thái hiện tại: **${curState ? 'ĐANG BẬT ✅' : 'ĐANG TẮT ❌'}**\n` +
                `Hành động sắp tới: **${action}**\n\n` +
                `👉 **Vui lòng nhập LÝ DO ${action} Free Check:**\n` +
                `(Ví dụ: Mừng sinh nhật sếp, Bảo trì hoàn tất, Hết hứng...)\n\n` +
                `🤖 *Bot sẽ dùng lý do này để "chém gió" và thông báo cho toàn bộ User!*`);

            await setUserState(userId, { mode: 'wait_reason_free_check', targetState: !curState });
            await answerCallbackQuery(query.id);
        }

        else if (data === 'admin_toggle_child_bot_free') {
            if (!isUserAdmin) return;

            const cfgP = path.join(__dirname, '../data/data_config.json');
            const cfg = await loadJSON(cfgP) || {};
            const curState = cfg.child_bot_free_mode || false;
            const action = curState ? 'ĐÓNG 🔒' : 'MỞ 🔓';

            await sendMessage(chatId, `🤖 **QUẢN LÝ FREE BOT CON**\n\n` +
                `Trạng thái hiện tại: **${curState ? 'ĐANG BẬT ✅' : 'ĐANG TẮT ❌'}**\n` +
                `Hành động sắp tới: **${action}**\n\n` +
                `👉 **Vui lòng nhập LÝ DO ${action} Free Bot Con:**\n` +
                `(Ví dụ: Mừng khai trương, Event cuối tuần...)\n\n` +
                `🤖 *Bot sẽ dùng lý do này để quảng cáo cho toàn bộ User!*`);

            await setUserState(userId, { mode: 'wait_reason_child_bot_free', targetState: !curState });
            await answerCallbackQuery(query.id);
        }

        else if (data === 'admin_send_notify_ai') {
            if (!isUserAdmin) return;
            await sendMessage(chatId, "📢 **GỬI THÔNG BÁO HỆ THỐNG**\n\n" +
                "Vui lòng gửi **MỘT HÌNH ẢNH** kèm **NỘI DUNG (Caption)** để làm thông báo.\n" +
                "🤖 Bot sẽ gửi hình ảnh này kèm nội dung đến **TOÀN BỘ** người dùng.\n\n" +
                "👉 **Gửi ảnh ngay (hoặc /cancel để hủy):**");

            await setUserState(userId, { mode: 'wait_notify_content' });
            await answerCallbackQuery(query.id);
        }
        else if (data === 'check_uid') {
            // --- [WORM-GPT] CHECK CONFIG FREE / VIP ---
            const configPath = path.join(__dirname, '../data/data_config.json');
            const config = await loadJSON(configPath) || {};

            // Nếu KHÔNG phải Free Mode -> Bắt buộc check VIP
            if (!config.free_check_uid) {
                const vip = await checkVIP(userId);
                if (!vip.isVIP) {
                    const msgVip = `❌ **BẢO TRÌ FREE CHECK**\n\n` +
                        `Hiện tại Server đang quá tải, tính năng Check UID tạm thời chỉ dành cho **Thành viên VIP**.\n` +
                        `👉 Vui lòng mua VIP để sử dụng ổn định 24/7!`;
                    const markup = {
                        inline_keyboard: [[{ text: '💎 Mua VIP Ngay', callback_data: 'buy_vip' }]]
                    };
                    await sendMessage(chatId, msgVip, { reply_markup: markup });
                    return await answerCallbackQuery(query.id);
                }
            }

            const msgHelp = '🔍 **CHECK UID FACEBOOK**\n\n' +
                '➕ **Để thêm UID theo dõi, vui lòng dùng cú pháp:**\n\n' +
                '`/add [UID/Link] | [Tên] | [Note] | [Giá]`\n\n' +
                '📌 **Ví dụ:**\n`/add 100012345678 | Khách A | 50k`\n' +
                '`/add facebook.com/profile.php?id=1000... | Khách B | 100k`\n\n' +
                '⚠️ **Lưu ý:** Bot không nhận diện UID nếu chỉ gửi số hoặc link trực tiếp.';

            await sendMessage(chatId, msgHelp);
            setUserState(userId, { mode: 'check_uid' });

            await answerCallbackQuery(query.id);
        }
        else if (data === 'my_account') {
            const userData = await getUserData(userId);
            const vipInfo = await checkVIP(userId);

            // --- [WORM-GPT v2] STATS CARD ĐẸP ---
            const { buildUserStatsCard } = require('../utils/userDashboard');
            const { msg, kb } = await buildUserStatsCard(userId, userData, vipInfo);

            await sendMessage(chatId, msg, { reply_markup: { inline_keyboard: kb } });
            await answerCallbackQuery(query.id);
        }
        else if (data === 'invite_friends') {
            const botInfo = await bot.getMe();
            const botName = botInfo.username;

            const configPath = path.join(__dirname, '../data/data_config.json');
            const config = await loadJSON(configPath) || {};
            const refBonus = config.ref_settings?.reward || "1 VIP Day";
            const refPercent = config.ref_settings?.commission_percent || 10;

            const inviteMsg = `👥 **INVITE FRIENDS**\n\n` +
                `✅ Mời 1 bạn: Nhận ngay **+${refBonus}**\n` +
                `✅ Hoa Hồng: **+${refPercent}% trọn đời** (khi họ Mua VIP)\n\n` +
                `👇 **CHẠM VÀO DÒNG DƯỚI ĐỂ COPY:**`;

            const seedText = `Bot Check Live/Die Free bao mượt! Húp lẹ ae ơi 🔥\nhttps://t.me/${botName}?start=${userId}`;

            await sendMessage(chatId, inviteMsg);
            await sendMessage(chatId, `\`${seedText}\``, { parse_mode: 'Markdown' });
            await answerCallbackQuery(query.id);
        }

        else if (data.startsWith('admin_connect_')) {
            if (!isUserAdmin) return;
            const targetId = data.split('_')[2];
            await connectChat(userId, targetId);
            await answerCallbackQuery(query.id);
        }
        else if (data === 'end_support_chat') {
            await endChat(userId);
            await answerCallbackQuery(query.id);
        }
        else if (data === 'admin_panel') {
            const { canManageUser } = require('./commands');
            if (!(await canManageUser(userId))) return;

            const rows = [
                [
                    { text: '👥 Quản lý User', callback_data: 'admin_manage_users' },
                    { text: '📋 Hàng chờ Support', callback_data: 'admin_view_queue' }
                ],
                [
                    { text: '📢 Gửi thông báo', callback_data: 'admin_broadcast_menu' },
                    { text: '📊 Doanh thu', callback_data: 'admin_stats_revenue' }
                ],
                [
                    { text: '➕ Cộng tiền', callback_data: 'admin_add_money' },
                    { text: '➖ Trừ tiền', callback_data: 'admin_deduct_menu' }
                ]
            ];

            if (isUserAdmin) {
                rows.push([
                    { text: '👮 QL Admin', callback_data: 'admin_manage_admins' },
                    { text: '🤝 QL Đại Lý (CTV)', callback_data: 'admin_manage_ctv' }
                ]);
                rows.push([
                    { text: '⚙️ Cấu hình Ref', callback_data: 'admin_ref_settings' },
                    { text: '🛡️ QL Phân Quyền', callback_data: 'admin_manage_roles' }
                ]);
                rows.push([
                    { text: '📡 Quản lý Proxy', callback_data: 'admin_proxy_menu' },
                    { text: '🎭 Toggle Fake Guest', callback_data: 'admin_toggle_fake_guest' }
                ]);
                rows.push([
                    { text: '🔕 Smart Log', callback_data: 'admin_log_level_menu' },
                    { text: '📊 Xem Report', callback_data: 'admin_force_report' }
                ]);
                rows.push([
                    { text: '💾 Backup Ngay', callback_data: 'admin_backup_now' },
                    { text: 'ℹ️ Hướng dẫn Lệnh', callback_data: 'admin_help_guide' }
                ]);
            } else {
                rows.push([
                    { text: 'ℹ️ Hướng dẫn Lệnh', callback_data: 'admin_help_guide' }
                ]);
            }

            const markup = { inline_keyboard: rows };
            const roleTitle = isUserAdmin ? 'ADMIN (Full Access)' : 'SUPPORT (Limited)';
            await sendMessage(chatId, `🔧 **PANEL QUẢN TRỊ (${roleTitle})**`, { reply_markup: markup });
            await answerCallbackQuery(query.id);
        }
        else if (data === 'admin_manage_roles') {
            if (!isUserAdmin) return;
            await sendMessage(chatId, '🛡️ **QUẢN LÝ PHÂN QUYỀN (SUPPORT)**\n\n' +
                'Chọn tác vụ:', {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '➕ Chọn từ List User', callback_data: 'admin_add_support_list' }],
                        [{ text: '📝 Nhập ID thủ công', callback_data: 'admin_add_support' }],
                        [{ text: '➖ Danh sách Support (Gỡ)', callback_data: 'admin_list_support' }],
                        [{ text: '🔙 Quay lại', callback_data: 'admin_panel' }]
                    ]
                }
            });
            await answerCallbackQuery(query.id);
        }
        else if (data === 'admin_add_support_list') {
            const allIds = await getAllUsersList();
            const recentIds = allIds.slice(-10).reverse();

            const keys = [];
            for (const uid of recentIds) {
                const u = await getUserData(uid);
                if (!u.isSupport && !u.isAdmin) {
                    const name = u.username ? `@${u.username}` : (u.name || `UID ${uid}`);
                    keys.push([{ text: `➕ ${name}`, callback_data: `admin_do_add_supp_${uid}` }]);
                }
            }
            keys.push([{ text: '🔙 Quay lại', callback_data: 'admin_manage_roles' }]);

            await sendMessage(chatId, '📜 **CHỌN USER CẤP QUYỀN:**\n(Hiển thị 10 người mới nhất)', {
                reply_markup: { inline_keyboard: keys }
            });
            await answerCallbackQuery(query.id);
        }
        else if (data === 'admin_list_support') {
            const allIds = await getAllUsersList();
            const keys = [];
            let count = 0;

            for (const uid of allIds) {
                const u = await getUserData(uid);
                if (u.isSupport) {
                    const name = u.username ? `@${u.username}` : (u.name || `UID ${uid}`);
                    keys.push([{ text: `❌ Gỡ: ${name}`, callback_data: `admin_do_remove_supp_${uid}` }]);
                    count++;
                }
            }

            if (count === 0) keys.push([{ text: '(Chưa có Support nào)', callback_data: 'noop' }]);
            keys.push([{ text: '🔙 Quay lại', callback_data: 'admin_manage_roles' }]);

            await sendMessage(chatId, `📜 **DANH SÁCH SUPPORT HIỆN TẠI (${count})**`, {
                reply_markup: { inline_keyboard: keys }
            });
            await answerCallbackQuery(query.id);
        }
        else if (data.startsWith('admin_do_add_supp_')) {
            const targetId = data.split('_')[4];
            const { setSupport } = require('../utils/userManager');
            await setSupport(targetId, true);
            await sendMessage(chatId, `✅ **Đã set quyền Support cho:** \`${targetId}\``);
            await answerCallbackQuery(query.id);
        }
        else if (data.startsWith('admin_do_remove_supp_')) {
            const targetId = data.split('_')[4];
            const { setSupport } = require('../utils/userManager');
            await setSupport(targetId, false);
            await sendMessage(chatId, `✅ **Đã GỠ quyền Support của:** \`${targetId}\``);
            await answerCallbackQuery(query.id);
        }
        else if (data === 'admin_add_support') {
            await sendMessage(chatId, '🛡️ **GỬI ID ĐỂ SET QUYỀN SUPPORT:**', {
                reply_markup: { inline_keyboard: [[{ text: '❌ Hủy / Quay lại', callback_data: 'close_panel' }]] }
            });
            setUserState(userId, { mode: 'add_support_id' });
            await answerCallbackQuery(query.id);
        }
        else if (data === 'admin_remove_support') {
            await sendMessage(chatId, '🛡️ **GỬI ID ĐỂ GỠ QUYỀN SUPPORT:**');
            setUserState(userId, { mode: 'remove_support_id' });
            await answerCallbackQuery(query.id);
        }
        else if (data === 'admin_manage_admins') {
            if (!isUserAdmin) return;
            const admins = await getAdmins();
            let msg = `👮 **DANH SÁCH ADMIN (${admins.size})**\n\n`;

            for (const id of admins) {
                const u = await getUserData(id);
                const name = u.username ? `@${u.username}` : (u.name || `UID ${id}`);
                msg += `👤 **${name}** (\`${id}\`)\n`;
            }

            const markup = { inline_keyboard: [[{ text: '➕ Thêm Admin', callback_data: 'admin_add_new_admin' }], [{ text: '➖ Xóa Admin', callback_data: 'admin_remove_admin_menu' }], [{ text: '🔙 Back', callback_data: 'admin_panel' }]] };
            await sendMessage(chatId, msg, { reply_markup: markup });
            await answerCallbackQuery(query.id);
        }
        else if (data === 'admin_add_new_admin') {
            await sendMessage(chatId, '👮 **GỬI ID ĐỂ SET ADMIN:**', {
                reply_markup: { inline_keyboard: [[{ text: '❌ Hủy / Quay lại', callback_data: 'close_panel' }]] }
            });
            setUserState(userId, { mode: 'add_admin_id' });
            await answerCallbackQuery(query.id);
        }
        else if (data === 'admin_remove_admin_menu') {
            const admins = await getAdmins();
            const keyb = [];

            for (const id of admins) {
                const u = await getUserData(id);
                const name = u.username ? `@${u.username}` : (u.name || id);
                const btnText = `❌ Xóa: ${name.substring(0, 15)}`;
                keyb.push([{ text: btnText, callback_data: `admin_del_auth_${id}` }]);
            }

            keyb.push([{ text: '🔙 Quay lại', callback_data: 'admin_manage_admins' }]);
            await sendMessage(chatId, '🔻 **CHỌN ADMIN CẦN XÓA:**', { reply_markup: { inline_keyboard: keyb } });
            await answerCallbackQuery(query.id);
        }
        else if (data.startsWith('admin_del_auth_')) {
            const target = data.split('_')[3];
            const res = await removeAdmin(target);
            if (res === 'HARD_CODED') await answerCallbackQuery(query.id, { text: 'Admin cứng ko xóa dc', show_alert: true });
            else { await sendMessage(chatId, `Đã xóa admin ${target}`); await answerCallbackQuery(query.id, { text: 'Done' }); }
        }
        else if (data === 'admin_manage_ctv') {
            if (!isUserAdmin) return;
            await sendMessage(chatId, '🤝 **QUẢN LÝ ĐẠI LÝ (CTV)**\n\nĐại lý sẽ được hưởng:\n- Hoa hồng ref: **30%** (User thường: 10%)\n- Mua VIP giảm: **20%**\n\nChọn chức năng:', {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '➕ Thêm CTV', callback_data: 'admin_add_ctv' }],
                        [{ text: '➖ Xóa CTV', callback_data: 'admin_remove_ctv' }],
                        [{ text: '🔙 Quay lại', callback_data: 'admin_panel' }]
                    ]
                }
            });
            await answerCallbackQuery(query.id);
        }
        else if (data === 'admin_add_ctv') {
            await sendMessage(chatId, '🤝 **GỬI ID ĐỂ SET CTV:**\n\n(Người này sẽ trở thành Đại Lý)', {
                reply_markup: { inline_keyboard: [[{ text: '❌ Hủy / Quay lại', callback_data: 'close_panel' }]] }
            });
            setUserState(userId, { mode: 'add_ctv_id' });
            await answerCallbackQuery(query.id);
        }
        else if (data === 'admin_remove_ctv') {
            await sendMessage(chatId, '🤝 **GỬI ID CẦN XÓA CTV:**\n\n(Người này sẽ về User thường)');
            setUserState(userId, { mode: 'remove_ctv_id' });
            await answerCallbackQuery(query.id);
        }
        else if (data === 'admin_broadcast_menu') {
            if (!isUserAdmin) return;
            const markup = { inline_keyboard: [[{ text: '📢 Thông báo thường', callback_data: 'admin_broadcast_normal' }], [{ text: '🤖 Thông báo AI', callback_data: 'admin_broadcast_ai' }], [{ text: '🔙 Quay lại', callback_data: 'admin_panel' }]] };
            await sendMessage(chatId, '📢 **CHỌN LOẠI THÔNG BÁO:**', { reply_markup: markup });
            await answerCallbackQuery(query.id);
        }
        else if (data === 'confirm_broadcast_ai_send') {
            const userState = getUserState(userId);
            if (!userState || !userState.temp_broadcast) return await answerCallbackQuery(query.id, { text: 'Hết phiên' });

            const { content, photo } = userState.temp_broadcast;
            await editMessageText('⏳ Sending...', chatId, query.message.message_id);

            const allUsers = await getAllUsersList();
            let sent = 0, fail = 0, paidU = 0, vipU = 0;
            for (const uid of allUsers) {
                try {
                    if (photo) await sendPhoto(uid, photo, { caption: content });
                    else await sendMessage(uid, content);
                    sent++;

                    try {
                        const u = await getUserData(uid);
                        if (u.stats?.total_spent > 0) paidU++;
                        const vip = await checkVIP(uid);
                        if (vip.isVIP) vipU++;
                    } catch (e) { }

                } catch (e) { fail++; }
                await new Promise(r => setTimeout(r, 50));
            }

            const report = `📊 **BÁO CÁO BROADCAST**\n✅ Gửi: ${sent}\n❌ Fail: ${fail}\n💎 VIP: ${vipU}\n💵 Paid: ${paidU}`;
            await sendMessage(chatId, report);
            notifyAdmins(report);
            clearUserState(userId);
            await answerCallbackQuery(query.id);
        }
        else if (data === 'confirm_broadcast_ai_cancel') {
            await deleteMessage(chatId, query.message.message_id);
            await sendMessage(chatId, '❌ Cancelled');
            await answerCallbackQuery(query.id);
        }
        else if (data === 'admin_broadcast_normal') {
            if (!isUserAdmin) return;
            sendMessage(chatId, 'Gửi content:');
            setUserState(userId, { mode: 'broadcast_normal', step: 'wait_content' });
            answerCallbackQuery(query.id);
        }
        else if (data === 'admin_broadcast_ai') {
            if (!isUserAdmin) return;
            sendMessage(chatId, 'Gửi content AI sửa:');
            setUserState(userId, { mode: 'broadcast_ai', step: 'wait_content' });
            answerCallbackQuery(query.id);
        }
        else if (data.startsWith('admin_approve_deposit_')) {
            if (!isUserAdmin) return;
            const parts = data.split('_');
            const targetId = parts[3];
            const amount = parseInt(parts[4]);
            await updateBalance(targetId, amount);
            await editMessageText(`✅ Duyệt nạp ${formatVND(amount)} - ${targetId}`, chatId, query.message.message_id);
            await sendMessage(targetId, `✅ Nạp ${formatVND(amount)} thành công!`);
            notifyAdmins(`✅ Admin ${userId} duyệt nạp ${formatVND(amount)} cho ${targetId}`);
            answerCallbackQuery(query.id);
        }
        else if (data.startsWith('cancel_deposit_')) {
            if (!isUserAdmin) return;
            const targetId = data.split('_')[2];
            await editMessageText(`❌ Đã TỪ CHỐI nạp tiền của UID \`${targetId}\``, chatId, query.message.message_id);
            await sendMessage(targetId, `❌ **THÔNG BÁO NẠP TIỀN**\n\nYêu cầu nạp tiền của bạn đã bị Admin **TỪ CHỐI**.\nVui lòng kiểm tra lại nội dung chuyển khoản hoặc liên hệ Support.`);
            await answerCallbackQuery(query.id);
        }
        else if (data === 'admin_stats_revenue') {
            if (!isUserAdmin) return;
            const stats = await getAdminRevenueStats();
            await sendMessage(chatId, `📊 **DOANH THU HỆ THỐNG**\n\n📅 Hôm nay: **${formatVND(stats.today)}**\n💰 Tổng cộng: **${formatVND(stats.total)}**`);
            await answerCallbackQuery(query.id);
        }
        else if (data === 'admin_manage_users') {
            if (!isUserAdmin) return;
            const { getMemberStats } = require('../utils/userManager');
            const stats = await getMemberStats();

            await sendMessage(chatId, `👥 **THỐNG KÊ THÀNH VIÊN**\n\n` +
                `👤 Tổng user: **${stats.total}**\n` +
                `🆕 Mới hôm nay: **${stats.newToday}**\n` +
                `💎 VIP Active: **${stats.vips}**\n` +
                `👑 Đại lý (CTV): **${stats.ctvs}**\n\n` +
                `👇 Chọn chức năng:`, {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '🔎 Tra Ticket (UID)', callback_data: 'admin_ask_uid_ticket' }]
                    ]
                }
            });
            await answerCallbackQuery(query.id);
        }
        else if (data === 'admin_ask_uid_ticket') {
            await sendMessage(chatId, "🔎 **TRA CỨU LỊCH SỬ SUPPORT**\n\nNhập UID người dùng cần xem:");
            setUserState(userId, { mode: 'admin_view_tickets_input' });
            await answerCallbackQuery(query.id);
        }
        else if (data === 'confirm_startup_broadcast') {
            if (!isUserAdmin) return;
            await editMessageText('⏳ Đang gửi thông báo System Online...', chatId, query.message.message_id);
            const allUsers = await getAllUsersList();
            let count = 0;
            const msg = `🚀 **BOT ĐÃ ONLINE TRỞ LẠI!**\n\n⏰ Time: ${new Date().toLocaleString('vi-VN')}\n✅ Hệ thống hoạt động bình thường.\n\n👉 Check UID / Mua VIP ngay!`;
            for (const u of allUsers) { try { await sendMessage(u, msg); count++; } catch (e) { } await new Promise(r => setTimeout(r, 30)); }
            await sendMessage(chatId, `✅ Đã gửi cho **${count}** người.`);
            await answerCallbackQuery(query.id);
        }
        else if (data === 'view_reviews') {
            await sendMessage(chatId, '📜 **REVIEW TỪ KHÁCH HÀNG**\n\n(Hiện chưa có review nào được public)\n\n⭐️ Hãy dùng thử và để lại đánh giá nhé!');
            await answerCallbackQuery(query.id);
        }
        else if (data === 'rate_bot') {
            await sendMessage(chatId, '⭐️ **ĐÁNH GIÁ BOT**\n\nBạn cảm thấy Bot thế nào? Hãy gửi nội dung đánh giá (kèm số sao mong muốn, VD: "5 sao bot ngon") để Admin ghi nhận nhé!');
            setUserState(userId, { mode: 'rating', step: 'wait_message', stars: 5, user_name: query.from.first_name, role: 'customer' });
            await answerCallbackQuery(query.id);
        }
        else if (data === 'admin_add_money') {
            if (!isUserAdmin) return;
            await sendMessage(chatId, '➕ **CỘNG TIỀN USER**\n\nDùng lệnh: `/addmoney [UID] [Số tiền]`');
            await answerCallbackQuery(query.id);
        }
        else if (data === 'admin_deduct_menu') {
            if (!isUserAdmin) return;
            await sendMessage(chatId, '➖ **TRỪ TIỀN USER**\n\nNhập UID cần trừ tiền:');
            setUserState(userId, { mode: 'admin_deduct', step: 'wait_uid' });
            await answerCallbackQuery(query.id);
        }
        else if (data === 'admin_ref_settings') {
            if (!isUserAdmin) return;
            await sendMessage(chatId, '⚙️ **CẤU HÌNH REF**\n\n1. Set hoa hồng %: Gửi số (0-100)\n2. Set thưởng cố định: Gửi số tiền VNĐ\n\n(Chức năng đang hoàn thiện)');
            await answerCallbackQuery(query.id);
        }
        else if (data === 'admin_help_guide') {
            if (!isUserAdmin) return;
            await sendMessage(chatId, 'ℹ️ **HƯỚNG DẪN ADMIN**\n\n- /addmoney [UID] [Tiền]: Cộng tiền\n- /tangvip [UID] [Ngày]: Tặng VIP\n- Các chức năng khác dùng Menu.');
            await answerCallbackQuery(query.id);
        }
        else if (data === 'admin_toggle_fake_guest') {
            if (!ADMIN_IDS.has(userId) && !isUserAdmin) return;

            const s = getUserState(userId) || {};
            s.fakeGuest = !s.fakeGuest;
            await setUserState(userId, s);
            const status = s.fakeGuest ? '✅ ON (Đang giả làm Guest)' : '❌ OFF (Đã về Admin)';
            await answerCallbackQuery(query.id, { text: `Fake Guest Mode: ${status}`, show_alert: true });

            if (!s.fakeGuest) {
                await sendMessage(chatId, "🔧 **ADMIN MODE ACTIVATED**\nChào mừng Sếp trở lại!");
            }
        }
        else if (data === 'admin_view_queue') {
            if (!isUserAdmin) return;
            await sendMessage(chatId, '📋 **HÀNG CHỜ SUPPORT**\n\n(Trống)');
            await answerCallbackQuery(query.id);
        }
        else if (data === 'ctv_buy_for_client') {
            const userData = await getUserData(userId);
            if (!userData.isCTV) return await answerCallbackQuery(query.id, { text: 'Chỉ dành cho CTV', show_alert: true });
            await sendMessage(chatId, '📦 **MUA VIP HỘ KHÁCH (CTV)**\n\n👉 Nhập UID khách hàng muốn mua VIP:');
            await answerCallbackQuery(query.id);
        }
        // ========== [WORM-GPT v2] PROXY MANAGEMENT HANDLERS ==========
        else if (data === 'admin_proxy_menu') {
            if (!isUserAdmin) return;

            const { getProxyStatus } = require('../services/facebook');
            const status = await getProxyStatus();

            let msg = `📡 **QUẢN LÝ PROXY**\n`;
            msg += `━━━━━━━━━━━━━━━━━━━\n\n`;

            // Proxy Xoay Info
            msg += `🔄 **PROXY XOAY (ROTATING)**\n`;
            msg += `├ Trạng thái: ${status.xoay.enabled ? '🟢 BẬT' : '🔴 TẮT'}\n`;
            msg += `├ Key: \`${status.xoay.key}\`\n`;
            msg += `├ IP hiện tại: \`${status.xoay.currentIP}\`\n`;
            msg += `├ Lần xoay cuối: ${status.xoay.lastRotation}\n`;
            msg += `└ Hết hạn: ${status.xoay.expiration}\n\n`;

            // Static Proxy Info
            msg += `🌐 **PROXY TĨNH (STATIC)**\n`;
            msg += `├ Số lượng: ${status.static.count}\n`;
            if (status.static.count > 0) {
                status.static.list.forEach((p, i) => {
                    const masked = p.length > 20 ? p.substring(0, 20) + '...' : p;
                    msg += `├ ${i + 1}. \`${masked}\`\n`;
                });
            }
            msg += `\n`;

            msg += `📊 **Tổng: ${status.total} proxy đang hoạt động**\n\n`;
            msg += `━━━━━━━━━━━━━━━━━━━\n`;
            msg += `👇 **Chọn thao tác:**`;

            const kb = [
                [
                    { text: `🔄 Proxy Xoay: ${status.xoay.enabled ? 'ON ✅' : 'OFF ❌'}`, callback_data: 'proxy_toggle_xoay' }
                ],
                [
                    { text: '🔑 Đổi Key Xoay', callback_data: 'proxy_change_key' },
                    { text: '🧪 Test Proxy', callback_data: 'proxy_test' }
                ],
                [
                    { text: '➕ Thêm Proxy Tĩnh', callback_data: 'proxy_add_static' },
                    { text: '🗑️ Xóa Proxy Tĩnh', callback_data: 'proxy_remove_static' }
                ],
                [
                    { text: '🔃 Xóa Cache Proxy', callback_data: 'proxy_clear_cache' },
                    { text: '🔙 Quay lại', callback_data: 'admin_panel' }
                ]
            ];

            await sendMessage(chatId, msg, { reply_markup: { inline_keyboard: kb } });
            await answerCallbackQuery(query.id);
        }
        else if (data === 'proxy_toggle_xoay') {
            if (!isUserAdmin) return;

            const configPath = path.join(__dirname, '../data/data_config.json');
            const cfg = await loadJSON(configPath) || {};
            const curState = cfg.proxy_xoay_enabled !== false; // Default true
            cfg.proxy_xoay_enabled = !curState;
            await require('../services/storage').saveJSON(configPath, cfg);

            // Clear cache khi tắt
            if (!cfg.proxy_xoay_enabled) {
                const { clearProxyCache } = require('../services/facebook');
                await clearProxyCache();
            }

            const newState = cfg.proxy_xoay_enabled ? '🟢 BẬT' : '🔴 TẮT';
            await answerCallbackQuery(query.id, { text: `Proxy Xoay: ${newState}`, show_alert: true });
            // Refresh menu
            await sendMessage(chatId, `✅ Proxy Xoay đã ${newState}\n\n👉 Bấm "📡 Quản lý Proxy" để xem lại.`);
        }
        else if (data === 'proxy_change_key') {
            if (!isUserAdmin) return;

            await sendMessage(chatId, `🔑 **ĐỔI KEY PROXY XOAY**\n\n` +
                `Key hiện tại sẽ được thay bằng key mới.\n\n` +
                `👉 **Gửi KEY mới** (VD: \`tsOrebbSdwNHKajZriORjL\`)\n` +
                `Hoặc gõ \`/cancel\` để hủy.`, {
                reply_markup: { inline_keyboard: [[{ text: '❌ Hủy', callback_data: 'admin_proxy_menu' }]] }
            });

            setUserState(userId, { mode: 'proxy_change_key' });
            await answerCallbackQuery(query.id);
        }
        else if (data === 'proxy_test') {
            if (!isUserAdmin) return;

            await sendMessage(chatId, '🧪 **Đang test proxy...**');

            try {
                const { checkUIDLiveDie, getProxyStatus } = require('../services/facebook');
                const status = await getProxyStatus();

                // Test với UID Mark Zuckerberg (luôn LIVE)
                const testResult = await checkUIDLiveDie('4');

                let resultMsg = `🧪 **KẾT QUẢ TEST PROXY**\n\n`;
                resultMsg += `🎯 UID Test: \`4\` (Mark Zuckerberg)\n`;
                resultMsg += `📊 Kết quả: ${testResult.status === 'LIVE' ? '✅ LIVE (ĐÚNG)' : '❌ ' + testResult.status + ' (SAI!)'}\n`;
                resultMsg += `💬 Info: ${testResult.info}\n\n`;

                if (status.xoay.enabled && status.xoay.cachedProxy) {
                    resultMsg += `🔄 Proxy Xoay IP: \`${status.xoay.currentIP}\`\n`;
                }
                resultMsg += `📡 Tổng proxy: ${status.total}\n`;

                if (testResult.status === 'LIVE') {
                    resultMsg += `\n🎉 **Proxy hoạt động tốt!**`;
                } else {
                    resultMsg += `\n⚠️ **Cảnh báo: Proxy có thể bị block hoặc lỗi!**`;
                }

                await sendMessage(chatId, resultMsg, {
                    reply_markup: { inline_keyboard: [[{ text: '🔙 Quay lại Proxy Menu', callback_data: 'admin_proxy_menu' }]] }
                });
            } catch (err) {
                await sendMessage(chatId, `❌ Lỗi test: ${err.message}`);
            }

            await answerCallbackQuery(query.id);
        }
        else if (data === 'proxy_add_static') {
            if (!isUserAdmin) return;

            await sendMessage(chatId, `➕ **THÊM PROXY TĨNH**\n\n` +
                `Gửi proxy theo format:\n` +
                `\`http://user:pass@ip:port\`\n` +
                `hoặc\n` +
                `\`http://ip:port\`\n\n` +
                `👉 Gửi proxy hoặc \`/cancel\` để hủy.`, {
                reply_markup: { inline_keyboard: [[{ text: '❌ Hủy', callback_data: 'admin_proxy_menu' }]] }
            });

            setUserState(userId, { mode: 'proxy_add_static' });
            await answerCallbackQuery(query.id);
        }
        else if (data === 'proxy_remove_static') {
            if (!isUserAdmin) return;

            const { getProxyStatus } = require('../services/facebook');
            const status = await getProxyStatus();

            if (status.static.count === 0) {
                await sendMessage(chatId, '📭 Không có proxy tĩnh nào để xóa.');
                return await answerCallbackQuery(query.id);
            }

            const kb = status.static.list.map((p, i) => {
                const masked = p.length > 30 ? p.substring(0, 30) + '...' : p;
                // Encode proxy index
                return [{ text: `🗑️ ${masked}`, callback_data: `proxy_del_idx_${i}` }];
            });
            kb.push([{ text: '🔙 Quay lại', callback_data: 'admin_proxy_menu' }]);

            await sendMessage(chatId, '🗑️ **CHỌN PROXY CẦN XÓA:**', { reply_markup: { inline_keyboard: kb } });
            await answerCallbackQuery(query.id);
        }
        else if (data.startsWith('proxy_del_idx_')) {
            if (!isUserAdmin) return;

            const idx = parseInt(data.split('_')[3]);
            const { getProxyStatus, removeStaticProxy } = require('../services/facebook');
            const status = await getProxyStatus();

            if (idx >= 0 && idx < status.static.list.length) {
                const target = status.static.list[idx];
                const result = await removeStaticProxy(target);

                if (result.success) {
                    await sendMessage(chatId, `✅ Đã xóa proxy: \`${target}\``);
                } else {
                    await sendMessage(chatId, `❌ Lỗi: ${result.error}`);
                }
            } else {
                await sendMessage(chatId, '❌ Index không hợp lệ.');
            }

            await answerCallbackQuery(query.id);
        }
        else if (data === 'proxy_clear_cache') {
            if (!isUserAdmin) return;

            const { clearProxyCache } = require('../services/facebook');
            await clearProxyCache();

            await answerCallbackQuery(query.id, { text: '✅ Đã xóa cache proxy! Vòng check tiếp sẽ lấy IP mới.', show_alert: true });
            await sendMessage(chatId, '🔃 **Cache Proxy đã được reset.**\n\nVòng check tiếp theo sẽ:\n- Xoay IP mới (nếu bật Proxy Xoay)\n- Load lại danh sách proxy tĩnh', {
                reply_markup: { inline_keyboard: [[{ text: '🔙 Quay lại Proxy Menu', callback_data: 'admin_proxy_menu' }]] }
            });
        }
        // ========== END PROXY MANAGEMENT ==========

        // ========== [WORM-GPT v2] ADMIN SMART LOG HANDLERS ==========
        else if (data === 'admin_log_level_menu') {
            if (!isUserAdmin) return;

            const { getAdminLogLevel, getLogStats, VALID_LEVELS } = require('../utils/smartLog');
            const currentLevel = await getAdminLogLevel();
            const stats = getLogStats();

            let msg = `🔕 **CẤU HÌNH LOG ADMIN**\n`;
            msg += `━━━━━━━━━━━━━━━━━━━\n\n`;
            msg += `📢 Level hiện tại: **${currentLevel}**\n\n`;

            msg += `📊 **Buffer Events:**\n`;
            msg += `├ 1h qua: ${stats.last_1h.die} die / ${stats.last_1h.live} live\n`;
            msg += `├ 6h qua: ${stats.last_6h.die} die / ${stats.last_6h.live} live\n`;
            msg += `└ Tổng buffer: ${stats.buffer_size}\n\n`;

            msg += `📋 **Giải thích Level:**\n`;
            msg += `├ **ALL** — Nhận mọi thông báo (spam)\n`;
            msg += `├ **SUMMARY** — Chỉ nhận report tổng hợp\n`;
            msg += `├ **CRITICAL** — Chỉ khi batch die/proxy sập\n`;
            msg += `└ **OFF** — Im lặng (tự vào check)\n\n`;
            msg += `👇 **Chọn level:**`;

            const kb = VALID_LEVELS.map(level => {
                const isActive = level === currentLevel;
                const icon = isActive ? '✅' : '⬜';
                return [{ text: `${icon} ${level}`, callback_data: `set_log_level_${level}` }];
            });

            kb.push([{ text: '📊 Xem Report Ngay', callback_data: 'admin_force_report' }]);
            kb.push([{ text: '🔙 Quay lại', callback_data: 'admin_panel' }]);

            await sendMessage(chatId, msg, { reply_markup: { inline_keyboard: kb } });
            await answerCallbackQuery(query.id);
        }
        else if (data.startsWith('set_log_level_')) {
            if (!isUserAdmin) return;

            const level = data.replace('set_log_level_', '');
            const { setAdminLogLevel } = require('../utils/smartLog');
            const result = await setAdminLogLevel(level);

            if (result.success) {
                await answerCallbackQuery(query.id, { text: `✅ Log Level → ${result.level}`, show_alert: true });
                await sendMessage(chatId, `✅ **Log Level đã đổi thành: ${result.level}**\n\n` +
                    `Áp dụng ngay từ vòng check tiếp theo.`, {
                    reply_markup: { inline_keyboard: [[{ text: '🔙 Log Menu', callback_data: 'admin_log_level_menu' }]] }
                });
            } else {
                await answerCallbackQuery(query.id, { text: `❌ ${result.error}`, show_alert: true });
            }
        }
        else if (data === 'admin_force_report') {
            if (!isUserAdmin) return;

            await sendMessage(chatId, '⏳ **Đang tạo report...**');

            try {
                const { buildReport } = require('../workers/adminReport');
                const report = await buildReport();
                await sendMessage(chatId, report, {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '🔕 Log Level', callback_data: 'admin_log_level_menu' }],
                            [{ text: '🔙 Admin Panel', callback_data: 'admin_panel' }]
                        ]
                    }
                });
            } catch (err) {
                await sendMessage(chatId, `❌ Lỗi: ${err.message}`);
            }

            await answerCallbackQuery(query.id);
        }
        // ========== END SMART LOG ==========

        // ========== [WORM-GPT v2] BACKUP HANDLERS ==========
        else if (data === 'admin_backup_now') {
            if (!isUserAdmin) return;

            await sendMessage(chatId, '💾 **Đang backup...**');
            const { createBackup } = require('../workers/autoBackup');
            const result = await createBackup();

            if (result.success) {
                await sendMessage(chatId, `✅ **Backup thành công!**\n\n📅 ${result.date}\n📁 ${result.files} files`, {
                    reply_markup: { inline_keyboard: [[{ text: '🔙 Admin Panel', callback_data: 'admin_panel' }]] }
                });
            } else {
                await sendMessage(chatId, `❌ Lỗi: ${result.error}`);
            }

            await answerCallbackQuery(query.id);
        }
        // ========== END BACKUP ==========

        // ========== [WORM-GPT v2] USER FEATURE HANDLERS ==========
        else if (data.startsWith('recheck_') && !data.startsWith('recheck_all')) {
            // Quick Recheck single UID
            const uid = data.replace('recheck_', '');
            await sendMessage(chatId, `🔄 **Đang check lại UID** \`${uid}\`**...**`);

            try {
                const { checkUIDLiveDie } = require('../services/facebook');
                const result = await checkUIDLiveDie(uid);

                const icon = result.status === 'LIVE' ? '🟢' : result.status === 'DIE' ? '🔴' : '❓';
                await sendMessage(chatId, `${icon} **Kết quả:** ${result.status}\n📡 ${result.info}`, {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '🔄 Check lại', callback_data: `recheck_${uid}` }, { text: '📱 Xem FB', url: `https://facebook.com/${uid}` }],
                            [{ text: '📋 Danh sách UID', callback_data: 'user_uid_list' }]
                        ]
                    }
                });
            } catch (err) {
                await sendMessage(chatId, `❌ Lỗi: ${err.message}`);
            }

            await answerCallbackQuery(query.id);
        }
        else if (data === 'recheck_all') {
            // Recheck tất cả UID đang active
            const { getUserUIDList } = require('../utils/userDashboard');
            const activeUIDs = await getUserUIDList(chatId, 'ACTIVE');

            if (activeUIDs.length === 0) {
                await sendMessage(chatId, '📭 Không có UID đang theo dõi.');
                return await answerCallbackQuery(query.id);
            }

            if (activeUIDs.length > 30) {
                await sendMessage(chatId, `⚠️ Bạn có ${activeUIDs.length} UID. Chỉ check tối đa 30 UID/lần.`);
            }

            const toCheck = activeUIDs.slice(0, 30);
            await sendMessage(chatId, `🔄 **Đang check lại ${toCheck.length} UID...**`);

            const { checkUIDLiveDie } = require('../services/facebook');
            let liveCount = 0, dieCount = 0, failCount = 0;

            for (const item of toCheck) {
                try {
                    const result = await checkUIDLiveDie(item.uid);
                    if (result.status === 'LIVE') liveCount++;
                    else if (result.status === 'DIE') dieCount++;
                    else failCount++;
                } catch (e) { failCount++; }
            }

            await sendMessage(chatId, `✅ **CHECK XONG ${toCheck.length} UID!**\n\n🟢 LIVE: ${liveCount}\n🔴 DIE: ${dieCount}\n❓ Không rõ: ${failCount}`, {
                reply_markup: { inline_keyboard: [[{ text: '📋 Xem danh sách', callback_data: 'user_uid_list' }]] }
            });

            await answerCallbackQuery(query.id);
        }
        else if (data === 'user_uid_list') {
            // User UID Dashboard
            const { buildUIDListMessage } = require('../utils/userDashboard');
            const { msg, kb } = await buildUIDListMessage(chatId, 'ALL', 0);
            await sendMessage(chatId, msg, { reply_markup: { inline_keyboard: kb } });
            await answerCallbackQuery(query.id);
        }
        else if (data.startsWith('uidlist_')) {
            // UID list with filter + pagination: uidlist_FILTER_PAGE
            const parts = data.split('_');
            const filter = parts[1] || 'ALL';
            const page = parseInt(parts[2] || '0');

            const { buildUIDListMessage } = require('../utils/userDashboard');
            const { msg, kb } = await buildUIDListMessage(chatId, filter, page);
            await sendMessage(chatId, msg, { reply_markup: { inline_keyboard: kb } });
            await answerCallbackQuery(query.id);
        }
        else if (data === 'export_uid_csv') {
            // Trigger export
            const { handleStart } = require('./commands');
            // Gọi export trực tiếp
            const mockMsg = { chat: { id: chatId }, from: { id: userId }, text: '/export' };
            await handleStart(mockMsg);
            await answerCallbackQuery(query.id);
        }
        else if (data === 'go_home') {
            // Về menu chính
            const { handleStart } = require('./commands');
            const mockMsg = { chat: { id: chatId }, from: { id: userId, first_name: '', username: '' }, text: '/start' };
            await handleStart(mockMsg);
            await answerCallbackQuery(query.id);
        }
        // ========== END USER FEATURES ==========

        else if (data === 'close_panel') {
            await deleteMessage(chatId, query.message.message_id);
        }

        // ========== CHILD BOT HANDLERS (UPGRADED) ==========
        else if (data === 'child_bot_menu') {
            const cfgPath = path.join(__dirname, '../data/data_config.json');
            const sysConfig = await loadJSON(cfgPath) || {};
            const isChildBotFree = sysConfig.child_bot_free_mode || false;
            const vipData = await checkVIP(userId);
            const canUse = isChildBotFree || vipData.isVIP;

            const cfg = await childBotManager.loadConfig(userId);
            const hasToken = cfg && cfg.token;
            const isOn = hasToken && cfg.status === 'on' && childBotManager.getBotInstance(userId);
            const activeCount = childBotManager.getActiveCount();
            const createdDate = cfg && cfg.created_at ? new Date(cfg.created_at * 1000).toLocaleDateString('vi-VN') : null;

            // --- Build caption ---
            let caption = `🤖 **TRUNG TÂM QUẢN LÝ BOT CON**\n`;
            caption += `━━━━━━━━━━━━━━━━━━━\n\n`;

            if (!canUse) {
                // Non-VIP, free mode OFF → show promo
                caption += `👑 **ĐẶC QUYỀN VIP EXCLUSIVE**\n\n`;
                caption += `Sở hữu Bot Telegram riêng mang thương hiệu của bạn!\n\n`;
                caption += `✨ Bot riêng với username tuỳ chọn\n`;
                caption += `✨ Nhận thông báo UID qua Bot cá nhân\n`;
                caption += `✨ Tự động chuyển đổi khi bot gặp sự cố\n`;
                caption += `✨ Quản lý bật/tắt/restart dễ dàng\n`;
                caption += `✨ Test kết nối 1 chạm\n\n`;
                caption += `━━━━━━━━━━━━━━━━━━━\n`;
                caption += `🔒 Nâng cấp VIP để mở khoá tính năng này!\n`;

                const promoButtons = [
                    [{ text: '💎 Mua VIP Ngay', callback_data: 'buy_vip' }],
                    [{ text: '📖 Hướng dẫn tạo Bot', callback_data: 'child_bot_guide' }],
                    [{ text: '🔙 Quay lại Menu', callback_data: 'child_bot_back' }]
                ];
                await sendMessage(chatId, caption, { reply_markup: { inline_keyboard: promoButtons } });
                return await answerCallbackQuery(query.id);
            }

            // --- VIP / Free mode → full dashboard ---
            // Status section
            if (!hasToken) {
                caption += `📡 Trạng thái: ❌ Chưa cài đặt\n`;
                caption += `🔑 Token: (Chưa có)\n\n`;
                caption += `💡 Bấm "🔑 Cài đặt Token" để bắt đầu!\n`;
            } else {
                const tokenMask = cfg.token.substring(0, 8) + '...' + cfg.token.slice(-4);
                const statusEmoji = isOn ? '🟢' : '🔴';
                const statusLabel = isOn ? 'Đang chạy' : 'Đã tắt';

                caption += `📡 Trạng thái: ${statusEmoji} ${statusLabel}\n`;
                caption += `🤖 Bot: @${cfg.bot_username || '???'}\n`;
                caption += `📛 Tên: ${cfg.bot_name || '???'}\n`;
                caption += `🔑 Token: \`${tokenMask}\`\n`;
                if (createdDate) caption += `📅 Ngày tạo: ${createdDate}\n`;
                caption += `\n`;

                if (isOn) {
                    caption += `✅ Bot con đang hoạt động — thông báo UID gửi qua bot riêng.\n`;
                } else {
                    caption += `⚠️ Bot con đang tắt — thông báo gửi qua bot tổng.\n`;
                }
            }

            caption += `\n━━━━━━━━━━━━━━━━━━━\n`;
            caption += `🌐 Hệ thống: ${activeCount} bot đang hoạt động\n`;
            if (vipData.isVIP) caption += `👑 VIP: ${vipData.info}\n`;
            if (isChildBotFree) caption += `🎁 Chế độ: Dùng thử miễn phí\n`;

            // --- Build buttons ---
            let buttons = [];

            if (!hasToken) {
                buttons = [
                    [{ text: '🔑 Cài đặt Token', callback_data: 'child_bot_input_token' }],
                    [{ text: '📖 Hướng dẫn tạo Bot', callback_data: 'child_bot_guide' }],
                    [{ text: '🔙 Quay lại Menu', callback_data: 'child_bot_back' }]
                ];
            } else if (!isOn) {
                buttons = [
                    [{ text: '✅ Bật Bot', callback_data: 'child_bot_start' }, { text: '🔍 Test kết nối', callback_data: 'child_bot_test' }],
                    [{ text: '🔑 Đổi Token', callback_data: 'child_bot_input_token' }, { text: '🔄 Restart', callback_data: 'child_bot_restart' }],
                    [{ text: 'ℹ️ Thông tin Bot', callback_data: 'child_bot_info' }, { text: '🗑️ Xoá Bot', callback_data: 'child_bot_delete' }],
                    [{ text: '📖 Hướng dẫn', callback_data: 'child_bot_guide' }],
                    [{ text: '🔙 Quay lại Menu', callback_data: 'child_bot_back' }]
                ];
            } else {
                buttons = [
                    [{ text: '⛔ Tắt Bot', callback_data: 'child_bot_stop' }, { text: '🔍 Test kết nối', callback_data: 'child_bot_test' }],
                    [{ text: '🔄 Restart Bot', callback_data: 'child_bot_restart' }],
                    [{ text: 'ℹ️ Thông tin Bot', callback_data: 'child_bot_info' }],
                    [{ text: '📖 Hướng dẫn', callback_data: 'child_bot_guide' }],
                    [{ text: '🔙 Quay lại Menu', callback_data: 'child_bot_back' }]
                ];
            }

            await sendMessage(chatId, caption, { reply_markup: { inline_keyboard: buttons } });
            await answerCallbackQuery(query.id);
        }
        else if (data === 'child_bot_guide') {
            const guideMsg = `📖 **HƯỚNG DẪN TẠO BOT CON**\n` +
                `━━━━━━━━━━━━━━━━━━━\n\n` +
                `**Bước 1:** Mở Telegram, tìm @BotFather\n` +
                `**Bước 2:** Gửi lệnh /newbot\n` +
                `**Bước 3:** Đặt tên cho bot (VD: "Check UID của Sếp")\n` +
                `**Bước 4:** Đặt username (VD: sefp\\_check\\_bot)\n` +
                `**Bước 5:** Copy token BotFather gửi cho bạn\n` +
                `**Bước 6:** Quay lại đây, bấm "🔑 Cài đặt Token"\n` +
                `**Bước 7:** Paste token vào → Bật bot → Xong!\n\n` +
                `━━━━━━━━━━━━━━━━━━━\n` +
                `💡 **Mẹo:** Đặt tên và avatar cho bot con trên @BotFather để chuyên nghiệp hơn!`;

            await sendMessage(chatId, guideMsg, {
                reply_markup: { inline_keyboard: [[{ text: '🔙 Quay lại', callback_data: 'child_bot_menu' }]] }
            });
            await answerCallbackQuery(query.id);
        }
        else if (data === 'child_bot_info') {
            const cfg = await childBotManager.loadConfig(userId);
            if (!cfg || !cfg.token) {
                return await answerCallbackQuery(query.id, { text: '❌ Chưa có bot con', show_alert: true });
            }

            const isOn = cfg.status === 'on' && childBotManager.getBotInstance(userId);
            const tokenMask = cfg.token.substring(0, 8) + '...' + cfg.token.slice(-4);
            const created = cfg.created_at ? new Date(cfg.created_at * 1000).toLocaleString('vi-VN') : 'N/A';
            const updated = cfg.updated_at ? new Date(cfg.updated_at * 1000).toLocaleString('vi-VN') : 'N/A';

            const infoMsg = `ℹ️ **THÔNG TIN CHI TIẾT BOT CON**\n` +
                `━━━━━━━━━━━━━━━━━━━\n\n` +
                `🤖 Username: @${cfg.bot_username || '???'}\n` +
                `📛 Tên hiển thị: ${cfg.bot_name || '???'}\n` +
                `🔑 Token: \`${tokenMask}\`\n` +
                `📡 Trạng thái: ${isOn ? '🟢 Đang chạy' : '🔴 Đã tắt'}\n\n` +
                `📅 Ngày tạo: ${created}\n` +
                `🔄 Cập nhật: ${updated}\n` +
                `👤 Chủ sở hữu: \`${userId}\`\n`;

            await sendMessage(chatId, infoMsg, {
                reply_markup: { inline_keyboard: [[{ text: '🔙 Quay lại', callback_data: 'child_bot_menu' }]] }
            });
            await answerCallbackQuery(query.id);
        }
        else if (data === 'child_bot_restart') {
            const cfg = await childBotManager.loadConfig(userId);
            if (!cfg || !cfg.token) {
                return await answerCallbackQuery(query.id, { text: '❌ Chưa có bot con', show_alert: true });
            }

            await answerCallbackQuery(query.id, { text: '🔄 Đang restart...' });
            await childBotManager.stopBot(userId);
            await new Promise(r => setTimeout(r, 1000));
            const result = await childBotManager.startBot(userId);

            if (result.success) {
                await sendMessage(chatId, '🔄 *Bot con đã restart thành công!*', {
                    reply_markup: { inline_keyboard: [[{ text: '🔙 Dashboard', callback_data: 'child_bot_menu' }]] }
                });
            } else {
                await sendMessage(chatId, `❌ Restart thất bại: ${result.error}`, {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '🔄 Thử lại', callback_data: 'child_bot_restart' }, { text: '🔑 Đổi Token', callback_data: 'child_bot_input_token' }],
                            [{ text: '🔙 Quay lại', callback_data: 'child_bot_menu' }]
                        ]
                    }
                });
            }
        }
        else if (data === 'child_bot_delete') {
            await sendMessage(chatId,
                `⚠️ **XÁC NHẬN XOÁ BOT CON**\n\n` +
                `Hành động này sẽ:\n` +
                `• Tắt bot con (nếu đang chạy)\n` +
                `• Xoá token đã lưu\n` +
                `• Thông báo sẽ quay lại bot tổng\n\n` +
                `❓ Bạn chắc chắn muốn xoá?`,
                {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '🗑️ Xác nhận Xoá', callback_data: 'child_bot_confirm_delete' }],
                            [{ text: '❌ Huỷ', callback_data: 'child_bot_menu' }]
                        ]
                    }
                }
            );
            await answerCallbackQuery(query.id);
        }
        else if (data === 'child_bot_confirm_delete') {
            await childBotManager.stopBot(userId);
            // Xoá config
            const { saveJSON } = require('../services/storage');
            const allData = await loadJSON(path.join(__dirname, '../data/data_child_bots.json')) || {};
            delete allData[userId.toString()];
            await saveJSON(path.join(__dirname, '../data/data_child_bots.json'), allData);

            await sendMessage(chatId, `✅ **Đã xoá bot con thành công!**\n\nThông báo sẽ gửi qua bot tổng từ bây giờ.`);
            await answerCallbackQuery(query.id);
        }
        else if (data === 'child_bot_input_token') {
            const cfgPathToken = path.join(__dirname, '../data/data_config.json');
            const sysConfigToken = await loadJSON(cfgPathToken) || {};
            const isChildBotFreeToken = sysConfigToken.child_bot_free_mode || false;

            if (!isChildBotFreeToken) {
                const vip = await checkVIP(userId);
                if (!vip.isVIP) return await answerCallbackQuery(query.id, { text: '❌ Chỉ VIP mới dùng được', show_alert: true });
            }

            const cfg = await childBotManager.loadConfig(userId);
            if (cfg && cfg.status === 'on' && childBotManager.getBotInstance(userId)) {
                return await answerCallbackQuery(query.id, { text: '⚠️ Tắt bot trước khi đổi token', show_alert: true });
            }

            await sendMessage(chatId,
                `🔑 **CÀI ĐẶT TOKEN BOT CON**\n` +
                `━━━━━━━━━━━━━━━━━━━\n\n` +
                `Vui lòng gửi token bot (lấy từ @BotFather).\n\n` +
                `📌 Ví dụ: \`7000000000:AAxxxxxxxxxx...\`\n\n` +
                `💡 Chưa có token? Bấm nút bên dưới để xem hướng dẫn.\n` +
                `Gõ /cancel để huỷ.`,
                {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '📖 Hướng dẫn tạo Bot', callback_data: 'child_bot_guide' }],
                            [{ text: '❌ Huỷ', callback_data: 'child_bot_menu' }]
                        ]
                    }
                }
            );
            setUserState(userId, { mode: 'child_bot_token' });
            await answerCallbackQuery(query.id);
        }
        else if (data === 'child_bot_start') {
            const cfgPathStart = path.join(__dirname, '../data/data_config.json');
            const sysConfigStart = await loadJSON(cfgPathStart) || {};
            const isChildBotFreeStart = sysConfigStart.child_bot_free_mode || false;

            if (!isChildBotFreeStart) {
                const vip = await checkVIP(userId);
                if (!vip.isVIP) return await answerCallbackQuery(query.id, { text: '❌ Chỉ VIP', show_alert: true });
            }

            const cfg = await childBotManager.loadConfig(userId);
            if (!cfg || !cfg.token) {
                return await answerCallbackQuery(query.id, { text: 'Nhập token trước', show_alert: true });
            }
            if (cfg.status === 'on' && childBotManager.getBotInstance(userId)) {
                return await answerCallbackQuery(query.id, { text: 'Bot đã đang chạy', show_alert: true });
            }

            await answerCallbackQuery(query.id, { text: '⏳ Đang khởi tạo...' });
            const result = await childBotManager.startBot(userId);

            if (result.success) {
                // Tự động test gửi 1 tin nhắn chào mừng từ bot con sang user
                try {
                    const inst = childBotManager.getBotInstance(userId);
                    if (inst) {
                        await inst.sendMessage(userId, `🟢 TING TING! Bot con của bạn (Owner: ${userId}) đã khởi động thành công và sẵn sàng nhận thông báo UID!`);
                    }
                } catch (e) { }

                await sendMessage(chatId,
                    `✅ **BOT CON ĐÃ BẬT THÀNH CÔNG!**\n\n` +
                    `🤖 Bot: @${cfg.bot_username}\n` +
                    `📡 Trạng thái: 🟢 Online\n\n` +
                    `Từ giờ thông báo UID sẽ gửi qua bot con của bạn.\n` +
                    `*(Bot con vừa gửi cho bạn 1 tin nhắn Test)*`,
                    { reply_markup: { inline_keyboard: [[{ text: '🔙 Quay lại Dashboard', callback_data: 'child_bot_menu' }]] } }
                );
            } else {
                await sendMessage(chatId, `❌ Không thể bật bot con: ${result.error}\n\n👉 Thử restart hoặc đổi token:`, {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '🔄 Thử lại', callback_data: 'child_bot_start' }, { text: '🔑 Đổi Token', callback_data: 'child_bot_input_token' }],
                            [{ text: '📖 Hướng dẫn', callback_data: 'child_bot_guide' }],
                            [{ text: '🔙 Quay lại', callback_data: 'child_bot_menu' }]
                        ]
                    }
                });
            }
        }
        else if (data === 'child_bot_stop') {
            await childBotManager.stopBot(userId);
            await sendMessage(chatId,
                `⛔ **BOT CON ĐÃ TẮT**\n\n` +
                `Thông báo sẽ quay lại gửi qua bot tổng.\n` +
                `Bấm "✅ Bật Bot" bất cứ lúc nào để kích hoạt lại.`,
                { reply_markup: { inline_keyboard: [[{ text: '🔙 Quay lại Dashboard', callback_data: 'child_bot_menu' }]] } }
            );
            await answerCallbackQuery(query.id);
        }
        else if (data === 'child_bot_test') {
            const inst = childBotManager.getBotInstance(userId);
            if (!inst || !inst.isRunning()) {
                return await answerCallbackQuery(query.id, { text: '❌ Bot con chưa bật', show_alert: true });
            }

            await answerCallbackQuery(query.id, { text: '🔍 Đang test...' });
            const ok = await inst.testConnection();
            if (ok) {
                try {
                    await inst.sendMessage(userId, `🟢 TING TING! Tính năng test kết nối hoạt động bình thường!`);
                } catch (e) { }
                await sendMessage(chatId, `✅ **KẾT NỐI THÀNH CÔNG!**\n\nBot con đang hoạt động bình thường. 🟢\n*(Bot con vừa gửi kèm 1 tin nhắn vào chat của nó)*`);
            } else {
                await sendMessage(chatId, `❌ **KẾT NỐI THẤT BẠI!**\n\nThử restart bot hoặc kiểm tra lại token.`,
                    { reply_markup: { inline_keyboard: [[{ text: '🔄 Restart', callback_data: 'child_bot_restart' }], [{ text: '🔙 Quay lại', callback_data: 'child_bot_menu' }]] } }
                );
            }
        }
        else if (data === 'child_bot_back') {
            const { handleStart } = require('./commands');
            await handleStart(query.message);
            await answerCallbackQuery(query.id);
        }
        // ========== END CHILD BOT HANDLERS ==========

        // --- UID MANAGEMENT (DEL / DONE / ADD_MORE) ---
        else if (data.startsWith('checkfaq_')) {
            const targetUid = data.replace('checkfaq_', '');
            await answerCallbackQuery(query.id, { text: '🔍 Đang check FAQ...' });

            try {
                const { getFAQCode } = require('../utils/helpers');
                const { FAQ_CODES } = require('../config/constants');
                const { getTracking } = require('../utils/trackingManager');

                const faqResult = await getFAQCode(targetUid);

                let faqMsg = '';
                if (faqResult.code && faqResult.isFAQ) {
                    faqMsg = `🔴 **FAQ: ${faqResult.code}**\n🆔 UID: \`${targetUid}\``;
                } else {
                    // Determine part from tracking data
                    let part = 1;
                    try {
                        const trackingData = await getTracking();
                        if (trackingData[chatId] && trackingData[chatId][targetUid]) {
                            part = trackingData[chatId][targetUid].part || 1;
                        }
                    } catch (e) { }

                    if (part <= 1) {
                        faqMsg = `🔮 **Dự Đoán: 956**\n🆔 UID: \`${targetUid}\``;
                    } else {
                        faqMsg = `💀 **Dự Đoán: 282**\n🆔 UID: \`${targetUid}\``;
                    }
                }

                await sendMessage(chatId, faqMsg);
            } catch (err) {
                console.error('Check FAQ error:', err);
                await sendMessage(chatId, `❌ Lỗi check FAQ cho UID \`${targetUid}\``);
            }
        }
        else if (data.startsWith('del_')) {
            const targetUid = data.split('_')[1];
            await removeTrackingUID(chatId, targetUid);
            await deleteMessage(chatId, query.message.message_id);
            await sendMessage(chatId, `🗑️ **Đã xóa theo dõi UID:** \`${targetUid}\``);
            await answerCallbackQuery(query.id);
        }
        else if (data.startsWith('done_')) {
            const targetUid = data.split('_')[1];
            await markDoneUID(chatId, targetUid);
            await deleteMessage(chatId, query.message.message_id);
            await sendMessage(chatId, `✅ **Đã hoàn thành UID:** \`${targetUid}\``);
            await answerCallbackQuery(query.id);
        }
        else if (data === 'add_uid') {
            const vip = await checkVIP(userId);
            if (!vip.isVIP) {
                return await answerCallbackQuery(query.id, { text: '❌ Bạn cần có VIP để thực hiện hành động này!', show_alert: true });
            }

            await sendMessage(chatId, '📝 **NHẬP TIẾP TÊN GỢI NHỚ:**');
            setUserState(userId, { mode: 'add_uid_flow', step: 'wait_name' });
            await answerCallbackQuery(query.id);
        }
        else if (data === 'support_menu_open') {
            const markup = {
                inline_keyboard: [
                    [{ text: '🤖 Hỏi AI (Tự động)', callback_data: 'ai_support_trigger' }],
                    [{ text: '👨‍💻 Gặp Nhân viên (Trực tiếp)', callback_data: 'request_human_support' }]
                ]
            };
            await sendMessage(chatId, "💬 **TRUNG TÂM HỖ TRỢ**\n\nBạn cần hỗ trợ vấn đề gì? Vui lòng chọn:", { reply_markup: markup });
            await answerCallbackQuery(query.id);
        }
        else if (data === 'ai_support_trigger') {
            const { createTicket } = require('../utils/ticketManager');
            const ticket = await createTicket(userId, 'AI');

            const s = getUserState(userId) || {};
            s.mode = 'ai_support';
            s.ticketId = ticket.id;
            await setUserState(userId, s);

            const markup = {
                inline_keyboard: [[{ text: '❌ Đóng Chat Support', callback_data: 'exit_ai_support' }]]
            };
            await sendMessage(chatId, `🤖 **(BOT SUPPORT)**\n🎫 Ticket: \`#${ticket.id.slice(-6)}\`\n\nXin chào! Mình là AI Support.\nAnh/Chị cần hỗ trợ gì ạ?`, { reply_markup: markup });
            await answerCallbackQuery(query.id);
        }
        else if (data === 'exit_ai_support') {
            const s = getUserState(userId);
            if (s && s.ticketId) {
                const { closeTicket } = require('../utils/ticketManager');
                await closeTicket(s.ticketId, 'User closed chat');
            }

            clearUserState(userId);
            await sendMessage(chatId, "✅ Đã đóng Chat Support. Ticket đã được lưu. Hẹn gặp lại!");
            await answerCallbackQuery(query.id);
        }
        else if (data === 'request_human_support') {
            const { createTicket } = require('../utils/ticketManager');
            await createTicket(userId, 'HUMAN');

            await requestSupport(userId, query.from.first_name || 'Khách hàng');
            await answerCallbackQuery(query.id);
        }
        else if (data.startsWith('admin_view_tickets_')) {
            if (!isUserAdmin) return;
            const targetUid = parseInt(data.split('_')[3]);
            const { getUserTickets } = require('../utils/ticketManager');
            const { formatDate } = require('../utils/helpers');
            const tickets = await getUserTickets(targetUid);

            if (tickets.length === 0) {
                return await sendMessage(chatId, "📭 User này chưa có lịch sử hỗ trợ nào.");
            }

            let msg = `🎫 **LỊCH SỬ HỖ TRỢ (${targetUid})**\n\n`;
            for (const t of tickets.slice(0, 10)) {
                const date = formatDate(t.created_at);
                const statusIcon = t.status === 'CLOSED' ? '✅' : '🟠';
                const typeIcon = t.type === 'AI' ? '🤖' : '👨‍💻';
                const firstMsg = t.messages.length > 0 ? t.messages[0].content.substring(0, 30) + "..." : "(Không có nội dung)";
                msg += `${statusIcon} \`${date}\` | ${typeIcon} ${t.type} | ${firstMsg}\n`;
            }

            await sendMessage(chatId, msg);
            await answerCallbackQuery(query.id);
        }
        else if (data === 'user_confirm_deposit') {
            const state = getUserState(userId);
            const amount = (state && state.amount) ? state.amount : 0;

            if (amount <= 0) {
                return await answerCallbackQuery(query.id, { text: '⚠️ Lỗi: Không tìm thấy thông tin giao dịch.' });
            }

            const admins = await getAdmins();
            const adminCaption = `💰 **YÊU CẦU NẠP TIỀN** (Xác nhận nhanh)\n\n` +
                `🆔 UID: \`${userId}\`\n` +
                `💰 Số tiền: ${formatVND(amount)}\n` +
                `⚠️ User đã bấm "Đã chuyển tiền" (Không ảnh bill).\n` +
                `👇 Kiểm tra bank và Duyệt:`;

            const markup = {
                inline_keyboard: [[
                    { text: '✅ Duyệt', callback_data: `admin_approve_deposit_${userId}_${amount}` },
                    { text: '❌ Hủy', callback_data: `cancel_deposit_${userId}` }
                ]]
            };

            for (const adminId of admins) {
                try { await sendMessage(adminId, adminCaption, { reply_markup: markup }); } catch (e) { }
            }

            await sendMessage(chatId, "✅ Đã gửi yêu cầu nạp tiền tới Admin. Vui lòng chờ duyệt!");
            clearUserState(userId);
            await answerCallbackQuery(query.id);
        }
        else {
            await answerCallbackQuery(query.id, { text: 'Chức năng đang cập nhật...' });
        }

    } catch (err) {
        console.error('❌ Callback error:', err);
        console.error('Error stack:', err.stack);
        console.error('Callback data:', data);
        try { await answerCallbackQuery(query.id, { text: 'Lỗi hệ thống!' }); } catch (e) { }
    }
}

module.exports = { handleCallbackQuery };
