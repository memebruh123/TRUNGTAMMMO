const axios = require('axios');
const https = require('https');
const { HttpsProxyAgent } = require('https-proxy-agent');
const { FILES, UID_CHECK_TIMEOUT, UID_CHECK_RETRY, RETRY_DELAY_MS, ROTATING_PROXY_KEY, PROXY_XOAY_API } = require('../config/constants');
const { randomChoice, sleep } = require('../utils/helpers');
const { loadText, loadJSON, saveText } = require('./storage');

const USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
];

let cachedProxies = [];
let lastProxyLoad = 0;
let lastRotatingProxy = null;
let lastRotationTime = 0;
let lastProxyApiResponse = null;
let lastProxyIP = null;         // Track IP cũ để biết đổi thật chưa
let proxyCallCount = 0;         // Đếm lần gọi để phân biệt lần đầu

// [WORM-GPT v2] Đọc proxy key từ config (dynamic) — Admin có thể thay đổi qua bot
async function getActiveProxyKey() {
    try {
        const config = await loadJSON(FILES.config);
        if (config.proxy_xoay_key && config.proxy_xoay_key.length > 5) {
            return config.proxy_xoay_key;
        }
    } catch (e) { }
    return ROTATING_PROXY_KEY;
}

async function isProxyXoayEnabled() {
    try {
        const config = await loadJSON(FILES.config);
        if (config.proxy_xoay_enabled === false) return false;
        return true;
    } catch (e) { }
    return true;
}

async function getRotatingProxy() {
    const enabled = await isProxyXoayEnabled();
    if (!enabled) return null;

    const activeKey = await getActiveProxyKey();
    if (!activeKey) return null;

    const now = Date.now();

    // Lần đầu: cache 10s (bắt proxy nhanh)
    // Lần sau: cache 60s (proxy xoay 60s mới đổi được)
    const cacheTime = proxyCallCount === 0 ? 10000 : 60000;

    if (lastRotatingProxy && (now - lastRotationTime < cacheTime)) {
        return lastRotatingProxy;
    }

    try {
        const url = `${PROXY_XOAY_API}?key=${activeKey}&nhamang=random&tinhthanh=0`;
        const res = await axios.get(url, { timeout: 5000 });

        if (res.data && res.data.status === 100) {
            const raw = res.data.proxyhttp;
            const p = raw.split(':');
            if (p.length === 4) {
                const formatted = `http://${p[2]}:${p[3]}@${p[0]}:${p[1]}`;
                const newIP = p[0];
                lastRotatingProxy = formatted;
                lastRotationTime = now;
                lastProxyApiResponse = res.data;
                proxyCallCount++;

                // Chỉ log khi IP thực sự thay đổi
                if (newIP !== lastProxyIP) {
                    console.log(`[Proxy] ✅ IP mới: ${newIP} (lần ${proxyCallCount})`);
                    lastProxyIP = newIP;
                }
                return formatted;
            }
        } else if (res.data && (res.data.status === 102 || res.data.status === 101)) {
            lastProxyApiResponse = res.data;
            // Chỉ log lỗi, không log success lặp
            console.log(`[Proxy] ⚠️ API: ${res.data.message || 'Lỗi ' + res.data.status}`);
        }
    } catch (e) {
        console.log(`[Proxy] ❌ API fail: ${e.message}`);
    }
    return lastRotatingProxy;
}

// [WORM-GPT v2] Hàm trả về trạng thái proxy cho Admin Panel
async function getProxyStatus() {
    const activeKey = await getActiveProxyKey();
    const enabled = await isProxyXoayEnabled();
    const staticProxies = await getStaticProxyList();

    // Extract IP from cached proxy
    let currentIP = null;
    if (lastRotatingProxy) {
        try {
            const match = lastRotatingProxy.match(/@([^:]+)/);
            if (match) currentIP = match[1];
        } catch (e) { }
    }

    // Get expiration from last API response
    let expiration = null;
    if (lastProxyApiResponse && lastProxyApiResponse['Token expiration date']) {
        expiration = lastProxyApiResponse['Token expiration date'];
    }

    return {
        xoay: {
            enabled: enabled,
            key: activeKey ? (activeKey.substring(0, 6) + '...' + activeKey.slice(-4)) : '(Chưa set)',
            keyFull: activeKey || '',
            currentIP: currentIP || '(Chưa xoay)',
            lastRotation: lastRotationTime ? new Date(lastRotationTime).toLocaleString('vi-VN') : 'N/A',
            expiration: expiration || '(Không rõ)',
            cachedProxy: lastRotatingProxy ? true : false
        },
        static: {
            count: staticProxies.length,
            list: staticProxies.slice(0, 10) // Hiển thị tối đa 10
        },
        total: staticProxies.length + (lastRotatingProxy ? 1 : 0)
    };
}

