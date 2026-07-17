const Decimal = require('decimal.js');
const { loadJSON, saveJSON } = require('../services/storage');
const { FILES, ADMIN_IDS } = require('../config/constants');
const { getCurrentTimestamp, formatDate } = require('../utils/helpers');

async function saveUserGlobal(userId) {
    const data = await loadJSON(FILES.all_users);
    if (!data.includes(userId)) {
        data.push(userId);
        await saveJSON(FILES.all_users, data);
    }
}

async function createUser(userId, initialData = {}) {
    const data = await loadJSON(FILES.users);
    const strId = userId.toString();

    if (!data[strId]) {
        data[strId] = {
            balance: 0,
            vip_expiry: 0,
            vip_active: false,
            level: 1,
            stats: { done: 0, cancel: 0, tracking: 0, money_generated: 0 },
            active_discount_code: null,
            active_bonus_days_code: null,
            active_discount_code_time: null,
            active_bonus_days_code_time: null,
            referral_code: null,
            referral_stats: { total_referrals: 0, total_earned: 0 },
            referral_vip_discount: 0,
            referrer: initialData.referrer || null, // Lưu người giới thiệu
            created_at: getCurrentTimestamp(), // Add creation time
            ...initialData
        };
        await saveJSON(FILES.users, data);
        await saveUserGlobal(userId); // Lưu vào list tổng
    } else {
        // Ensure global list has it even if user data exists (fix migration)
        await saveUserGlobal(userId);
    }
}

async function getAllUsersList() {
    const data = await loadJSON(FILES.users);
    return Object.keys(data).map(Number);
}

async function getUserData(userId) {
    const data = await loadJSON(FILES.users);
    const strId = userId.toString();

    if (!data[strId]) {
        data[strId] = {
            balance: 0,
            vip_expiry: 0,
            vip_active: false,
            level: 1,
            stats: {
                done: 0,
                cancel: 0,
                tracking: 0,
                money_generated: 0
            },
            active_discount_code: null,
            active_bonus_days_code: null,
            active_discount_code_time: null,
            active_bonus_days_code_time: null,
            referral_code: null,
            referral_stats: {
                total_referrals: 0,
                total_earned: 0
            },
            referral_vip_discount: 0,
            created_at: getCurrentTimestamp() // Add creation time
        };
        await saveJSON(FILES.users, data);
        await saveUserGlobal(userId); // FIX: Ensure added to global list
    }

    if (!data[strId].stats) {
        data[strId].stats = { done: 0, cancel: 0, tracking: 0, money_generated: 0 };
        await saveJSON(FILES.users, data);
    }

    if (data[strId].active_discount_code === undefined) {
        data[strId].active_discount_code = null;
        data[strId].active_discount_code_time = null;
        await saveJSON(FILES.users, data);
    }

    if (data[strId].active_bonus_days_code === undefined) {
        data[strId].active_bonus_days_code = null;
        data[strId].active_bonus_days_code_time = null;
        await saveJSON(FILES.users, data);
    }

    if (data[strId].referral_code === undefined) {
        data[strId].referral_code = null;
        data[strId].referral_stats = { total_referrals: 0, total_earned: 0 };
        data[strId].referral_vip_discount = 0;
        await saveJSON(FILES.users, data);
    }

    // Init isSupport
    if (data[strId].isSupport === undefined) {
        data[strId].isSupport = false;
        await saveJSON(FILES.users, data);
    }

    return data[strId];
}

async function setSupport(userId, isSupport) {
    const data = await loadJSON(FILES.users);
    const strId = userId.toString();
    if (!data[strId]) await getUserData(userId);

    if (data[strId]) {
        data[strId].isSupport = isSupport;
        await saveJSON(FILES.users, data);
        return true;
    }
    return false;
}

async function setCTV(userId, status) {
    const data = await loadJSON(FILES.users);
    const strId = userId.toString();
    if (!data[strId]) await getUserData(userId);

    if (data[strId]) {
        data[strId].isCTV = status;
        await saveJSON(FILES.users, data);
        return true;
    }
    return false;
}

// Helper to check permission level
async function checkRole(userId) {
    if (ADMIN_IDS.has(Number(userId))) return 'admin';
    const u = await getUserData(userId);
    if (u.isSupport) return 'support';
    if (u.isCTV) return 'ctv';
    return 'user';
}

async function updateUserStats(userId, typeUpdate, value = 0) {
    const data = await loadJSON(FILES.users);
    const strId = userId.toString();

    if (!data[strId]) return;

    const stats = data[strId].stats || { done: 0, cancel: 0, tracking: 0, money_generated: 0 };

    if (typeUpdate === 'done') {
        stats.done += 1;
        stats.money_generated += value;
        if (stats.tracking > 0) stats.tracking -= 1;
    } else if (typeUpdate === 'cancel') {
        stats.cancel += 1;
        if (stats.tracking > 0) stats.tracking -= 1;
    } else if (typeUpdate === 'add') {
        stats.tracking += 1;
    }

    data[strId].stats = stats;
    await saveJSON(FILES.users, data);
}

