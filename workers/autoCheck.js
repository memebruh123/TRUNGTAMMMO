const pLimit = require('p-limit');
const { checkUIDLiveDie } = require('../services/facebook');
const { getTracking, manageUIDMemory, getUIDMemory } = require('../utils/trackingManager');
const { sendMessage } = require('../services/telegram');
const { getProfileInfo } = require('../services/facebookInfo');
const { loadJSON, saveJSON } = require('../services/storage');
const { FILES, MAX_CONCURRENT_CHECKS, AUTO_CHECK_INTERVAL, NOTIFY_ON_RESTART, DIE_CONFIRM_COUNT } = require('../config/constants');
const { sleep, shuffleArray, getTimeDiff, formatVND, getFAQCode } = require('../utils/helpers');

const limit = pLimit(MAX_CONCURRENT_CHECKS);
const dieConfirmMap = new Map();
const unknownCountMap = new Map(); // [WORM-GPT FIX v2] Đếm số lần UNKNOWN liên tục
const UNKNOWN_ALERT_THRESHOLD = 5; // Sau 5 lần UNKNOWN → cảnh báo Admin
let isFirstRun = true;

async function checkSingleUID(uid, info, chatId) {
    if (info.status === 'done') return null;

    try {
        const res = await checkUIDLiveDie(uid);
        const currStatus = res.status;
        const currInfo = res.info;
        const lastStatus = info.last_check || 'UNKNOWN';
        const confirmKey = `${chatId}:${uid}`;

        // --- [WORM-GPT FIX v2] UNKNOWN TRACKING ---
        // Không bỏ qua hoàn toàn UNKNOWN nữa — đếm số lần liên tiếp
        if (currStatus === 'UNKNOWN') {
            const prevCount = unknownCountMap.get(confirmKey) || 0;
            const newCount = prevCount + 1;
            unknownCountMap.set(confirmKey, newCount);

            // Nếu UNKNOWN quá nhiều lần liên tục → Cảnh báo Admin 1 lần
            if (newCount === UNKNOWN_ALERT_THRESHOLD) {
                console.log(`[autoCheck] ⚠️ UID ${uid} bị UNKNOWN ${newCount} lần liên tục! Có thể lỗi Proxy/API.`);
                try {
                    const { notifyAdmins } = require('../utils/helpers');
                    notifyAdmins(`⚠️ **CẢNH BÁO CHECK UID**\n\n🆔 UID: \`${uid}\`\n👤 Tên: ${info.name || 'N/A'}\n❓ Trạng thái: UNKNOWN ${newCount} lần liên tục\n💡 Nguyên nhân: ${currInfo}\n\n🔧 Kiểm tra Proxy hoặc Facebook API!`);
                } catch (e) { }
            }
            return null;
        }

        // Reset UNKNOWN counter khi có kết quả rõ ràng
        unknownCountMap.set(confirmKey, 0);

        const memInfo = await manageUIDMemory(uid, info.name, currStatus);
        const lastStatusChange = memInfo.last_status_change || 0;

        // Reset confirmation counter when UID comes back LIVE
        if (currStatus === 'LIVE') {
            dieConfirmMap.set(confirmKey, 0);
        }

        if (lastStatus === 'UNKNOWN') {
            return {
                uid: uid,
                info: info,
                chatId: chatId,
                curr: currStatus,
                currInfo: currInfo,
                update: true,
                notify: false
            };
        }

        if (currStatus !== lastStatus && (currStatus === 'LIVE' || currStatus === 'DIE')) {
            // Thấy đổi trạng thái là Bú luôn - không chờ lần 2 lần 3 gì hết theo lệnh Anh Tiến
            return {
                uid: uid,
                info: info,
                chatId: chatId,
                curr: currStatus,
                currInfo: currInfo,
                update: true,
                notify: true, // Notify luôn
                duration_ts: lastStatusChange,
                mem_name: memInfo.name
            };
        }

        if (NOTIFY_ON_RESTART && isFirstRun && currStatus === 'DIE') {
            return {
                uid: uid,
                info: info,
                chatId: chatId,
                curr: currStatus,
                currInfo: currInfo,
                update: false,
                notify: true,
                duration_ts: lastStatusChange,
                mem_name: memInfo.name
            };
        }

        return null;
    } catch (err) {
        console.error(`Error checking UID ${uid}:`, err.message);
        return null;
    }
}

