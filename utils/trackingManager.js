const { loadJSON, saveJSON } = require('../services/storage');
const { FILES } = require('../config/constants');
const { getCurrentTimestamp } = require('../utils/helpers');

async function saveTrackingUID(chatId, uid, name, note, price, trackType = 'normal', initialStatus = 'UNKNOWN', part = 0) {
    const data = await loadJSON(FILES.tracking);
    const strChatId = chatId.toString();

    if (!data[strChatId]) {
        data[strChatId] = {};
    }

    data[strChatId][uid.toString()] = {
        name: name,
        note: note,
        price: price,
        status: 'waiting',
        last_check: initialStatus,
        start_time: getCurrentTimestamp(),
        track_type: trackType,
        part: part // Số lần DIE (tăng khi autoCheck phát hiện DIE)
    };

    await saveJSON(FILES.tracking, data);
    await manageUIDMemory(uid, name, initialStatus);
}

async function getTracking() {
    return await loadJSON(FILES.tracking);
}

async function removeTrackingUID(chatId, uid) {
    const data = await loadJSON(FILES.tracking);
    const strChatId = chatId.toString();

    if (data[strChatId] && data[strChatId][uid.toString()]) {
        delete data[strChatId][uid.toString()];
        await saveJSON(FILES.tracking, data);
        return true;
    }

    return false;
}

async function markDoneUID(chatId, uid) {
    const data = await loadJSON(FILES.tracking);
    const strChatId = chatId.toString();

    if (data[strChatId] && data[strChatId][uid.toString()]) {
        data[strChatId][uid.toString()].status = 'done';
        await saveJSON(FILES.tracking, data);
        return true;
    }

    return false;
}

async function manageUIDMemory(uid, name, status) {
    try {
        const data = await loadJSON(FILES.uid_memory);
        const strUid = uid.toString();
        const currentTime = getCurrentTimestamp();

        if (!data[strUid]) {
            data[strUid] = {
                name: name || `UID ${uid}`,
                last_status: status,
                timestamp: currentTime,
                start_time: currentTime,
                last_status_change: currentTime
            };
        } else {
            const oldStatus = data[strUid].last_status;

            if (name) {
                data[strUid].name = name;
            }

            if (oldStatus !== status) {
                data[strUid].last_status = status;
                data[strUid].last_status_change = currentTime;
            }

            data[strUid].timestamp = currentTime;
        }

        await saveJSON(FILES.uid_memory, data);
        return data[strUid];
    } catch {
        return {};
    }
}

async function getUIDMemory(uid) {
    const data = await loadJSON(FILES.uid_memory);
    return data[uid.toString()] || null;
}

module.exports = {
    saveTrackingUID,
    getTracking,
    removeTrackingUID,
    markDoneUID,
    manageUIDMemory,
    getUIDMemory
};