// [WORM-GPT v2] Quản lý proxy tĩnh
async function getStaticProxyList() {
    try {
        const text = await loadText(FILES.proxies);
        return text.split('\n')
            .map(line => line.trim())
            .filter(line => line && !line.startsWith('#'));
    } catch (e) {
        return [];
    }
}

async function addStaticProxy(proxyLine) {
    try {
        const text = await loadText(FILES.proxies);
        const lines = text.split('\n');
        // Kiểm tra trùng
        const trimmed = proxyLine.trim();
        if (lines.some(l => l.trim() === trimmed)) {
            return { success: false, error: 'Proxy này đã tồn tại' };
        }
        lines.push(trimmed);
        await saveText(FILES.proxies, lines.join('\n'));
        // Reset cache
        cachedProxies = [];
        lastProxyLoad = 0;
        return { success: true };
    } catch (e) {
        return { success: false, error: e.message };
    }
}

async function removeStaticProxy(proxyLine) {
    try {
        const text = await loadText(FILES.proxies);
        const lines = text.split('\n');
        const trimmed = proxyLine.trim();
        const filtered = lines.filter(l => l.trim() !== trimmed);
        await saveText(FILES.proxies, filtered.join('\n'));
        // Reset cache
        cachedProxies = [];
        lastProxyLoad = 0;
        return { success: true };
    } catch (e) {
        return { success: false, error: e.message };
    }
}

async function clearProxyCache() {
    cachedProxies = [];
    lastProxyLoad = 0;
    lastRotatingProxy = null;
    lastRotationTime = 0;
    lastProxyApiResponse = null;
}

async function getProxies() {
    const now = Date.now();

    // Ưu tiên Proxy Xoay
    const rotating = await getRotatingProxy();

    if (cachedProxies.length > 0 && (now - lastProxyLoad < 60000)) {
        return rotating ? [rotating, ...cachedProxies] : cachedProxies;
    }

    try {
        const text = await loadText(FILES.proxies);
        const list = text.split('\n')
            .map(line => line.trim())
            .filter(line => line && !line.startsWith('#'));

        cachedProxies = list;
        lastProxyLoad = now;
        const total = list.length + (rotating ? 1 : 0);
        // Chỉ log mỗi 5 phút, không spam
        if (total > 0 && (!global._lastProxyLog || now - global._lastProxyLog > 300000)) {
            global._lastProxyLog = now;
            console.log(`[Proxy] Đang dùng ${total} proxy (Xoay: ${rotating ? 'Bật' : 'Tắt'}).`);
        }
        return rotating ? [rotating, ...list] : list;
    } catch (e) {
        return rotating ? [rotating] : [];
    }
}