async function autoCheckThread() {
    // console.log('Auto-check thread started');

    while (true) {
        try {
            const data = await getTracking();

            if (!data || Object.keys(data).length === 0) {
                await sleep(AUTO_CHECK_INTERVAL);
                continue;
            }

            const tasks = [];
            for (const [chatId, uids] of Object.entries(data)) {
                for (const [uid, info] of Object.entries(uids)) {
                    tasks.push({ uid, info: { ...info }, chatId });
                }
            }

            if (tasks.length === 0) {
                await sleep(AUTO_CHECK_INTERVAL);
                continue;
            }

            const shuffledTasks = shuffleArray(tasks);
            const promises = shuffledTasks.map(task =>
                limit(() => checkSingleUID(task.uid, task.info, task.chatId))
            );

            const results = await Promise.all(promises);
            const pendingNotes = [];

            for (const result of results) {
                if (!result) continue;

                const { uid, chatId, curr, update, notify, duration_ts, mem_name, currInfo } = result;

                if (update) {
                    const trackingData = await loadJSON(FILES.tracking);
                    if (trackingData[chatId] && trackingData[chatId][uid]) {
                        trackingData[chatId][uid].last_check = curr;
                        if (curr === 'DIE') {
                            const currentPart = trackingData[chatId][uid].part || 0;
                            trackingData[chatId][uid].part = currentPart + 1;
                        }
                        await saveJSON(FILES.tracking, trackingData);
                    }
                }

                if (notify) {
                    const trackingData = await loadJSON(FILES.tracking);
                    if (trackingData[chatId] && trackingData[chatId][uid]) {
                        pendingNotes.push({
                            uid,
                            info: trackingData[chatId][uid],
                            chatId,
                            curr,
                            currInfo,
                            duration_ts: duration_ts || 0,
                            mem_name: mem_name || trackingData[chatId][uid].name
                        });
                    }
                }
            }

            for (const note of pendingNotes) {
                try {
                    const chatId = parseInt(note.chatId);
                    const uidStr = note.uid;
                    const currStatus = note.curr;
                    const isLive = currStatus === 'LIVE';

                    let telegramName = 'SẾP';
                    try {
                        const { getChatMember } = require('../services/telegram');
                        const chatInfo = await getChatMember(chatId, chatId);
                        if (chatInfo && chatInfo.user) telegramName = (chatInfo.user.first_name || 'SẾP').toUpperCase();
                    } catch { }

                    const name = note.info.name || 'Facebook User';
                    const noteText = note.info.note || 'Không có';
                    const price = note.info.price || 0;
                    const part = note.info.part || 0;
                    const startTime = note.info.start_time || 0;
                    const totalTimeStr = getTimeDiff(startTime);

                    // Khi sống lại → gọi lại getProfileInfo lấy tên + avatar mới nhất
                    let freshName = name;
                    let freshAvatar = null;
                    if (isLive) {
                        try {
                            const profile = await getProfileInfo(uidStr);
                            if (profile.name && profile.name !== 'Name not found') {
                                freshName = profile.name;
                            }
                            if (profile.avatar && profile.avatar !== 'Profile picture URL not found') {
                                freshAvatar = profile.avatar;
                            }
                        } catch (e) {
                            console.log(`[autoCheck] Failed to fetch profile for ${uidStr}:`, e.message);
                        }
                    }

                    // --- [WORM-GPT v2] CAPTION ĐẸP + CHI TIẾT ---
                    const { buildStatusChangeCaption, buildUIDButtons } = require('../utils/userDashboard');

                    const msg = buildStatusChangeCaption({
                        telegramName,
                        name: freshName,
                        uid: uidStr,
                        isLive,
                        part,
                        price,
                        note: noteText,
                        startTime,
                        statusChangeTime: Math.floor(Date.now() / 1000)
                    });

                    const buttons = buildUIDButtons(uidStr, currStatus);

                    const notifications = require('../childbot/notifications');
                    const markup = { inline_keyboard: buttons };

                    // --- [WORM-GPT v2] SMART LOG: Kiểm tra admin log level ---
                    const { isAdmin } = require('../utils/adminManager');
                    const { shouldNotifyAdmin, pushToBuffer } = require('../utils/smartLog');
                    const isUserAdmin = await isAdmin(chatId);

                    // Push event vào buffer cho adminReport (luôn luôn)
                    pushToBuffer({
                        uid: uidStr,
                        name: freshName,
                        status: currStatus,
                        chatId: chatId,
                        type: currStatus === 'DIE' ? 'UID_DIE' : 'UID_LIVE',
                        part: part,
                        price: price
                    });

                    // Nếu là Admin → check có nên gửi notification trực tiếp không
                    if (isUserAdmin) {
                        const shouldSend = await shouldNotifyAdmin(chatId, {
                            uid: uidStr,
                            name: freshName,
                            status: currStatus,
                            type: currStatus === 'DIE' ? 'UID_DIE' : 'UID_LIVE'
                        });

                        if (!shouldSend) {
                            // Admin ở chế độ SUMMARY/CRITICAL/OFF → skip notification trực tiếp
                            // Event đã được lưu vào buffer để gửi summary sau
                            continue;
                        }
                    }

                    // Gửi notification cho user (hoặc admin nếu level=ALL)
                    if (!isLive) {
                        // [WORM-GPT v2] Chụp wall Facebook khi DIE
                        let wallBuffer = null;
                        try {
                            const { captureWall } = require('../services/wallCapture');
                            wallBuffer = await captureWall(uidStr);
                        } catch (wallErr) {
                            console.log(`[autoCheck] Wall capture error for ${uidStr}:`, wallErr.message);
                        }

                        if (wallBuffer) {
                            // Gửi ảnh wall Facebook kèm caption DIE
                            await notifications.sendPhoto(chatId, wallBuffer, { caption: msg, reply_markup: markup });
                        } else {
                            // Fallback: gửi GIF nếu chụp wall thất bại
                            const gifUrl = 'https://media.tenor.com/oL5JRBn5Oj4AAAAM/6.gif';
                            await notifications.sendAnimation(chatId, gifUrl, { caption: msg, reply_markup: markup, has_spoiler: true });
                        }
                    } else if (freshAvatar) {
                        await notifications.sendPhoto(chatId, freshAvatar, { caption: msg, reply_markup: markup, has_spoiler: true });
                    } else {
                        await notifications.sendText(chatId, msg, { reply_markup: markup });
                    }
                } catch (err) {
                    console.error('Error sending notification:', err.message);
                }
            }

            if (isFirstRun) {
                isFirstRun = false;
                // console.log('First run completed.');
            }

            await sleep(AUTO_CHECK_INTERVAL);
        } catch (err) {
            console.error('Auto-check thread error:', err.message);
            await sleep(AUTO_CHECK_INTERVAL);
        }
    }
}

module.exports = { autoCheckThread, checkSingleUID };
