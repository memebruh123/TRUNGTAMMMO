/**
 * [WORM-GPT v2] AUTO BACKUP WORKER
 * File riêng biệt — backup dữ liệu quan trọng mỗi ngày
 * 
 * Backup files:
 *   - data_tracking.json
 *   - data_users.json
 *   - uid_memory.json
 *   - data_config.json
 *   - all_users.json
 */

const fs = require('fs').promises;
const path = require('path');
const { sleep } = require('../utils/helpers');
const { sendMessage } = require('../services/telegram');
const { getAdmins } = require('../utils/adminManager');

const BACKUP_DIR = path.join(__dirname, '..', 'backup');
const BACKUP_INTERVAL = 24 * 60 * 60 * 1000; // 24h
const MAX_BACKUPS = 7; // Giữ tối đa 7 ngày backup

const FILES_TO_BACKUP = [
    'data/data_tracking.json',
    'data/data_users.json',
    'data/uid_memory.json',
    'data/data_config.json',
    'data/all_users.json',
    'data/data_revenue.json'
];

/**
 * Tạo backup tất cả file quan trọng
 */
async function createBackup() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0]; // YYYY-MM-DD
    const backupFolder = path.join(BACKUP_DIR, timestamp);

    try {
        // Tạo thư mục backup
        await fs.mkdir(backupFolder, { recursive: true });

        let successCount = 0;
        let failCount = 0;
        const errors = [];

        for (const file of FILES_TO_BACKUP) {
            const srcPath = path.join(__dirname, '..', file);
            const destPath = path.join(backupFolder, path.basename(file));

            try {
                await fs.access(srcPath);
                await fs.copyFile(srcPath, destPath);
                successCount++;
            } catch (e) {
                if (e.code !== 'ENOENT') {
                    failCount++;
                    errors.push(`${path.basename(file)}: ${e.message}`);
                }
                // Skip nếu file không tồn tại (ENOENT)
            }
        }

        console.log(`[Backup] ✅ Backup completed: ${successCount} files → ${backupFolder}`);

        return {
            success: true,
            folder: backupFolder,
            date: timestamp,
            files: successCount,
            failed: failCount,
            errors
        };
    } catch (err) {
        console.error(`[Backup] ❌ Error: ${err.message}`);
        return { success: false, error: err.message };
    }
}

/**
 * Xóa backup cũ quá MAX_BACKUPS ngày
 */
async function cleanOldBackups() {
    try {
        await fs.mkdir(BACKUP_DIR, { recursive: true });
        const folders = await fs.readdir(BACKUP_DIR);

        // Sort theo tên (YYYY-MM-DD) → cũ nhất đầu tiên
        const sorted = folders.sort();

        if (sorted.length > MAX_BACKUPS) {
            const toDelete = sorted.slice(0, sorted.length - MAX_BACKUPS);
            for (const folder of toDelete) {
                const folderPath = path.join(BACKUP_DIR, folder);
                try {
                    await fs.rm(folderPath, { recursive: true, force: true });
                    console.log(`[Backup] 🗑️ Deleted old backup: ${folder}`);
                } catch (e) { }
            }
        }
    } catch (e) {
        console.error(`[Backup] Clean error: ${e.message}`);
    }
}

/**
 * Liệt kê các backup hiện có
 */
async function listBackups() {
    try {
        await fs.mkdir(BACKUP_DIR, { recursive: true });
        const folders = await fs.readdir(BACKUP_DIR);
        const result = [];

        for (const folder of folders.sort().reverse()) {
            const folderPath = path.join(BACKUP_DIR, folder);
            try {
                const stat = await fs.stat(folderPath);
                if (stat.isDirectory()) {
                    const files = await fs.readdir(folderPath);
                    result.push({
                        date: folder,
                        files: files.length,
                        path: folderPath
                    });
                }
            } catch (e) { }
        }

        return result;
    } catch (e) {
        return [];
    }
}

/**
 * Thông báo admin kết quả backup
 */
async function notifyBackupResult(result) {
    try {
        const admins = await getAdmins();
        let msg = '';

        if (result.success) {
            msg = `💾 **AUTO BACKUP HOÀN TẤT**\n\n` +
                `📅 Ngày: ${result.date}\n` +
                `📁 Files: ${result.files} thành công\n`;
            if (result.failed > 0) {
                msg += `⚠️ Lỗi: ${result.failed} file\n`;
                result.errors.forEach(e => msg += `  └ ${e}\n`);
            }
        } else {
            msg = `❌ **BACKUP THẤT BẠI!**\n\n💡 Lỗi: ${result.error}`;
        }

        // Chỉ báo nếu có lỗi hoặc admin log level != OFF
        const { getAdminLogLevel } = require('../utils/smartLog');
        const level = await getAdminLogLevel();

        if (result.failed > 0 || !result.success || level === 'ALL') {
            for (const adminId of admins) {
                try { await sendMessage(adminId, msg); } catch (e) { }
            }
        }
    } catch (e) { }
}

/**
 * Worker thread chính
 */
async function autoBackupThread() {
    // console.log('💾 Auto backup worker started');

    // Đợi 60s cho bot ổn định
    await sleep(60000);

    // Backup ngay lúc start
    const result = await createBackup();
    await cleanOldBackups();
    // Không notify lần đầu để tránh spam khi restart

    while (true) {
        try {
            await sleep(BACKUP_INTERVAL);

            const result = await createBackup();
            await cleanOldBackups();
            await notifyBackupResult(result);

        } catch (err) {
            console.error('[Backup] Thread error:', err.message);
            await sleep(60000);
        }
    }
}

module.exports = {
    autoBackupThread,
    createBackup,
    listBackups,
    cleanOldBackups
};
