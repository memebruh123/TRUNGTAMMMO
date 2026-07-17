require('dotenv').config();

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const BOSS_ID = parseInt(process.env.BOSS_ID);
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const ROTATING_PROXY_KEY = 'tsOrebbSdwNHKajZriORjL'; // Key Anh Tiến vừa cấp

const ADMIN_IDS = new Set([BOSS_ID]);

const FILES = {
    users: 'data/data_users.json',
    tracking: 'data/data_tracking.json',
    history: 'data/data_history.json',
    admins: 'data/admin.txt',
    all_users: 'data/all_users.json',
    revenue: 'data/data_revenue.json',
    config: 'data/data_config.json',
    uid_memory: 'data/uid_memory.json',
    prompt: 'data/prompt.txt',
    prompt_admin: 'data/prompt_admin.txt',
    prompt_user_twoface: 'data/prompt_user_twoface.txt',
    prompt_ai_unrestricted: 'data/prompt_ai_unrestricted.txt',
    prompt_feedback_agent: 'data/prompt_feedback_agent.txt',
    thongbao_prompt: 'data/thongbao_prompt.txt',
    prompt_code_logic: 'data/prompt_code_logic.txt',
    ratings: 'data/ratings.json',
    codes: 'data/codes.json',
    child_bots: 'data/data_child_bots.json',
    proxies: 'data/proxies.txt'
};

const MAX_CHILD_BOTS = 20;

const UID_CHECK_ENDPOINTS = [
    'https://graph.facebook.com/v3.3/{uid}/picture?redirect=0',
    'https://graph2.facebook.com/v3.3/{uid}/picture?redirect=0'
];

const PROXY_XOAY_API = 'https://proxyxoay.shop/api/get.php';
const UID_CHECK_TIMEOUT = 8000; // Tăng timeout lên 8s để proxy xoay kịp phản hồi
const UID_CHECK_RETRY = 3; // Tăng retry lên 3 để chắc chắn hơn
const AUTO_CHECK_INTERVAL = 2000; // Check mỗi 2s
const MAX_CONCURRENT_CHECKS = 20; // Tăng concurrent (Tăng tốc!)
const DIE_CONFIRM_COUNT = 1; // Bú luôn phát đầu theo lệnh Anh Tiến
const FAQ_DELAY_MS = 30000;
const RETRY_DELAY_MS = 500; // Giảm delay retry
const FAQ_CODES = ['583', '811', '429', '277', '035', '395', '817']; // Danh sách mã FAQ thực sự
const NOTIFY_ON_RESTART = false; // Đã test xong, tắt để không spam khách

module.exports = {
    TELEGRAM_BOT_TOKEN,
    BOSS_ID,
    DEEPSEEK_API_KEY,
    ROTATING_PROXY_KEY,
    ADMIN_IDS,
    FILES,
    UID_CHECK_ENDPOINTS,
    PROXY_XOAY_API,
    UID_CHECK_TIMEOUT,
    UID_CHECK_RETRY,
    AUTO_CHECK_INTERVAL,
    MAX_CONCURRENT_CHECKS,
    NOTIFY_ON_RESTART,
    DIE_CONFIRM_COUNT,
    FAQ_DELAY_MS,
    RETRY_DELAY_MS,
    FAQ_CODES,
    MAX_CHILD_BOTS
};
