/**
 * [WORM-GPT v2] WALL CAPTURE SERVICE
 * Gọi Python script để chụp wall Facebook khi UID die
 * Trả về Buffer ảnh hoặc null nếu lỗi
 */

const { exec } = require('child_process');
const path = require('path');
const fs = require('fs').promises;

const SCRIPT_PATH = path.join(__dirname, '..', 'wall_capture.py');
const CAPTURE_TIMEOUT = 30000; // 30s timeout (lần đầu có thể lâu do download ChromeDriver)

/**
 * Chụp wall Facebook của UID
 * @param {string} uid - Facebook UID
 * @returns {Promise<Buffer|null>} - Screenshot buffer hoặc null nếu lỗi
 */
async function captureWall(uid) {
    if (!uid || !/^\d{4,}$/.test(uid.toString())) {
        return null;
    }

    return new Promise((resolve) => {
        const cmd = `python "${SCRIPT_PATH}" ${uid}`;

        exec(cmd, { timeout: CAPTURE_TIMEOUT }, async (error, stdout, stderr) => {
            if (error) {
                console.log(`[WallCapture] ❌ Error for UID ${uid}:`, error.message);
                resolve(null);
                return;
            }

            const filePath = (stdout || '').trim();

            if (!filePath || !filePath.endsWith('.png')) {
                console.log(`[WallCapture] ⚠️ No screenshot for UID ${uid}`);
                resolve(null);
                return;
            }

            try {
                // Đọc file ảnh thành Buffer
                const buffer = await fs.readFile(filePath);

                // Xóa file tạm sau khi đọc xong
                try {
                    await fs.unlink(filePath);
                } catch (e) {
                    // Không sao nếu xóa không được, autoClean sẽ dọn sau
                }

                console.log(`[WallCapture] ✅ Captured wall for UID ${uid} (${Math.round(buffer.length / 1024)}KB)`);
                resolve(buffer);
            } catch (readErr) {
                console.log(`[WallCapture] ❌ Read file error:`, readErr.message);
                resolve(null);
            }
        });
    });
}

/**
 * Dọn dẹp screenshot cũ (gọi định kỳ nếu cần)
 */
async function cleanOldScreenshots() {
    const dir = path.join(__dirname, '..', 'data', 'wall_screenshots');
    try {
        const files = await fs.readdir(dir);
        const now = Date.now();
        for (const file of files) {
            const filePath = path.join(dir, file);
            try {
                const stat = await fs.stat(filePath);
                // Xóa file > 1 giờ
                if (now - stat.mtimeMs > 3600000) {
                    await fs.unlink(filePath);
                }
            } catch {}
        }
    } catch {}
}

module.exports = { captureWall, cleanOldScreenshots };
