const { sendMessage, bot, setUserState, getUserState, clearUserState } = require('../services/telegram');
const { loadJSON, saveJSON } = require('../services/storage');
const { updateBalance, getUserData, checkVIP } = require('../utils/userManager');
const { formatVND, notifyAdmins } = require('../utils/helpers');
const { ADMIN_IDS } = require('../config/constants');
const path = require('path');

const TUT_FILE = path.join(__dirname, '../data/data_tuts.json');

// SCHEMA:
// {
//     "pending": [], // Chờ duyệt
//     "active": [],  // Đã duyệt
//     "my_tuts": {}  // { buyerId: [tutId...]}
// }

async function getTuts() {
    const data = await loadJSON(TUT_FILE);
    if (!data.pending) data.pending = [];
    if (!data.active) data.active = [];
    if (!data.my_tuts) data.my_tuts = {};
    return data;
}

async function saveTuts(data) {
    await saveJSON(TUT_FILE, data);
}

// --- MAIN MENU ---
async function handleTutMenu(chatId, userId) {
    const data = await getTuts();
    const activeCount = data.active.length;

    // Msg
    const msg = `📚 **KHO TÀNG TUT & TRICK LỎ** 📚\n\n` +
        `Chào mừng dân chơi đến với Chợ Đen Tut Trick!\n` +
        `Nơi chia sẻ, mua bán đủ thể loại tut:\n` +
        `✅ Tut FB, Tik, Shopee...\n` +
        `✅ Trick Dame, Mẹo Vặt...\n` +
        `✅ Share Free hoặc Bán kiếm tiền.\n\n` +
        `📊 **Thống kê:** ${activeCount} bài viết đang hoạt động.\n` +
        `📢 **Quy định:** Mọi bài đăng đều được Admin kiểm duyệt gắt gao.`;

    const markup = {
        inline_keyboard: [
            [
                { text: '🛒 Mua / Xem Tut', callback_data: 'tut_list_view' },
                { text: '✍️ Đăng Bán / Share', callback_data: 'tut_post_new' }
            ],
            [
                { text: '📦 Tut Đã Mua', callback_data: 'tut_inventory' },
                { text: '👤 Tut Của Tôi', callback_data: 'tut_my_posts' }
            ]
        ]
    };

    // Admin Button
    if (ADMIN_IDS.has(userId)) {
        const pendingCount = data.pending.length;
        markup.inline_keyboard.push([{ text: `🔨 Duyệt Bài (${pendingCount})`, callback_data: 'tut_admin_approve' }]);
    }

    await sendMessage(chatId, msg, { reply_markup: markup });
}

// --- 1. POST NEW TUT ---
async function startPostTut(chatId, userId) {
    await sendMessage(chatId, "✍️ **BƯỚC 1: NHẬP TIÊU ĐỀ TUT**\n\nVí dụ: `Tut Dame 277 bao về`, `Trick Reg Clone bao trâu`...");
    const { setUserState } = require('../services/telegram');
    setUserState(userId, { mode: 'tut_post_title' });
}

async function handlePostFlow(msg, userId, chatId, text, state) {
    const data = await getTuts();

    if (state.mode === 'tut_post_title') {
        if (text.length < 5) return sendMessage(chatId, "❌ Tiêu đề quá ngắn!");
        state.data = { title: text, seller: userId };
        state.mode = 'tut_post_price';
        setUserState(userId, state);
        return sendMessage(chatId, "💰 **BƯỚC 2: NHẬP GIÁ BÁN (VNĐ)**\n\n- Nhập `0` để Share Free.\n- Ví dụ: `50000` (50k).");
    }

    if (state.mode === 'tut_post_price') {
        const price = parseInt(text.replace(/\D/g, ''));
        if (isNaN(price) || price < 0) return sendMessage(chatId, "❌ Giá không hợp lệ!");

        state.data.price = price;
        state.mode = 'tut_post_content';
        setUserState(userId, state);
        return sendMessage(chatId, "📝 **BƯỚC 3: NHẬP NỘI DUNG TUT (FULL)**\n\n- Hãy viết chi tiết nội dung Tut.\n- Nội dung này sẽ được ẩn và chỉ hiện khi người mua đã trả tiền (hoặc Admin duyệt).\n- Gửi ảnh/video nếu cần (nhưng text là chính).");
    }

    if (state.mode === 'tut_post_content') {
        state.data.content = text;

        // Save to Pending
        const newTut = {
            id: Date.now().toString(),
            title: state.data.title,
            price: state.data.price,
            content: state.data.content,
            seller: state.data.seller,
            created_at: Date.now(),
            status: 'pending',
            sold: 0
        };

        data.pending.push(newTut);
        await saveTuts(data);

        clearUserState(userId);

        // Notify User
        await sendMessage(chatId, "✅ **ĐĂNG BÀI THÀNH CÔNG!**\n\nBài viết của bạn đang chờ Admin duyệt.\nKhi được duyệt, nó sẽ xuất hiện trên chợ.");

        // Notify Admin
        notifyAdmins(`📢 **NEW TUT PENDING**\n👤 Seller: ${userId}\nTitle: ${newTut.title}\nPrice: ${formatVND(newTut.price)}`);
    }
}

