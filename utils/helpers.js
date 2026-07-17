const Decimal = require('decimal.js');
const dayjs = require('dayjs');

function formatVND(amount) {
    try {
        const amountDecimal = new Decimal(amount.toString());
        const amountInt = parseInt(amountDecimal.toFixed(0, Decimal.ROUND_HALF_UP));
        return amountInt.toLocaleString('vi-VN') + ' VNĐ';
    } catch {
        return '0 VNĐ';
    }
}

function getTimeDiff(timestamp) {
    if (!timestamp || timestamp === 0) return 'vừa xong';
    try {
        const startTime = dayjs.unix(timestamp);
        const currentTime = dayjs();
        const duration = currentTime.diff(startTime, 'second');
        if (duration < 60) return `${duration} giây`;
        const days = Math.floor(duration / 86400);
        const hours = Math.floor((duration % 86400) / 3600);
        const minutes = Math.floor((duration % 3600) / 60);
        if (days > 0) return `${days} ngày`;
        if (hours > 0) return `${hours} giờ`;
        return `${minutes} phút`;
    } catch { return 'vừa xong'; }
}

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

function shuffleArray(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

function randomChoice(array) { return array[Math.floor(Math.random() * array.length)]; }
function getCurrentTimestamp() { return Math.floor(Date.now() / 1000); }
function formatDateTime(timestamp) { return dayjs.unix(timestamp).format('DD/MM/YYYY HH:mm:ss'); }
function formatDate(timestamp) { return dayjs.unix(timestamp).format('YYYY-MM-DD'); }

// In-memory FAQ cache
const faqCache = new Map();
const FAQ_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function getFAQCode(uid) {
    if (!uid || !/^\d{4,}$/.test(uid)) return { code: null, isFAQ: false };

    // Check in-memory cache (TTL 5 minutes)
    const cached = faqCache.get(uid);
    if (cached && (Date.now() - cached.ts < FAQ_CACHE_TTL)) {
        return cached.result;
    }

    const { exec } = require('child_process');
    const path = require('path');
    const { FAQ_CODES } = require('../config/constants');
    const scriptPath = path.join(__dirname, '../faq.py');

    const FAQ_MAX_RETRIES = 3;
    const FAQ_RETRY_DELAY = 2000;

    for (let attempt = 0; attempt < FAQ_MAX_RETRIES; attempt++) {
        try {
            const code = await new Promise((resolve) => {
                exec(`python "${scriptPath}" ${uid}`, { timeout: 10000 }, (error, stdout) => {
                    if (error || !stdout) { resolve(null); return; }
                    const trimmed = stdout.trim();
                    if (/^\d{3}$/.test(trimmed)) resolve(trimmed);
                    else resolve(null);
                });
            });

            if (code) {
                const isFAQ = FAQ_CODES.includes(code);
                const result = { code, isFAQ };
                faqCache.set(uid, { result, ts: Date.now() });
                return result;
            }

            if (attempt < FAQ_MAX_RETRIES - 1) {
                await sleep(FAQ_RETRY_DELAY);
            }
        } catch (err) {
            if (attempt < FAQ_MAX_RETRIES - 1) {
                await sleep(FAQ_RETRY_DELAY);
            }
        }
    }

    // Cache null result too
    const nullResult = { code: null, isFAQ: false };
    faqCache.set(uid, { result: nullResult, ts: Date.now() });
    return nullResult;
}



// HÀM GỬI LOG ADMIN (DEBUG MODE - FULL LOGS)
async function notifyAdmins(message) {
    try {
        const { getAdmins } = require('./adminManager');
        const { sendMessage } = require('../services/telegram');

        const allAdmins = await getAdmins();
        const adminList = Array.from(allAdmins);

        // DEBUG: Always show logs
        console.log('📢 [ADMIN_LOG]', message.replace(/\n/g, ' '));

        // Force show all (disabled silent mode)
        const isCritical = true;

        if (!isCritical) {
            console.log('[LOG SILENT]', message.replace(/\n/g, ' '));
            return;
        }

        if (adminList.length === 0) {
            console.log('⚠️ No admins found');
            return;
        }

        for (const adminId of adminList) {
            try {
                await sendMessage(adminId, `🔔 **THÔNG BÁO HỆ THỐNG**\n${message}`);
            } catch (e) {
                console.log(`Failed notify admin ${adminId}`);
            }
        }
    } catch (err) {
        console.error('notifyAdmins error:', err);
    }
}

function escapeMarkdown(text) {
    if (!text) return '';
    return text.toString().replace(/[_*[\]`]/g, '\\$&');
}

module.exports = {
    formatVND, getTimeDiff, sleep, shuffleArray, randomChoice,
    getCurrentTimestamp, formatDateTime, formatDate, getFAQCode, notifyAdmins, escapeMarkdown
};
