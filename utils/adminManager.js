const fs = require('fs').promises;
const path = require('path');
const { ADMIN_IDS } = require('../config/constants'); // Admin cứng
const { loadJSON, saveJSON } = require('../services/storage');

const ADMIN_FILE_PATH = path.join(__dirname, '../data/admins.json');

// Get all admins (Set)
async function getAdmins() {
    let dynamicAdmins = await loadJSON(ADMIN_FILE_PATH);
    if (!Array.isArray(dynamicAdmins)) {
        dynamicAdmins = [];
    }
    const allAdmins = new Set([...ADMIN_IDS, ...dynamicAdmins]);
    return allAdmins;
}

// Check Is Admin
// Check Is Admin
async function isAdmin(userId) {
    // --- [WORM-GPT] Fake Guest Check ---
    try {
        // Require lazily to avoid circular dependency
        const { getUserState } = require('../services/telegram');
        const state = getUserState(userId);
        if (state && state.fakeGuest) return false; // Giả vờ là dân thường
    } catch (e) {
        // Ignore error if circular dep issues or service not ready
    }
    // -----------------------------------

    const admins = await getAdmins();
    return admins.has(userId.toString()) || admins.has(parseInt(userId));
}

// Add Admin
async function addAdmin(userId) {
    let dynamicAdmins = await loadJSON(ADMIN_FILE_PATH) || [];
    const uidStr = userId.toString();

    if (!dynamicAdmins.includes(uidStr)) {
        dynamicAdmins.push(uidStr);
        await saveJSON(ADMIN_FILE_PATH, dynamicAdmins);
        return true;
    }
    return false; // Đã tồn tại
}

// Remove Admin
async function removeAdmin(userId) {
    let dynamicAdmins = await loadJSON(ADMIN_FILE_PATH) || [];
    const uidStr = userId.toString();

    // Không cho xóa Admin cứng
    if (ADMIN_IDS.has(uidStr) || ADMIN_IDS.has(parseInt(userId))) {
        return 'HARD_CODED';
    }

    if (dynamicAdmins.includes(uidStr)) {
        dynamicAdmins = dynamicAdmins.filter(id => id !== uidStr);
        await saveJSON(ADMIN_FILE_PATH, dynamicAdmins);
        return true;
    }
    return false; // Không tìm thấy
}

module.exports = {
    getAdmins,
    isAdmin,
    addAdmin,
    removeAdmin
};
