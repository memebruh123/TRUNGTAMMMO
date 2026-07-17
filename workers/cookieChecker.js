const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const { ADMIN_IDS } = require('../config/constants');
const { sendMessage } = require('../services/telegram');
const { loadCookie } = require('../services/facebookInfo');

const COOKIE_CHECK_INTERVAL = 30 * 60 * 1000; // Check mỗi 30 phút

async function checkCookieAlive() {
    try {
        const cookiePath = path.join(__dirname, '..', 'data', 'cookie.txt');
        let cookie;
        try {
            cookie = await fs.readFile(cookiePath, 'utf8');
            cookie = cookie.trim();
        } catch {
            return; // Chưa có cookie thì thôi
        }

        if (!cookie) return;

        // Request thử vào mbasic để check login
        const response = await axios.get('https://mbasic.facebook.com/profile.php', {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Linux; Android 12; Pixel 6 Build/SQ3A.220705.004; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/136.0.0.0 Mobile Safari/537.36',
                'Cookie': cookie,
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8'
            },
            maxRedirects: 0, // Không follow redirect để bắt 302 về login
            validateStatus: null // Chấp nhận mọi status code
        });

        // Nếu bị redirect (302) về login hoặc nội dung chứa "Log In"
        if (response.headers.location && response.headers.location.includes('login')) {
            await notifyCookieDie();
        } else if (response.data && typeof response.data === 'string' && response.data.includes('name="login"')) {
            await notifyCookieDie();
        } else {
            // console.log('✅ Cookie is LIVE');
        }

    } catch (err) {
        // console.error('Error checking cookie:', err.message);
    }
}

let lastNotificationTime = 0;

async function notifyCookieDie() {
    // Tránh spam thông báo (tối thiểu 1 tiếng báo 1 lần)
    const now = Date.now();
    if (now - lastNotificationTime < 60 * 60 * 1000) return;

    lastNotificationTime = now;

    const alertMsg = `⚠️ **CẢNH BÁO: COOKIE DIE!** ⚠️
    
Hệ thống phát hiện Cookie Facebook đã hết hạn hoặc bị đăng xuất.
Tính năng lấy tên/ảnh sẽ không hoạt động chính xác.

👉 **VUI LÒNG CẬP NHẬT NGAY:**
Gõ lệnh: \`/setcookie <cookie_mới>\``;

    for (const adminId of ADMIN_IDS) {
        try {
            await sendMessage(adminId, alertMsg);
        } catch { }
    }
}

async function cookieCheckThread() {
    // Check ngay khi start
    await checkCookieAlive();

    setInterval(async () => {
        await checkCookieAlive();
    }, COOKIE_CHECK_INTERVAL);
}

module.exports = {
    cookieCheckThread
};