async function updateBalance(userId, amount) {
    const data = await loadJSON(FILES.users);
    const strId = userId.toString();

    if (!data[strId]) {
        await getUserData(userId);
        return updateBalance(userId, amount);
    }

    const current = parseInt(data[strId].balance || 0);
    data[strId].balance = current + amount;

    if (data[strId].balance < 0) {
        data[strId].balance = 0;
    }

    await saveJSON(FILES.users, data);

    if (amount > 0) {
        await logRevenue(amount);
    }

    return data[strId].balance;
}

async function setVIP(userId, days) {
    const data = await loadJSON(FILES.users);
    const strId = userId.toString();
    const now = getCurrentTimestamp();

    if (!data[strId]) {
        await getUserData(userId);
        return setVIP(userId, days);
    }

    const currentExpiry = data[strId].vip_expiry || 0;
    let newExpiry;

    if (days === 0) {
        newExpiry = 0;
        data[strId].vip_active = false;
        data[strId].level = 1;
    } else {
        if (currentExpiry > now) {
            newExpiry = currentExpiry + (days * 86400);
        } else {
            newExpiry = now + (days * 86400);
        }
        data[strId].vip_active = true;
        data[strId].level = 2;
    }

    data[strId].vip_expiry = newExpiry;
    await saveJSON(FILES.users, data);

    return newExpiry;
}

async function checkVIP(userId) {
    // --- [WORM-GPT] Fake Guest Check ---
    try {
        const { getUserState } = require('../services/telegram');
        const state = getUserState(userId);
        if (state && state.fakeGuest) {
            return { isVIP: false, info: 'Chưa kích hoạt (Fake Guest)' };
        }
    } catch (e) { }
    // -----------------------------------

    if (ADMIN_IDS.has(userId)) {
        return { isVIP: true, info: 'Vĩnh viễn (Admin)' };
    }

    const userData = await getUserData(userId);

    if (!userData.vip_active) {
        return { isVIP: false, info: 'Chưa kích hoạt' };
    }

    const now = getCurrentTimestamp();

    if (userData.vip_expiry > now) {
        const dt = new Date(userData.vip_expiry * 1000);
        const formatted = dt.toLocaleString('vi-VN', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
        return { isVIP: true, info: formatted };
    } else {
        if (userData.vip_active) {
            const data = await loadJSON(FILES.users);
            data[userId.toString()].vip_active = false;
            data[userId.toString()].level = 1;
            await saveJSON(FILES.users, data);
        }
        return { isVIP: false, info: 'Đã hết hạn' };
    }
}

async function logRevenue(amount) {
    if (amount <= 0) return;

    const data = await loadJSON(FILES.revenue);
    data.push({
        time: getCurrentTimestamp(),
        amount: amount
    });
    await saveJSON(FILES.revenue, data);
}

async function getAdminRevenueStats() {
    const data = await loadJSON(FILES.revenue);
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() / 1000;
    const yesterdayStart = todayStart - 86400;

    const stats = { today: 0, yesterday: 0, total: 0 };

    for (const rec of data) {
        const t = rec.time;
        const amt = rec.amount;
        stats.total += amt;

        if (t >= todayStart) {
            stats.today += amt;
        }
        if (yesterdayStart <= t && t < todayStart) {
            stats.yesterday += amt;
        }
    }

    return stats;
}

async function getMemberStats() {
    const allUsers = await getAllUsersList();
    const dataUsers = await loadJSON(FILES.users);
    const now = getCurrentTimestamp();
    const startOfDay = new Date().setHours(0, 0, 0, 0) / 1000;

    let total = allUsers.length;
    let newToday = 0;
    let vips = 0;
    let ctvs = 0;

    // Use dataUsers keys to ensure we count everyone with data
    const userIds = Object.keys(dataUsers);
    total = userIds.length;

    for (const uidStr of userIds) {
        const u = dataUsers[uidStr];
        if (!u) continue;

        const uid = Number(uidStr);

        // Check New Today (based on created_at)
        if (u.created_at && u.created_at >= startOfDay) {
            newToday++;
        }

        // Check VIP: Active VIP OR Admin
        const isActiveVip = (u.vip_active && u.vip_expiry > now);
        const isAdmin = ADMIN_IDS.has(uid);

        if (isActiveVip || isAdmin) {
            vips++;
        }

        // Check CTV
        if (u.isCTV) {
            ctvs++;
        }
    }

    return { total, newToday, vips, ctvs };
}

async function logUserHistory(userId, actionType, amount, detail) {
    const data = await loadJSON(FILES.history);
    const strId = userId.toString();

    if (!data[strId]) {
        data[strId] = [];
    }

    data[strId].push({
        time: getCurrentTimestamp(),
        type: actionType,
        amount: amount,
        detail: detail
    });

    await saveJSON(FILES.history, data);
}

async function getUserHistory(userId) {
    const data = await loadJSON(FILES.history);
    return data[userId.toString()] || [];
}

module.exports = {
    saveUserGlobal,
    createUser,
    getAllUsersList,
    getUserData,
    updateUserStats,
    updateBalance,
    setVIP,
    checkVIP,
    logRevenue,
    getAdminRevenueStats,
    getMemberStats,
    logUserHistory,
    getUserHistory,
    setSupport,
    setCTV,
    checkRole
};
