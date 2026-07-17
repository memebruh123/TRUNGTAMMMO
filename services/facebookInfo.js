const axios = require('axios');
const { exec } = require('child_process');
const path = require('path');

// Hàm lấy UID từ Link (Cải tiến)
async function getUIDFromLink(link) {
    if (!link) return { uid: null, name: null };
    link = link.trim();
    if (/^\d+$/.test(link)) return { uid: link, name: null };

    // 1. Phân giải nhanh id=...
    const idMatch = link.match(/[?&]id=(\d+)/) || link.match(/\/id=(\d+)/);
    if (idMatch) return { uid: idMatch[1], name: null };

    // 2. Thử API traodoisub (Rất mạnh)
    try {
        const response = await axios.post('https://id.traodoisub.com/api.php',
            new URLSearchParams({ link: link }).toString(),
            { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 3000 }
        );
        if (response.data && response.data.code === 200) {
            return { uid: response.data.id, name: null };
        }
    } catch (e) { }

    // 3. Regex fallback cho các loại link
    // Profile: facebook.com/zuck
    // Groups member: facebook.com/groups/.../user/1000...
    // Reels: facebook.com/reel/123...

    const patterns = [
        /facebook\.com\/groups\/.*?\/user\/(\d+)/,
        /facebook\.com\/profile\.php\?id=(\d+)/,
        /facebook\.com\/(?:people\/.*?\/|)([a-zA-Z0-9.]+)/
    ];

    for (const pattern of patterns) {
        const match = link.match(pattern);
        if (match) {
            if (/^\d+$/.test(match[1])) {
                return { uid: match[1], name: null };
            } else if (!['profile.php', 'watch', 'groups', 'gaming', 'reels', 'reel', 'posts', 'story.php'].includes(match[1])) {
                return { uid: null, name: match[1] };
            }
        }
    }

    return { uid: null, name: null };
}

// HÀM GỌI PYTHON ĐỂ LẤY INFO
function getProfileInfo(uid) {
    return new Promise((resolve) => {
        const scriptPath = path.join(__dirname, '../name.py');
        // Gọi lệnh python
        console.log(`[name.py] Calling: python "${scriptPath}" ${uid}`);
        exec(`python "${scriptPath}" ${uid}`, { timeout: 20000 }, (error, stdout, stderr) => {
            if (stderr) console.log(`[name.py stderr] ${stderr.trim()}`);
            if (stdout) console.log(`[name.py stdout] ${stdout.trim()}`);
            if (error) {
                console.error(`[name.py ERROR] ${error.message}`);
                // Fallback nếu Python lỗi
                return resolve({
                    name: null,
                    avatar: `https://graph.facebook.com/${uid}/picture?type=large`
                });
            }

            try {
                const data = JSON.parse(stdout.trim());

                // Danh sách tên không hợp lệ (trang login, lỗi, ...)
                const INVALID_NAMES = [
                    'Facebook', 'Log in', 'Đăng nhập', 'Log Into Facebook',
                    'Name not found', 'Page Not Found', 'Content Not Found',
                    'Đăng nhập Facebook', 'Đăng nhập hoặc đăng ký',
                    'Facebook – log in or sign up', 'Error'
                ];

                const nameValid = data.name && !INVALID_NAMES.some(inv => inv.toLowerCase() === data.name.toLowerCase());

                // Chuẩn hóa kết quả trả về
                const result = {
                    name: nameValid ? data.name : null,
                    avatar: (data.avatar && data.avatar !== "Profile picture URL not found") ? data.avatar : null
                };

                // Nếu vẫn không có avatar, fallback sang Graph
                if (!result.avatar) {
                    result.avatar = `https://graph.facebook.com/${uid}/picture?type=large`;
                }

                resolve(result);
            } catch (e) {
                console.error("Error parsing python output:", e);
                resolve({
                    name: null,
                    avatar: `https://graph.facebook.com/${uid}/picture?type=large`
                });
            }
        });
    });
}

module.exports = {
    getUIDFromLink,
    getProfileInfo
};