async function checkUIDLiveDie(uid) {
    const proxies = await getProxies();

    for (let retry = 0; retry < UID_CHECK_RETRY; retry++) {
        const urls = [
            `https://graph.facebook.com/v3.3/${uid}/picture?redirect=0`,
            `https://graph2.facebook.com/v3.3/${uid}/picture?redirect=0`
        ];

        // Shuffle URLs
        for (let i = urls.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [urls[i], urls[j]] = [urls[j], urls[i]];
        }

        const userAgent = randomChoice(USER_AGENTS);
        const headers = {
            'User-Agent': userAgent,
            'Accept': 'application/json',
            'Accept-Language': 'en-US,en;q=0.9'
        };

        for (const url of urls) {
            try {
                let axiosConfig = {
                    headers,
                    timeout: UID_CHECK_TIMEOUT,
                    validateStatus: status => status < 500,
                    maxRedirects: 0
                };

                if (proxies.length > 0) {
                    const proxyUrl = randomChoice(proxies);
                    try {
                        axiosConfig.httpsAgent = new HttpsProxyAgent(proxyUrl);
                    } catch (e) { }
                }

                const response = await axios.get(url, axiosConfig);
                const data = response.data;
                const dataStr = typeof data === 'string' ? data : JSON.stringify(data);

                // --- [WORM-GPT FIX v2] LOGIC CHECK MỚI ---
                // Facebook API trả về 200 OK cho cả LIVE và DIE
                // LIVE: {"data":{"height":50,"is_silhouette":...,"url":"...","width":50}}
                // DIE:  {"data":{"is_silhouette":true,"url":"https://static.xx.fbcdn.net/rsrc.php/..."}}
                //       → Không có height, không có width, không có error
                // ERROR: {"error":{"message":"...","type":"...","code":...}}

                // Case 1: Có height + width → LIVE chắc chắn
                if (dataStr.includes('"height"') || (data.data && data.data.height)) {
                    return { status: 'LIVE', info: 'Active' };
                }

                // Case 2: Có error rõ ràng từ Facebook → DIE
                if (dataStr.includes('"error"') || data.error) {
                    return { status: 'DIE', info: 'Inactive (Error)' };
                }

                // Case 3: HTTP 4xx → DIE (Profile bị xóa/banned)
                if (response.status >= 400) {
                    return { status: 'DIE', info: `Inactive (HTTP ${response.status})` };
                }

                // Case 4: Có data nhưng KHÔNG có height → DIE
                // Facebook trả 200 OK + data có is_silhouette và url default (rsrc.php hoặc UlIqmHJn)
                // Đây là trường hợp profile đã die/bị vô hiệu hoá
                if (data.data && !data.data.height) {
                    // Kiểm tra thêm URL có phải ảnh default không
                    const avatarUrl = data.data.url || '';
                    const isDefaultAvatar = avatarUrl.includes('rsrc.php') ||
                        avatarUrl.includes('UlIqmHJn') ||
                        avatarUrl.includes('static.xx.fbcdn.net');

                    if (isDefaultAvatar || data.data.is_silhouette === true) {
                        return { status: 'DIE', info: 'Inactive (No avatar)' };
                    }

                    // Nếu URL ảnh khác default nhưng vẫn không có height
                    // → Vẫn coi là DIE vì profile LIVE luôn trả height
                    return { status: 'DIE', info: 'Inactive (No dimensions)' };
                }

                // Case 5: Response hợp lệ nhưng không match logic nào
                // → Có thể do Proxy trả rác hoặc Cloudflare chặn
                console.log(`[checkUID] Kết quả nghi vấn cho ${uid} (status=${response.status}), đang thử Proxy khác...`);
                continue;

            } catch (error) {
                // Nếu bị Rate Limited (429) hoặc lỗi kết nối Proxy → TUYỆT ĐỐI không báo DIE
                // Ép buộc vòng lặp sau chọn Proxy khác (randomChoice trong getProxies)
                if (error.response?.status === 429) {
                    console.log(`[checkUID] Proxy bị Block (429) khi check ${uid}. Đang xoay IP...`);
                    // Xóa cache proxy xoay để vòng sau lấy IP mới nhất nếu có thể
                    lastRotationTime = 0;
                } else {
                    // Chỉ log lỗi nếu không phải do Timeout spam
                    if (!error.message.includes('timeout')) {
                        console.log(`[checkUID] Lỗi Proxy/Mạng check ${uid}: ${error.message} (Đang thử lại...)`);
                    }
                }
            }
        }


        if (retry < UID_CHECK_RETRY - 1) {
            await sleep(RETRY_DELAY_MS);
        }
    }

    // Nếu đã thử hết số lần (retry) mà vẫn không xong → báo UNKNOWN để vòng sau check tiếp
    // Không được báo DIE bừa bãi khi chưa chắc chắn do lỗi mạng/proxy
    return { status: 'UNKNOWN', info: 'Check failed or Proxy blocked' };
}

module.exports = {
    checkUIDLiveDie,
    getProxyStatus,
    addStaticProxy,
    removeStaticProxy,
    clearProxyCache
};
