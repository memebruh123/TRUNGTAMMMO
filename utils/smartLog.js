/**
 * [WORM-GPT v2] SMART LOG MODULE
 * File riêng biệt — quản lý mức độ log cho Admin
 * 
 * Levels:
 *   ALL      → Admin nhận mọi thông báo die/live (như user)
 *   SUMMARY  → Không nhận từng UID, chỉ nhận tổng hợp
 *   CRITICAL → Chỉ nhận khi batch die (>3 cùng lúc) hoặc proxy sập
 *   OFF      → Im lặng hoàn toàn
 */

const path = require('path');
const { loadJSON, saveJSON } = require('../services/storage');
const { FILES } = require('../config/constants');

const VALID_LEVELS = ['ALL', 'SUMMARY', 'CRITICAL', 'OFF'];
const DEFAULT_LEVEL = 'ALL';

// Buffer lưu events để gửi summary
const eventBuffer = [];
const MAX_BUFFER = 200;

/**
 * Lấy log level hiện tại của admin
 */
async function getAdminLogLevel() {
    try {
        const config = await loadJSON(FILES.config);
        const level = config.admin_log_level || DEFAULT_LEVEL;
        return VALID_LEVELS.includes(level) ? level : DEFAULT_LEVEL;
    } catch (e) {
        return DEFAULT_LEVEL;
    }
}

/**
 * Set log level cho admin
 */
async function setAdminLogLevel(level) {
    const upperLevel = (level || '').toUpperCase();
    if (!VALID_LEVELS.includes(upperLevel)) {
        return { success: false, error: `Level không hợp lệ. Chọn: ${VALID_LEVELS.join(', ')}` };
    }

    try {
        const configPath = FILES.config;
        const config = await loadJSON(configPath);
        config.admin_log_level = upperLevel;
        await saveJSON(configPath, config);
        return { success: true, level: upperLevel };
    } catch (e) {
        return { success: false, error: e.message };
    }
}

/**
 * Kiểm tra admin có được nhận notification từng UID không
 * Dùng trong autoCheck trước khi gửi thông báo
 */
async function shouldNotifyAdmin(adminId, event = {}) {
    const level = await getAdminLogLevel();

    switch (level) {
        case 'ALL':
            return true;

        case 'SUMMARY':
            // Lưu vào buffer, KHÔNG gửi trực tiếp
            pushToBuffer(event);
            return false;

        case 'CRITICAL':
            // Chỉ gửi khi batch die hoặc proxy issue
            pushToBuffer(event);
            if (event.type === 'PROXY_ERROR') return true;
            if (event.type === 'BATCH_DIE') return true;
            return false;

        case 'OFF':
            pushToBuffer(event); // Vẫn lưu buffer cho report
            return false;

        default:
            return true;
    }
}

/**
 * Push event vào buffer (cho summary report)
 */
function pushToBuffer(event) {
    if (!event || !event.uid) return;

    eventBuffer.push({
        ...event,
        timestamp: Date.now()
    });

    // Giữ buffer không quá MAX
    if (eventBuffer.length > MAX_BUFFER) {
        eventBuffer.splice(0, eventBuffer.length - MAX_BUFFER);
    }
}

/**
 * Lấy events từ buffer (cho adminReport.js dùng)
 */
function getBufferedEvents(sinceMs = 0) {
    if (sinceMs <= 0) return [...eventBuffer];
    return eventBuffer.filter(e => e.timestamp >= sinceMs);
}

/**
 * Clear buffer sau khi đã gửi report
 */
function clearBuffer() {
    eventBuffer.length = 0;
}

/**
 * Lấy thống kê nhanh cho admin panel
 */
function getLogStats() {
    const now = Date.now();
    const last1h = eventBuffer.filter(e => now - e.timestamp < 3600000);
    const last6h = eventBuffer.filter(e => now - e.timestamp < 21600000);

    const dieEvents1h = last1h.filter(e => e.status === 'DIE');
    const liveEvents1h = last1h.filter(e => e.status === 'LIVE');

    return {
        buffer_size: eventBuffer.length,
        last_1h: {
            total: last1h.length,
            die: dieEvents1h.length,
            live: liveEvents1h.length
        },
        last_6h: {
            total: last6h.length,
            die: last6h.filter(e => e.status === 'DIE').length,
            live: last6h.filter(e => e.status === 'LIVE').length
        }
    };
}

module.exports = {
    getAdminLogLevel,
    setAdminLogLevel,
    shouldNotifyAdmin,
    pushToBuffer,
    getBufferedEvents,
    clearBuffer,
    getLogStats,
    VALID_LEVELS
};