// --- 2. LIST VIEW (BUY) ---
async function viewTutList(chatId, userId, page = 0) {
    const data = await getTuts();
    const list = data.active;
    const PAGE_SIZE = 5;

    if (list.length === 0) return sendMessage(chatId, "📭 Hiện chưa có Tut nào được bán.");

    const start = page * PAGE_SIZE;
    const end = start + PAGE_SIZE;
    const chunk = list.slice(start, end);

    let msg = `🛒 **DANH SÁCH TUT & TRICK (${start + 1}-${Math.min(end, list.length)}/${list.length})**\n\n`;

    const kb = [];
    chunk.forEach(t => {
        const priceTag = t.price === 0 ? "🆓 FREE" : `💰 ${formatVND(t.price)}`;
        msg += `🔹 **${t.title}**\n   └ Giá: ${priceTag} | 🛒 Đã bán: ${t.sold}\n\n`;
        kb.push([{ text: `Mua/Xem: ${t.title.substring(0, 20)}...`, callback_data: `tut_buy_${t.id}` }]);
    });

    // Pagination
    const nav = [];
    if (page > 0) nav.push({ text: '⬅️ Trước', callback_data: `tut_page_${page - 1}` });
    if (end < list.length) nav.push({ text: 'Sau ➡️', callback_data: `tut_page_${page + 1}` });
    if (nav.length > 0) kb.push(nav);

    // Back
    kb.push([{ text: '🔙 Quay Lại Menu', callback_data: 'tut_menu' }]);

    await sendMessage(chatId, msg, { reply_markup: { inline_keyboard: kb } });
}

// --- 3. BUY ACTION ---
async function handleBuyTut(chatId, userId, tutId) {
    const data = await getTuts();
    const tut = data.active.find(t => t.id === tutId);

    if (!tut) return sendMessage(chatId, "❌ Tut này không còn tồn tại.");

    // Check if owned
    const myOwned = data.my_tuts[userId] || [];
    if (myOwned.includes(tutId) || tut.seller === userId || tut.price === 0) {
        // Already owned OR Free OR My own tut
        return sendTutContent(chatId, tut);
    }

    // Paid tut: keep old paid logic (requires balance)
    const user = await getUserData(userId);
    if (user.balance < tut.price) {
        return sendMessage(chatId, `❌ **KHÔNG ĐỦ TIỀN**\nCần: ${formatVND(tut.price)}\nCó: ${formatVND(user.balance)}`);
    }

    // Process Transaction
    await updateBalance(userId, -tut.price);
    await updateBalance(tut.seller, tut.price);

    tut.sold += 1;

    if (!data.my_tuts[userId]) data.my_tuts[userId] = [];
    data.my_tuts[userId].push(tutId);

    await saveTuts(data);

    await sendMessage(chatId, `✅ **MUA THÀNH CÔNG!**\nĐã trừ: ${formatVND(tut.price)}`);
    await sendTutContent(chatId, tut);

    // Notify Seller
    try {
        await sendMessage(tut.seller, `💰 **BÁN ĐƯỢC HÀNG!**\n\nTut: ${tut.title}\n+${formatVND(tut.price)}`);
    } catch (e) { }
}

async function sendTutContent(chatId, tut) {
    const msg = `📖 **NỘI DUNG TUT: ${tut.title}**\n` +
        `👤 Tác giả: \`${tut.seller}\`\n` +
        `➖➖➖➖➖➖➖➖➖➖\n\n` +
        `${tut.content}\n\n` +
        `➖➖➖➖➖➖➖➖➖➖\n` +
        `Create at: ${new Date(tut.created_at).toLocaleString()}`;
    await sendMessage(chatId, msg);
}

// --- ADMIN HANDLER ---
async function handleAdminApprove(chatId, userId) {
    if (!ADMIN_IDS.has(userId)) return;
    const data = await getTuts();

    if (data.pending.length === 0) return sendMessage(chatId, "📭 Không có bài nào chờ duyệt.");

    const tut = data.pending[0]; // Duyệt bài đầu tiên

    const msg = `🔨 **DUYỆT TUT MỚI**\n\n` +
        `👤 Seller: \`${tut.seller}\`\n` +
        `🏷️ Title: **${tut.title}**\n` +
        `💰 Price: ${formatVND(tut.price)}\n` +
        `📝 Content: \n${tut.content}`;

    const kb = [
        [
            { text: '✅ DUYỆT NGAY', callback_data: `tut_adm_ok_${tut.id}` },
            { text: '❌ TỪ CHỐI', callback_data: `tut_adm_no_${tut.id}` }
        ],
        [{ text: '🕵️ Luộc (Cướp Tut)', callback_data: `tut_adm_steal_${tut.id}` }] // Đặc sản
    ];

    await sendMessage(chatId, msg, { reply_markup: { inline_keyboard: kb } });
}

async function handleAdminAction(action, tutId, chatId) {
    const data = await getTuts();
    const idx = data.pending.findIndex(t => t.id === tutId);
    if (idx === -1) return sendMessage(chatId, "❌ Tut not found.");

    const tut = data.pending[idx];

    if (action === 'ok') {
        tut.status = 'active';
        data.active.push(tut);
        await sendMessage(tut.seller, `✅ **TUT CỦA BẠN ĐÃ ĐƯỢC DUYỆT!**\nTựa đề: ${tut.title}`);
        await sendMessage(chatId, "✅ Đã Duyệt.");
    } else if (action === 'no') {
        await sendMessage(tut.seller, `❌ **TUT BỊ TỪ CHỐI**\nTựa đề: ${tut.title}`);
        await sendMessage(chatId, "❌ Đã Từ Chối.");
    } else if (action === 'steal') {
        // Luộc: Vẫn từ chối người bán, nhưng Admin đã xem được nội dung rồi =))
        await sendMessage(tut.seller, `❌ **TUT BỊ TỪ CHỐI (Nội dung không phù hợp)**`);
        await sendMessage(chatId, "🕵️ **Đã Luộc (Xem xong xóa).**");
    }

    data.pending.splice(idx, 1);
    await saveTuts(data);
}

module.exports = {
    handleTutMenu,
    startPostTut,
    handlePostFlow,
    handleAdminApprove,
    handleAdminAction,
    viewTutList,
    handleBuyTut
};
