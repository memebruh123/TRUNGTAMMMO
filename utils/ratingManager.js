const { loadJSON, saveJSON } = require('../services/storage');
const { FILES } = require('../config/constants');
const { getCurrentTimestamp } = require('../utils/helpers');

async function saveRating(userId, userName, role, stars, message) {
    const data = await loadJSON(FILES.ratings);

    const ratingEntry = {
        user_id: userId,
        user_name: userName,
        role: role,
        stars: stars,
        message: message,
        timestamp: getCurrentTimestamp(),
        date: new Date().toLocaleString('vi-VN')
    };

    data.push(ratingEntry);
    await saveJSON(FILES.ratings, data);

    return ratingEntry;
}

async function getAllRatings(limit = 50) {
    const data = await loadJSON(FILES.ratings);
    return data.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)).slice(0, limit);
}

async function getRatingStats() {
    const data = await loadJSON(FILES.ratings);

    if (!data || data.length === 0) {
        return {
            total: 0,
            average: 0,
            distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
        };
    }

    const total = data.length;
    const starsSum = data.reduce((sum, r) => sum + (r.stars || 0), 0);
    const average = Math.round((starsSum / total) * 10) / 10;

    const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

    for (const r of data) {
        const star = r.stars || 0;
        if (star >= 1 && star <= 5) {
            distribution[star] += 1;
        }
    }

    return { total, average, distribution };
}

module.exports = {
    saveRating,
    getAllRatings,
    getRatingStats
};
