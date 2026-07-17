import os
import sys
import subprocess

def install_package(package_name, import_name=None):
    if import_name is None:
        import_name = package_name
    try:
        __import__(import_name)
    except ImportError:
        print(f"Đang cài đặt {package_name}...")
        try:
            subprocess.check_call([sys.executable, "-m", "pip", "install", package_name, "--quiet"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            print(f"✅ Đã cài đặt {package_name}")
        except:
            print(f"❌ Lỗi cài đặt {package_name}")

install_package("requests")
install_package("pyTelegramBotAPI", "telebot")
install_package("urllib3")

import requests
import json
import time
import threading
import re
import urllib3
import signal
import atexit
import random
from datetime import datetime, timedelta
from concurrent.futures import ThreadPoolExecutor, as_completed
from decimal import Decimal, ROUND_HALF_UP
import telebot
from telebot import types

TOKEN = ""
BOSS_ID = ""
DEEPSEEK_API_KEY = ""

ADMIN_IDS = {BOSS_ID}

bot = telebot.TeleBot(TOKEN)

FILES = {
    "users": "data_users.json",
    "tracking": "data_tracking.json",
    "history": "data_history.json",
    "admins": "admin.txt",
    "all_users": "all_users.json",
    "revenue": "data_revenue.json",
    "config": "data_config.json",
    "uid_memory": "uid_memory.json",
    "prompt": "prompt.txt",
    "prompt_admin": "prompt_admin.txt",
    "prompt_user_twoface": "prompt_user_twoface.txt",
    "prompt_ai_unrestricted": "prompt_ai_unrestricted.txt",
    "prompt_feedback_agent": "prompt_feedback_agent.txt",
    "thongbao_prompt": "thongbao_prompt.txt",
    "prompt_code_logic": "prompt_code_logic.txt",
    "cookie": "cookie.txt",
    "ratings": "ratings.json",
    "codes": "codes.json"
}

active_chats = {} 
support_queue = {}
FB_COOKIE = "" 
temp_user_state = {}

file_locks = {
    "users": threading.Lock(),
    "tracking": threading.Lock(),
    "history": threading.Lock(),
    "all_users": threading.Lock(),
    "revenue": threading.Lock(),
    "config": threading.Lock(),
    "ratings": threading.Lock(),
    "codes": threading.Lock()
} 

class FacebookProfileExtractor:
    def __init__(self):
        self.base_url = "https://www.facebook.com/profile.php"
        self.headers = {
            'User-Agent': "Mozilla/5.0 (Linux; Android 12; Pixel 6 Build/SQ3A.220705.004; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/136.0.0.0 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/407.0.0.0.65;]",
            'Accept': "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
            'dpr': "1.1",
            'viewport-width': "281",
            'sec-ch-ua': "\"Chromium\";v=\"136\", \"Google Chrome\";v=\"136\", \"Not.A/Brand\";v=\"99\"",
            'sec-ch-ua-mobile': "?1",
            'sec-ch-ua-platform': "\"Android\"",
            'sec-ch-ua-platform-version': "\"12\"",
            'sec-ch-ua-model': "\"Pixel 6\"",
            'sec-ch-ua-full-version-list': "\"Chromium\";v=\"136.0.7103.114\", \"Google Chrome\";v=\"136.0.7103.114\", \"Not.A/Brand\";v=\"99.0.0.0\"",
            'sec-ch-prefers-color-scheme': "dark",
            'upgrade-insecure-requests': "1",
            'sec-fetch-site': "none",
            'sec-fetch-mode': "navigate",
            'sec-fetch-user': "?1",
            'sec-fetch-dest': "document",
            'accept-language': "vi-VN,vi;q=0.9",
            'priority': "u=0, i"
        }
        urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

    def extract_profile_info(self, html_content):
        title_match = re.search(r'<title>(.*?)</title>', html_content)
        name = title_match.group(1) if title_match else "Name not found"
        profile_pic_match = re.search(r'<meta property="og:image" content="([^"]+)"', html_content)
        profile_pic_url = profile_pic_match.group(1) if profile_pic_match else "Profile picture URL not found"
        profile_pic_url = profile_pic_url.replace("&amp;", "&")
        
        return {"name": name, "profile_picture_url": profile_pic_url}
    
    def get_profile(self, user_id):
        params = {"id": user_id}
        try:
            response = requests.get(self.base_url, params=params, headers=self.headers, verify=False, timeout=10)
            return self.extract_profile_info(response.text)
        except Exception as e:
            return {"error": str(e)}

fb_extractor = FacebookProfileExtractor()

def load_admins():
    global ADMIN_IDS
    try:
        if os.path.exists(FILES["admins"]):
            with open(FILES["admins"], "r") as f:
                for line in f:
                    uid = line.strip()
                    if uid.isdigit(): ADMIN_IDS.add(int(uid))
    except: pass

def add_new_admin(uid):
    global ADMIN_IDS
    if uid not in ADMIN_IDS:
        ADMIN_IDS.add(uid)
        with open(FILES["admins"], "a") as f: f.write(f"\n{uid}")
        return True
    return False

def load_cookie():
    global FB_COOKIE
    try:
        if os.path.exists(FILES["cookie"]):
            with open(FILES["cookie"], "r", encoding="utf-8") as f:
                FB_COOKIE = f.read().strip()
    except: pass

load_admins()
load_cookie()

def load_json(filename):
    lock_key = None
    for key, file_path in FILES.items():
        if file_path == filename and key in file_locks:
            lock_key = key
            break
    
    if lock_key:
        with file_locks[lock_key]:
            try:
                if os.path.exists(filename):
                    with open(filename, "r", encoding="utf-8") as f: return json.load(f)
                if filename in [FILES["all_users"], FILES["revenue"], FILES["ratings"], FILES["codes"]]: return []
                return {}
            except:
                if filename in [FILES["all_users"], FILES["revenue"], FILES["ratings"], FILES["codes"]]: return []
                return {}
    else:
        try:
            if os.path.exists(filename):
                with open(filename, "r", encoding="utf-8") as f: return json.load(f)
            if filename in [FILES["all_users"], FILES["revenue"], FILES["ratings"], FILES["codes"]]: return []
            return {}
        except:
            if filename in [FILES["all_users"], FILES["revenue"], FILES["ratings"], FILES["codes"]]: return []
            return {}

def save_json(filename, data):
    lock_key = None
    for key, file_path in FILES.items():
        if file_path == filename and key in file_locks:
            lock_key = key
            break
    
    if lock_key:
        with file_locks[lock_key]:
            try:
                with open(filename, "w", encoding="utf-8") as f: json.dump(data, f, ensure_ascii=False, indent=4)
            except: pass
    else:
        try:
            with open(filename, "w", encoding="utf-8") as f: json.dump(data, f, ensure_ascii=False, indent=4)
        except: pass

def get_config():
    data = load_json(FILES["config"])
    if not data:
        data = {
            "vip_price_30d": 30000,
            "bank_info": "Vietinbank: 0398085063 (PHAM XUAN TIEN)"
        }
        save_json(FILES["config"], data)
    return data

def update_config(key, value):
    data = get_config()
    data[key] = value
    save_json(FILES["config"], data)

def init_files():
    for f in FILES.values():
        if f == FILES["cookie"]: continue
        if not os.path.exists(f):
            if f in [FILES["all_users"], FILES["revenue"], FILES["ratings"], FILES["codes"]]: save_json(f, [])
            elif f == FILES["history"]: save_json(f, {})
            elif f.endswith(".txt"):
                with open(f, "w", encoding="utf-8") as file: file.write("") 
            else: save_json(f, {})
    get_config() 

def sync_old_users():
    users_data = load_json(FILES["users"])
    all_users = load_json(FILES["all_users"])
    count = 0
    for uid in users_data:
        try:
            uid_int = int(uid)
            if uid_int not in all_users:
                all_users.append(uid_int)
                count += 1
        except: pass
    if count > 0: save_json(FILES["all_users"], all_users)

init_files()
sync_old_users()

def save_user_global(user_id):
    data = load_json(FILES["all_users"])
    if user_id not in data:
        data.append(user_id)
        save_json(FILES["all_users"], data)

def get_all_users_list():
    return load_json(FILES["all_users"])

def log_revenue(amount):
    if amount <= 0: return
    data = load_json(FILES["revenue"])
    data.append({"time": int(time.time()), "amount": amount})
    save_json(FILES["revenue"], data)

def get_admin_revenue_stats():
    data = load_json(FILES["revenue"])
    now = datetime.now()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0).timestamp()
    yesterday_start = today_start - 86400
    stats = {"today": 0, "yesterday": 0, "total": 0}
    for rec in data:
        t = rec["time"]; amt = rec["amount"]; stats["total"] += amt
        if t >= today_start: stats["today"] += amt
        if yesterday_start <= t < today_start: stats["yesterday"] += amt
    return stats

def log_user_history(user_id, action_type, amount, detail):
    data = load_json(FILES["history"])
    str_id = str(user_id)
    if str_id not in data: data[str_id] = []
    data[str_id].append({"time": int(time.time()), "type": action_type, "amount": amount, "detail": detail})
    save_json(FILES["history"], data)

def get_user_history(user_id):
    data = load_json(FILES["history"])
    return data.get(str(user_id), [])

def get_user_data(user_id):
    data = load_json(FILES["users"])
    str_id = str(user_id)
    if str_id not in data:
        data[str_id] = {"balance": 0, "vip_expiry": 0, "vip_active": False, "level": 1, "stats": {"done": 0, "cancel": 0, "tracking": 0, "money_generated": 0}, "active_discount_code": None, "active_bonus_days_code": None, "active_discount_code_time": None, "active_bonus_days_code_time": None, "referral_code": None, "referral_stats": {"total_referrals": 0, "total_earned": 0}, "referral_vip_discount": 0}
        save_json(FILES["users"], data)
    if "stats" not in data[str_id]:
        data[str_id]["stats"] = {"done": 0, "cancel": 0, "tracking": 0, "money_generated": 0}
        save_json(FILES["users"], data)
    if "active_discount_code" not in data[str_id]:
        data[str_id]["active_discount_code"] = None
        data[str_id]["active_discount_code_time"] = None
        save_json(FILES["users"], data)
    if "active_bonus_days_code" not in data[str_id]:
        data[str_id]["active_bonus_days_code"] = None
        data[str_id]["active_bonus_days_code_time"] = None
        save_json(FILES["users"], data)
    if "referral_code" not in data[str_id]:
        data[str_id]["referral_code"] = None
        data[str_id]["referral_stats"] = {"total_referrals": 0, "total_earned": 0}
        data[str_id]["referral_vip_discount"] = 0
        save_json(FILES["users"], data)
    return data[str_id]

def update_user_stats(user_id, type_update, value=0):
    data = load_json(FILES["users"])
    str_id = str(user_id)
    if str_id not in data: return
    stats = data[str_id].get("stats", {"done": 0, "cancel": 0, "tracking": 0, "money_generated": 0})
    if type_update == "done":
        stats["done"] += 1; stats["money_generated"] += value
        if stats["tracking"] > 0: stats["tracking"] -= 1
    elif type_update == "cancel":
        stats["cancel"] += 1
        if stats["tracking"] > 0: stats["tracking"] -= 1
    elif type_update == "add": stats["tracking"] += 1
    data[str_id]["stats"] = stats
    save_json(FILES["users"], data)

def update_balance(user_id, amount):
    data = load_json(FILES["users"])
    str_id = str(user_id)
    if str_id not in data: get_user_data(user_id)
    current = int(data[str_id]["balance"])
    data[str_id]["balance"] = current + amount
    if data[str_id]["balance"] < 0: data[str_id]["balance"] = 0
    save_json(FILES["users"], data)
    if amount > 0: log_revenue(amount)
    return data[str_id]["balance"]

def set_vip(user_id, days):
    data = load_json(FILES["users"])
    str_id = str(user_id)
    now = int(time.time())
    if str_id not in data: get_user_data(user_id)
    current_expiry = data[str_id].get("vip_expiry", 0)
    
    if days == 0: 
        new_expiry = 0
        data[str_id]["vip_active"] = False
        data[str_id]["level"] = 1
    else: 
        if current_expiry > now:
            new_expiry = current_expiry + (days * 86400)
        else:
            new_expiry = now + (days * 86400)
        data[str_id]["vip_active"] = True
        data[str_id]["level"] = 2
        
    data[str_id]["vip_expiry"] = new_expiry
    save_json(FILES["users"], data)
    return new_expiry

def check_vip(user_id):
    if user_id in ADMIN_IDS: return True, "Vĩnh viễn (Admin)"
    data = get_user_data(user_id)
    if not data["vip_active"]: return False, "Chưa kích hoạt"
    if data["vip_expiry"] > int(time.time()):
        dt = datetime.fromtimestamp(data["vip_expiry"])
        return True, dt.strftime('%d/%m/%Y %H:%M:%S')
    else:
        if data["vip_active"]:
            full = load_json(FILES["users"])
            full[str(user_id)]["vip_active"] = False
            full[str(user_id)]["level"] = 1
            save_json(FILES["users"], full)
        return False, "Đã hết hạn"

def read_prompt_file(prompt_file):
    try:
        with open(prompt_file, "r", encoding="utf-8") as f: return f.read().strip()
    except: return "Bạn là trợ lý ảo."

def format_vnd(amount):
    try: 
        amount_decimal = Decimal(str(amount))
        amount_int = int(amount_decimal.quantize(Decimal('1'), rounding=ROUND_HALF_UP))
        return f"{amount_int:,}".replace(",", ".") + " VNĐ"
    except: return "0 VNĐ"

def calculate_bonus_with_ai(base_amount, user_id):
    try:
        user_data = get_user_data(user_id)
        active_discount_code = user_data.get("active_discount_code", None)
        referral_vip_discount = user_data.get("referral_vip_discount", 0)
        referral_config = get_referral_config()
        deposit_bonus_percent = referral_config.get("deposit_bonus_percent_new_user", 0)
        today_date = datetime.now().strftime('%Y-%m-%d')
        
        total_bonus_percent = 0
        bonus_sources = []
        
        if active_discount_code:
            code = get_code(active_discount_code)
            if code and code.get("code_type") == "DISCOUNT":
                expiry_date = code.get("expiry_date", "")
                min_amount = code.get("min_amount", 0)
                if (not expiry_date or expiry_date >= today_date) and (min_amount == 0 or base_amount >= min_amount):
                    total_bonus_percent += code.get("value", 0)
                    bonus_sources.append(f"Mã {active_discount_code} ({code.get('value', 0)}%)")
        
        if deposit_bonus_percent > 0 and user_data.get("used_referral"):
            total_bonus_percent += deposit_bonus_percent
            bonus_sources.append(f"Referral bonus ({deposit_bonus_percent}%)")
        
        if total_bonus_percent == 0:
            return {
                "has_bonus": False,
                "base_amount": base_amount,
                "bonus_percent": 0,
                "bonus_amount": 0,
                "total_amount": base_amount,
                "code_name": None,
                "code_valid": False,
                "validation_message": None
            }
        
        code = get_code(active_discount_code)
        if not code or code.get("code_type") != "DISCOUNT":
            user_data["active_discount_code"] = None
            data = load_json(FILES["users"])
            data[str(user_id)] = user_data
            save_json(FILES["users"], data)
            return {
                "has_bonus": False,
                "base_amount": base_amount,
                "bonus_percent": 0,
                "bonus_amount": 0,
                "total_amount": base_amount,
                "code_name": None,
                "code_valid": False,
                "validation_message": "Mã không tồn tại hoặc không hợp lệ"
            }
        
        expiry_date = code.get("expiry_date", "")
        min_amount = code.get("min_amount", 0)
        code_valid = True
        validation_message = "Đạt"
        
        if expiry_date and expiry_date < today_date:
            code_valid = False
            validation_message = f"Không đạt - Mã đã hết hạn ({expiry_date})"
            user_data["active_discount_code"] = None
            data = load_json(FILES["users"])
            data[str(user_id)] = user_data
            save_json(FILES["users"], data)
        elif min_amount > 0 and base_amount < min_amount:
            code_valid = False
            validation_message = f"Không đạt - Số tiền {format_vnd(base_amount)} < Tối thiểu {format_vnd(min_amount)}"
        
        if not code_valid:
            return {
                "has_bonus": False,
                "base_amount": base_amount,
                "bonus_percent": 0,
                "bonus_amount": 0,
                "total_amount": base_amount,
                "code_name": active_discount_code,
                "code_valid": False,
                "validation_message": validation_message
            }
        
        bonus_percent = code.get("value", 0)
        base_decimal = Decimal(str(base_amount))
        bonus_decimal = base_decimal * Decimal(str(bonus_percent)) / Decimal("100")
        bonus_amount = int(bonus_decimal.quantize(Decimal('1'), rounding=ROUND_HALF_UP))
        total_amount = int((base_decimal + bonus_decimal).quantize(Decimal('1'), rounding=ROUND_HALF_UP))
        
        return {
            "has_bonus": True,
            "base_amount": base_amount,
            "bonus_percent": bonus_percent,
            "bonus_amount": bonus_amount,
            "total_amount": total_amount,
            "code_name": active_discount_code,
            "code_valid": True,
            "validation_message": validation_message,
            "min_amount": min_amount,
            "expiry_date": expiry_date
        }
    except:
        return {
            "has_bonus": False,
            "base_amount": base_amount,
            "bonus_percent": 0,
            "bonus_amount": 0,
            "total_amount": base_amount,
            "code_name": None,
            "code_valid": False,
            "validation_message": "Lỗi kiểm tra mã"
        }

def get_user_active_codes(user_id):
    user_data = get_user_data(user_id)
    active_discount = user_data.get("active_discount_code", None)
    active_bonus_days = user_data.get("active_bonus_days_code", None)
    
    discount_code = None
    bonus_days_code = None
    
    if active_discount:
        discount_code = get_code(active_discount)
    
    if active_bonus_days:
        bonus_days_code = get_code(active_bonus_days)
    
    return {
        "discount": discount_code,
        "bonus_days": bonus_days_code
    }

def create_code(code_name, code_type, value, max_uses=100, expiry_days=30, expiry_date=None, min_amount=0):
    codes = load_json(FILES["codes"])
    
    if expiry_date:
        try:
            expiry_datetime = datetime.strptime(expiry_date, '%Y-%m-%d')
            expiry_timestamp = int(expiry_datetime.timestamp())
            expiry_date_str = expiry_date
        except:
            expiry_timestamp = int(time.time()) + (expiry_days * 86400)
            expiry_date_str = datetime.fromtimestamp(expiry_timestamp).strftime('%Y-%m-%d')
    else:
        expiry_timestamp = int(time.time()) + (expiry_days * 86400)
        expiry_date_str = datetime.fromtimestamp(expiry_timestamp).strftime('%Y-%m-%d')
    
    code_entry = {
        "code_name": code_name.upper(),
        "code_type": code_type,
        "value": value,
        "max_uses": max_uses,
        "used_count": 0,
        "used_by": [],
        "expiry": expiry_timestamp,
        "expiry_date": expiry_date_str,
        "min_amount": int(min_amount),
        "created_at": int(time.time()),
        "created_date": datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    }
    codes.append(code_entry)
    save_json(FILES["codes"], codes)
    return code_entry

def get_code(code_name):
    codes = load_json(FILES["codes"])
    code_name_upper = code_name.upper()
    for code in codes:
        if code.get("code_name") == code_name_upper:
            return code
    return None

def use_code(user_id, code_name, check_amount=0):
    codes = load_json(FILES["codes"])
    code_name_upper = code_name.upper()
    now = int(time.time())
    today_date = datetime.now().strftime('%Y-%m-%d')
    
    for code in codes:
        if code.get("code_name") == code_name_upper:
            expiry_date = code.get("expiry_date", "")
            if expiry_date and expiry_date < today_date:
                return {"success": False, "message": f"❌ Mã đã hết hạn. Hạn sử dụng: {expiry_date}"}
            
            if code.get("expiry", 0) < now:
                return {"success": False, "message": "❌ Mã đã hết hạn."}
            
            min_amount = code.get("min_amount", 0)
            if min_amount > 0 and check_amount > 0 and check_amount < min_amount:
                return {"success": False, "message": f"❌ Mã yêu cầu số tiền tối thiểu {format_vnd(min_amount)}. Số tiền của bạn: {format_vnd(check_amount)}"}
            
            if str(user_id) in code.get("used_by", []):
                return {"success": False, "message": "❌ Bạn đã sử dụng mã này rồi."}
            
            if code.get("used_count", 0) >= code.get("max_uses", 0):
                return {"success": False, "message": "❌ Mã đã hết lượt sử dụng."}
            
            code_type = code.get("code_type")
            value = code.get("value", 0)
            
            if code_type == "FREE_VIP":
                code["used_count"] = code.get("used_count", 0) + 1
                if "used_by" not in code:
                    code["used_by"] = []
                code["used_by"].append(str(user_id))
                save_json(FILES["codes"], codes)
                set_vip(user_id, value)
                return {"success": True, "message": f"✅ Đã nhận {value} ngày VIP miễn phí!", "type": "VIP", "value": value, "code_info": code}
            elif code_type == "DISCOUNT":
                user_data = get_user_data(user_id)
                old_code = user_data.get("active_discount_code", None)
                user_data["active_discount_code"] = code_name_upper
                user_data["active_discount_code_time"] = int(time.time())
                data = load_json(FILES["users"])
                data[str(user_id)] = user_data
                save_json(FILES["users"], data)
                old_msg = f"\n\n⚠️ Mã cũ `{old_code}` đã bị thay thế." if old_code and old_code != code_name_upper else ""
                return {"success": True, "message": f"✅ Mã giảm giá {value}% đã được kích hoạt! Mã sẽ tự động áp dụng khi bạn nạp tiền hoặc mua VIP.{old_msg}", "type": "DISCOUNT", "value": value, "code_info": code}
            elif code_type == "BONUS_DAYS":
                user_data = get_user_data(user_id)
                old_code = user_data.get("active_bonus_days_code", None)
                user_data["active_bonus_days_code"] = code_name_upper
                user_data["active_bonus_days_code_time"] = int(time.time())
                data = load_json(FILES["users"])
                data[str(user_id)] = user_data
                save_json(FILES["users"], data)
                old_msg = f"\n\n⚠️ Mã cũ `{old_code}` đã bị thay thế." if old_code and old_code != code_name_upper else ""
                return {"success": True, "message": f"✅ Mã tặng thêm {value} ngày VIP đã được kích hoạt! Mã sẽ tự động áp dụng khi bạn mua VIP.{old_msg}", "type": "BONUS_DAYS", "value": value, "code_info": code}
            elif code_type == "ADD_MONEY":
                code["used_count"] = code.get("used_count", 0) + 1
                if "used_by" not in code:
                    code["used_by"] = []
                code["used_by"].append(str(user_id))
                save_json(FILES["codes"], codes)
                update_balance(user_id, value)
                log_user_history(user_id, "code_reward", value, f"Mã {code_name_upper}")
                return {"success": True, "message": f"✅ Đã nhận {format_vnd(value)} từ mã khuyến mãi!", "type": "MONEY", "value": value, "code_info": code}
            
            return {"success": False, "message": "❌ Loại mã không hợp lệ."}
    
    return {"success": False, "message": "❌ Mã không tồn tại."}

def get_referral_config():
    data = load_json(FILES["config"])
    return data.get("referral_config", {
        "vip_days_referrer": 0,
        "vip_days_new_user": 0,
        "deposit_bonus_percent_referrer": 0,
        "deposit_bonus_percent_new_user": 0,
        "vip_discount_percent": 0
    })

def update_referral_config(config):
    data = load_json(FILES["config"])
    data["referral_config"] = config
    save_json(FILES["config"], data)

def create_user_referral_code(user_id, user_name=""):
    user_data = get_user_data(user_id)
    if not user_data.get("referral_code"):
        referral_code = f"REF{user_id}" if not user_name else f"REF{user_name.upper().replace(' ', '')[:10]}{user_id}"
        user_data["referral_code"] = referral_code
        user_data["referral_stats"] = {"total_referrals": 0, "total_earned": 0}
        data = load_json(FILES["users"])
        data[str(user_id)] = user_data
        save_json(FILES["users"], data)
    return user_data.get("referral_code", str(user_id))

def mass_create_referral_codes(vip_days_referrer=0, vip_days_new_user=0, deposit_bonus_referrer=0, deposit_bonus_new_user=0, vip_discount=0):
    all_users = get_all_users_list()
    config = {
        "vip_days_referrer": vip_days_referrer,
        "vip_days_new_user": vip_days_new_user,
        "deposit_bonus_percent_referrer": deposit_bonus_referrer,
        "deposit_bonus_percent_new_user": deposit_bonus_new_user,
        "vip_discount_percent": vip_discount
    }
    update_referral_config(config)
    
    created_count = 0
    users_data = load_json(FILES["users"])
    
    for user_id in all_users:
        try:
            user_data = users_data.get(str(user_id), {})
            if not user_data.get("referral_code"):
                try:
                    chat_member = bot.get_chat_member(user_id, user_id)
                    user_name = chat_member.user.first_name or ""
                except:
                    user_name = ""
                referral_code = create_user_referral_code(user_id, user_name)
                created_count += 1
        except: pass
    
    save_json(FILES["users"], users_data)
    return created_count, config

def use_referral_code(new_user_id, referral_code_or_uid):
    if str(new_user_id) == str(referral_code_or_uid):
        return {"success": False, "message": "❌ Bạn không thể sử dụng mã giới thiệu của chính mình."}
    
    try:
        referral_uid_int = None
        users_data = load_json(FILES["users"])
        
        if referral_code_or_uid.isdigit():
            referral_uid_int = int(referral_code_or_uid)
        else:
            for uid, user_data in users_data.items():
                if user_data.get("referral_code") == referral_code_or_uid.upper():
                    referral_uid_int = int(uid)
                    break
        
        if not referral_uid_int or referral_uid_int not in get_all_users_list():
            return {"success": False, "message": "❌ Mã giới thiệu không hợp lệ."}
        
        user_data = get_user_data(new_user_id)
        if user_data.get("used_referral"):
            return {"success": False, "message": "❌ Bạn đã sử dụng mã giới thiệu rồi."}
        
        referral_config = get_referral_config()
        
        referrer_data = get_user_data(referral_uid_int)
        referral_code = referrer_data.get("referral_code", str(referral_uid_int))
        
        benefits_msg = []
        total_referrer_benefit = 0
        total_new_user_benefit = 0
        
        if referral_config.get("vip_days_referrer", 0) > 0:
            days = referral_config["vip_days_referrer"]
            set_vip(referral_uid_int, days)
            benefits_msg.append(f"👑 +{days} ngày VIP")
        
        if referral_config.get("vip_days_new_user", 0) > 0:
            days = referral_config["vip_days_new_user"]
            set_vip(new_user_id, days)
            benefits_msg.append(f"👑 +{days} ngày VIP (bạn)")
        
        if referral_config.get("deposit_bonus_percent_referrer", 0) > 0:
            percent = referral_config["deposit_bonus_percent_referrer"]
            benefits_msg.append(f"💰 +{percent}% tiền nạp (người mời)")
        
        if referral_config.get("deposit_bonus_percent_new_user", 0) > 0:
            percent = referral_config["deposit_bonus_percent_new_user"]
            benefits_msg.append(f"💰 +{percent}% tiền nạp (bạn)")
        
        if referral_config.get("vip_discount_percent", 0) > 0:
            percent = referral_config["vip_discount_percent"]
            user_data["referral_vip_discount"] = percent
            benefits_msg.append(f"🎫 Giảm {percent}% khi mua VIP (bạn)")
        
        user_data["used_referral"] = True
        user_data["referral_by"] = referral_uid_int
        user_data["referral_code_used"] = referral_code
        
        if "referral_stats" not in referrer_data:
            referrer_data["referral_stats"] = {"total_referrals": 0, "total_earned": 0}
        referrer_data["referral_stats"]["total_referrals"] = referrer_data["referral_stats"].get("total_referrals", 0) + 1
        
        data = load_json(FILES["users"])
        data[str(new_user_id)] = user_data
        data[str(referral_uid_int)] = referrer_data
        save_json(FILES["users"], data)
        
        log_user_history(new_user_id, "referral_activated", 0, f"Mã giới thiệu: {referral_code}")
        log_user_history(referral_uid_int, "referral_reward", 0, f"Người được giới thiệu: {new_user_id}")
        
        try:
            referrer_msg = f"🎉 **THƯỞNG GIỚI THIỆU!**\n\n"
            referrer_msg += f"Bạn đã có người dùng mã giới thiệu `{referral_code}`!\n\n"
            referrer_msg += f"🎁 **Quyền lợi bạn nhận:**\n"
            if referral_config.get("vip_days_referrer", 0) > 0:
                referrer_msg += f"👑 +{referral_config['vip_days_referrer']} ngày VIP\n"
            if referral_config.get("deposit_bonus_percent_referrer", 0) > 0:
                referrer_msg += f"💰 +{referral_config['deposit_bonus_percent_referrer']}% tiền nạp\n"
            referrer_msg += f"\n📊 Tổng người giới thiệu: {referrer_data['referral_stats']['total_referrals']}"
            bot.send_message(referral_uid_int, referrer_msg, parse_mode="Markdown")
        except: pass
        
        new_user_msg = f"✅ **KÍCH HOẠT MÃ GIỚI THIỆU THÀNH CÔNG!**\n\n"
        new_user_msg += f"🎫 Mã: `{referral_code}`\n\n"
        new_user_msg += f"🎁 **Quyền lợi của bạn:**\n"
        for benefit in benefits_msg:
            if "(bạn)" in benefit or "Giảm" in benefit:
                new_user_msg += f"• {benefit}\n"
        if referral_config.get("vip_days_new_user", 0) > 0:
            new_user_msg += f"\n👑 Bạn đã nhận {referral_config['vip_days_new_user']} ngày VIP!"
        
        return {"success": True, "message": new_user_msg, "referral_code": referral_code, "benefits": benefits_msg}
    except Exception as e:
        return {"success": False, "message": f"❌ Lỗi: {str(e)}"}

def save_rating(user_id, user_name, role, stars, message):
    data = load_json(FILES["ratings"])
    rating_entry = {
        "user_id": user_id,
        "user_name": user_name,
        "role": role,
        "stars": stars,
        "message": message,
        "timestamp": int(time.time()),
        "date": datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    }
    data.append(rating_entry)
    save_json(FILES["ratings"], data)
    return rating_entry

def get_all_ratings(limit=50):
    data = load_json(FILES["ratings"])
    return sorted(data, key=lambda x: x.get("timestamp", 0), reverse=True)[:limit]

def get_rating_stats():
    data = load_json(FILES["ratings"])
    if not data:
        return {"total": 0, "average": 0, "distribution": {1: 0, 2: 0, 3: 0, 4: 0, 5: 0}}
    total = len(data)
    stars_sum = sum(r.get("stars", 0) for r in data)
    average = round(stars_sum / total, 1) if total > 0 else 0
    distribution = {1: 0, 2: 0, 3: 0, 4: 0, 5: 0}
    for r in data:
        star = r.get("stars", 0)
        if star in distribution:
            distribution[star] += 1
    return {"total": total, "average": average, "distribution": distribution}

def analyze_rating_with_ai(stars, message):
    try:
        system_prompt = """Bạn là AI phân tích đánh giá chuyên nghiệp của Meta Business Support.

Nhiệm vụ:
1. Phân tích sắc thái đánh giá: Khen ngợi, Góp ý tích cực, Phàn nàn, Báo lỗi
2. Hiểu được từ ngữ lóng, cách nói tắt của người dùng Việt Nam
3. Phản hồi chuyên nghiệp, lịch sự theo chuẩn Meta Business

Quy tắc phản hồi:
- Nếu là Khen ngợi (4-5 sao, từ tích cực): Cảm ơn chân thành, thể hiện sự trân trọng
- Nếu là Góp ý tích cực (3-4 sao, có đề xuất): Cảm ơn và cam kết cải thiện
- Nếu là Phàn nàn/Báo lỗi (1-3 sao, từ tiêu cực): Xin lỗi chân thành, tóm tắt vấn đề, cam kết khắc phục ngay

Format trả về JSON:
{
    "sentiment": "praise" | "suggestion" | "complaint" | "bug_report",
    "summary": "Tóm tắt ngắn gọn vấn đề/đánh giá",
    "response": "Phản hồi chuyên nghiệp, lịch sự theo chuẩn Meta Business"
}

Chỉ trả về JSON, không thêm text khác."""
        
        user_prompt = f"Đánh giá: {stars} sao\nNội dung: {message}"
        
        headers = {"Content-Type": "application/json", "Authorization": f"Bearer {DEEPSEEK_API_KEY}"}
        data = {
            "model": "deepseek-chat",
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            "stream": False,
            "temperature": 0.7
        }
        
        response = requests.post("https://api.deepseek.com/chat/completions", headers=headers, json=data, timeout=15)
        if response.status_code == 200:
            content = response.json()['choices'][0]['message']['content'].strip()
            try:
                if content.startswith("```json"):
                    content = content.replace("```json", "").replace("```", "").strip()
                elif content.startswith("```"):
                    content = content.replace("```", "").strip()
                return json.loads(content)
            except:
                return {
                    "sentiment": "suggestion",
                    "summary": "Đánh giá từ người dùng",
                    "response": "Cảm ơn Quý khách đã dành thời gian đánh giá dịch vụ. Chúng tôi rất trân trọng ý kiến của Quý khách và sẽ không ngừng cải thiện chất lượng phục vụ."
                }
        return None
    except:
        return None

def get_uid_from_link(link):
    if "facebook.com" not in link and "fb.com" not in link: return None, None
    try:
        r = requests.get(f"https://nqtam.id.vn/re-get-id?link={link}", timeout=10)
        if r.status_code == 200:
            try:
                js = r.json()
                if "data" in js and isinstance(js["data"], dict):
                    uid = js["data"].get("id")
                    name = js["data"].get("name", "")
                    if uid:
                        return str(uid), name if name else None
            except:
                if r.text.isdigit(): return r.text, None
    except: pass
    return None, None

def save_tracking_uid(chat_id, uid, name, note, price, track_type="normal", is_verified=False, initial_status="UNKNOWN"):
    data = load_json(FILES["tracking"])
    str_chat_id = str(chat_id)
    if str_chat_id not in data: data[str_chat_id] = {}
    data[str_chat_id][str(uid)] = {
        "name": name, "note": note, "price": price, 
        "status": "waiting", "last_check": initial_status, 
        "start_time": int(time.time()), 
        "is_verified": is_verified, "track_type": track_type
    }
    save_json(FILES["tracking"], data)
    manage_uid_memory(uid, name, initial_status)

def get_tracking():
    return load_json(FILES["tracking"])

def remove_tracking_uid(chat_id, uid):
    data = load_json(FILES["tracking"])
    str_chat_id = str(chat_id)
    if str_chat_id in data and str(uid) in data[str_chat_id]:
        del data[str_chat_id][str(uid)]
        save_json(FILES["tracking"], data)
        return True
    return False

def mark_done_uid(chat_id, uid):
    data = load_json(FILES["tracking"])
    str_chat_id = str(chat_id)
    if str_chat_id in data and str(uid) in data[str_chat_id]:
        data[str_chat_id][str(uid)]["status"] = "done"
        save_json(FILES["tracking"], data)
        return True
    return False

def check_tick_xanh(uid):
    global FB_COOKIE
    try:
        headers_m = {
            "User-Agent": "Mozilla/5.0 (Linux; Android 10; SM-G960F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/88.0.4324.181 Mobile Safari/537.36",
            "Accept-Language": "en-US,en;q=0.9"
        }
        r_m = requests.get(f"https://mbasic.facebook.com/{uid}", headers=headers_m, timeout=10)
        if 'alt="Verified"' in r_m.text or 'alt="Blue Verified Badge"' in r_m.text: return True
        if '/e/1f535.png' in r_m.text: return True
    except: pass
    return False

def manage_uid_memory(uid, name, status):
    try:
        data = load_json(FILES["uid_memory"])
        if not data: data = {}
        str_uid = str(uid)
        current_time = int(time.time())
        
        if str_uid not in data:
            data[str_uid] = {
                "name": name if name else f"UID {uid}",
                "last_status": status,
                "timestamp": current_time,
                "start_time": current_time,
                "last_status_change": current_time
            }
        else:
            old_status = data[str_uid].get("last_status")
            if name:
                data[str_uid]["name"] = name
            
            if old_status != status:
                data[str_uid]["last_status"] = status
                data[str_uid]["last_status_change"] = current_time
            
            data[str_uid]["timestamp"] = current_time
            
        save_json(FILES["uid_memory"], data)
        return data.get(str_uid, {})
    except:
        return {}

def get_time_diff(timestamp):
    if not timestamp or timestamp == 0:
        return "vừa xong"
    try:
        start_time = datetime.fromtimestamp(timestamp)
        current_time = datetime.now()
        duration = current_time - start_time
        total_seconds = int(duration.total_seconds())
        
        if total_seconds < 60:
            return f"{total_seconds} giây"
            
        days = total_seconds // 86400
        hours = (total_seconds % 86400) // 3600
        minutes = (total_seconds % 3600) // 60
        seconds = total_seconds % 60
        
        parts = []
        if days > 0: parts.append(f"{days} ngày")
        if hours > 0: parts.append(f"{hours} giờ")
        if minutes > 0: parts.append(f"{minutes} phút")
        if seconds > 0 and days == 0 and hours == 0: parts.append(f"{seconds} giây")
        
        if not parts: return "vừa xong"
        return " ".join(parts)
    except:
        return "vừa xong"

def process_chat_request(user, chat_id):
    user_id = user.id
    user_name = user.first_name or "Quý khách"
    if user_id in support_queue: return bot.send_message(chat_id, "⏳ Quý khách đã có trong hàng chờ hỗ trợ. Hệ thống đang kết nối bạn với chuyên viên...")
    support_queue[user_id] = user_name
    bot.send_message(chat_id, "✅ Hệ thống đã nhận yêu cầu hỗ trợ của Quý khách. Chuyên viên sẽ phản hồi trong thời gian sớm nhất.")
    for admin_id in ADMIN_IDS:
        try:
            markup = types.InlineKeyboardMarkup()
            markup.add(types.InlineKeyboardButton(f"💬 Kết nối với Quý khách {user_id}", callback_data=f"connect_{user_id}"))
            bot.send_message(admin_id, f"📞 **YÊU CẦU HỖ TRỢ MỚI**\n👤 Tên: {user_name}\n🆔 ID: `{user_id}`\n\nHệ thống đang chờ chuyên viên kết nối.", reply_markup=markup, parse_mode="Markdown")
        except: pass

def call_feedback_ai(message):
    try:
        user_id = message.from_user.id
        chat_id = message.chat.id
        user_text = message.text
        
        if user_id not in temp_user_state or "history" not in temp_user_state[user_id]:
            temp_user_state[user_id] = {"mode": "feedback_chat", "history": []}
        
        history = temp_user_state[user_id]["history"]
        history.append({"role": "user", "content": user_text})
        
        system_prompt = read_prompt_file(FILES["prompt_feedback_agent"])
        
        headers = {"Content-Type": "application/json", "Authorization": f"Bearer {DEEPSEEK_API_KEY}"}
        data = {
            "model": "deepseek-chat",
            "messages": [{"role": "system", "content": system_prompt}] + history,
            "stream": False
        }
        
        bot.send_chat_action(chat_id, 'typing')
        response = requests.post("https://api.deepseek.com/chat/completions", headers=headers, json=data, timeout=15)
        
        if response.status_code == 200:
            ai_content = response.json()['choices'][0]['message']['content'].strip()
            history.append({"role": "assistant", "content": ai_content})
            
            if ai_content.startswith("REPLY:"):
                reply_text = ai_content.replace("REPLY:", "").strip()
                bot.send_message(chat_id, reply_text)
                
            elif ai_content.startswith("SUMMARY:"):
                summary_text = ai_content.replace("SUMMARY:", "").strip()
                first_name = message.from_user.first_name
                last_name = message.from_user.last_name if message.from_user.last_name else ""
                full_name = f"{first_name} {last_name}".strip()
                username = f"@{message.from_user.username}" if message.from_user.username else "No User"
                
                admin_msg = (f"📩 **BÁO CÁO AI LỄ TÂN**\n"
                             f"👤 {full_name}\n🆔 `{user_id}` | 🔗 {username}\n"
                             f"📝 **Tóm tắt:**\n{summary_text}\n"
                             f"👇 Bấm dưới để trả lời:")
                markup = types.InlineKeyboardMarkup()
                markup.add(types.InlineKeyboardButton(f"💬 Trả lời {first_name}", callback_data=f"admin_reply_{user_id}"))
                bot.send_message(BOSS_ID, admin_msg, reply_markup=markup, parse_mode="Markdown")
                bot.send_message(chat_id, "✅ Cảm ơn bạn! Đã gửi Admin.")
                temp_user_state.pop(user_id, None)
            else:
                bot.send_message(chat_id, ai_content)
    except: bot.send_message(chat_id, "⚠️ Lỗi kết nối AI.")

def execute_ai_command(cmd_data, chat_id):
    try:
        cmd = cmd_data.get("cmd")
        reason = cmd_data.get("reason", "Thông báo hệ thống.")
        if cmd == "give_vip":
            uid = int(cmd_data.get("uid")); days = int(cmd_data.get("days"))
            set_vip(uid, days)
            bot.send_message(chat_id, f"✅ Đã cộng {days} ngày VIP cho `{uid}`.")
            try: bot.send_message(uid, f"🎁 **QUÀ TẶNG:** +{days} ngày VIP.\n📝 {reason}")
            except: pass
        elif cmd == "give_vip_all":
            days = int(cmd_data.get("days"))
            all_users = get_all_users_list()
            msg = bot.send_message(chat_id, f"⏳ Đang phát VIP...")
            for uid in all_users:
                try:
                    set_vip(uid, days)
                    bot.send_message(uid, f"🎉 **QUÀ TOÀN SERVER:** +{days} ngày VIP.\n📝 {reason}")
                    time.sleep(0.05)
                except: pass
            bot.edit_message_text("✅ Đã phát xong.", chat_id, msg.message_id)
        elif cmd == "remove_vip":
            uid = int(cmd_data.get("uid"))
            set_vip(uid, 0)
            bot.send_message(chat_id, f"⛔ Đã xóa VIP `{uid}`.")
            try: bot.send_message(uid, f"⚠️ VIP bị thu hồi.\n📝 {reason}")
            except: pass
        elif cmd == "add_money":
            uid = int(cmd_data.get("uid")); amt = int(cmd_data.get("amount"))
            update_balance(uid, amt)
            bot.send_message(chat_id, f"💰 Đã cộng {format_vnd(amt)} cho `{uid}`.")
        elif cmd == "set_price_vip":
            update_config("vip_price_30d", int(cmd_data.get("amount")))
            bot.send_message(chat_id, "✅ Đã đổi giá VIP.")
        elif cmd == "mass_create_referral":
            vip_days_referrer = int(cmd_data.get("vip_days_referrer", 0))
            vip_days_new_user = int(cmd_data.get("vip_days_new_user", 0))
            deposit_bonus_referrer = int(cmd_data.get("deposit_bonus_referrer", 0))
            deposit_bonus_new_user = int(cmd_data.get("deposit_bonus_new_user", 0))
            vip_discount = int(cmd_data.get("vip_discount", 0))
            
            bot.send_message(chat_id, "⏳ Đang tạo mã giới thiệu cho tất cả user...")
            
            def mass_create_async():
                try:
                    created_count, config = mass_create_referral_codes(
                        vip_days_referrer, vip_days_new_user,
                        deposit_bonus_referrer, deposit_bonus_new_user,
                        vip_discount
                    )
                    
                    all_users = get_all_users_list()
                    sent_count = 0
                    
                    benefits_text = []
                    if config["vip_days_referrer"] > 0:
                        benefits_text.append(f"👑 +{config['vip_days_referrer']} ngày VIP")
                    if config["vip_days_new_user"] > 0:
                        benefits_text.append(f"👑 +{config['vip_days_new_user']} ngày VIP (người mới)")
                    if config["deposit_bonus_percent_referrer"] > 0:
                        benefits_text.append(f"💰 +{config['deposit_bonus_percent_referrer']}% tiền nạp")
                    if config["deposit_bonus_percent_new_user"] > 0:
                        benefits_text.append(f"💰 +{config['deposit_bonus_percent_new_user']}% tiền nạp (người mới)")
                    if config["vip_discount_percent"] > 0:
                        benefits_text.append(f"🎫 Giảm {config['vip_discount_percent']}% khi mua VIP (người mới)")
                    
                    benefits_str = "\n".join(benefits_text) if benefits_text else "Quyền lợi đặc biệt"
                    
                    for user_id in all_users:
                        try:
                            user_data = get_user_data(user_id)
                            referral_code = user_data.get("referral_code", str(user_id))
                            referral_link = f"https://t.me/{bot.get_me().username}?start=ref_{referral_code}"
                            
                            try:
                                chat_member = bot.get_chat_member(user_id, user_id)
                                user_name = chat_member.user.first_name or "Bạn"
                            except:
                                user_name = "Bạn"
                            
                            personalized_msg = f"🎉 **CHÚC MỪNG {user_name}!**\n\n"
                            personalized_msg += f"Bạn đã được Admin cấp mã giới thiệu riêng!\n\n"
                            personalized_msg += f"🔑 **Mã của bạn:** `{referral_code}`\n\n"
                            personalized_msg += f"🔗 **Link giới thiệu:**\n`{referral_link}`\n\n"
                            personalized_msg += f"🎁 **Khi bạn bè dùng mã, bạn sẽ nhận:**\n{benefits_str}\n\n"
                            personalized_msg += f"💡 Hãy gửi link này cho bạn bè để nhận thưởng!"
                            
                            markup = types.InlineKeyboardMarkup()
                            markup.add(types.InlineKeyboardButton("📋 Sao chép Link", url=referral_link))
                            
                            bot.send_message(user_id, personalized_msg, reply_markup=markup, parse_mode="Markdown")
                            sent_count += 1
                            time.sleep(0.03)
                        except: pass
                    
                    admin_report = f"✅ **ĐÃ TẠO MÃ GIỚI THIỆU HÀNG LOẠT**\n\n"
                    admin_report += f"📊 Đã tạo: {created_count} mã mới\n"
                    admin_report += f"📤 Đã gửi thông báo: {sent_count} user\n\n"
                    admin_report += f"🎁 **Quyền lợi đã thiết lập:**\n"
                    admin_report += f"👑 Người mời: +{config['vip_days_referrer']} ngày VIP\n"
                    admin_report += f"👑 Người mới: +{config['vip_days_new_user']} ngày VIP\n"
                    admin_report += f"💰 Người mời: +{config['deposit_bonus_percent_referrer']}% tiền nạp\n"
                    admin_report += f"💰 Người mới: +{config['deposit_bonus_percent_new_user']}% tiền nạp\n"
                    admin_report += f"🎫 Người mới: Giảm {config['vip_discount_percent']}% khi mua VIP\n\n"
                    admin_report += f"📝 {reason}"
                    
                    bot.send_message(chat_id, admin_report, parse_mode="Markdown")
                except Exception as e:
                    bot.send_message(chat_id, f"❌ Lỗi: {str(e)}")
            
            threading.Thread(target=mass_create_async, daemon=True).start()
        elif cmd == "create_code":
            code_name = cmd_data.get("code_name", "").upper()
            code_type = cmd_data.get("code_type", "FREE_VIP")
            value = int(cmd_data.get("value", 0))
            max_uses = int(cmd_data.get("max_uses", 100))
            expiry_days = int(cmd_data.get("expiry_days", 30))
            expiry_date = cmd_data.get("expiry_date", None)
            min_amount = int(cmd_data.get("min_amount", 0))
            
            if not code_name:
                bot.send_message(chat_id, "❌ Tên mã không được để trống.")
                return
            
            code_entry = create_code(code_name, code_type, value, max_uses, expiry_days, expiry_date, min_amount)
            
            code_type_text = {
                "FREE_VIP": f"Tặng {value} ngày VIP",
                "DISCOUNT": f"Giảm {value}%",
                "BONUS_DAYS": f"Tặng thêm {value} ngày VIP",
                "ADD_MONEY": f"Tặng {format_vnd(value)}"
            }.get(code_type, code_type)
            
            expiry_date = datetime.fromtimestamp(code_entry["expiry"]).strftime('%d/%m/%Y')
            
            admin_msg = f"✅ **ĐÃ TẠO MÃ THÀNH CÔNG**\n\n"
            admin_msg += f"🎫 **Mã:** `{code_name}`\n"
            admin_msg += f"📦 **Loại:** {code_type_text}\n"
            admin_msg += f"📊 **Số lượt:** {max_uses}\n"
            admin_msg += f"📅 **Hạn dùng:** {expiry_date}\n"
            if code_entry.get("min_amount", 0) > 0:
                admin_msg += f"💰 **Tối thiểu:** {format_vnd(code_entry.get('min_amount', 0))}\n"
            admin_msg += f"\n📝 {reason}"
            
            bot.send_message(chat_id, admin_msg, parse_mode="Markdown")
            
            broadcast_msg = f"🎉 **MÃ KHUYẾN MÃI MỚI!**\n\n"
            broadcast_msg += f"🎫 **Mã:** `{code_name}`\n"
            broadcast_msg += f"🎁 **Quà tặng:** {code_type_text}\n"
            broadcast_msg += f"📊 **Số lượt:** {max_uses}\n"
            broadcast_msg += f"📅 **Hạn dùng:** {expiry_date}\n"
            if code_entry.get("min_amount", 0) > 0:
                broadcast_msg += f"💰 **Tối thiểu:** {format_vnd(code_entry.get('min_amount', 0))}\n"
            broadcast_msg += f"\n💡 Nhập mã ngay để nhận quà!\n\n"
            broadcast_msg += f"📝 {reason}"
            
            markup = types.InlineKeyboardMarkup()
            markup.add(types.InlineKeyboardButton("🎫 Nhập Mã Ngay", callback_data="enter_code"))
            
            all_users = get_all_users_list()
            sent_count = 0
            for uid in all_users:
                try:
                    bot.send_message(uid, broadcast_msg, reply_markup=markup, parse_mode="Markdown")
                    sent_count += 1
                    time.sleep(0.03)
                except: pass
            
            bot.send_message(chat_id, f"✅ Đã gửi thông báo mã mới cho {sent_count} người dùng.")
    except Exception as e: bot.send_message(chat_id, f"❌ Lỗi: {str(e)}")

def call_deepseek_ai(user_id, chat_id, user_text):
    try:
        if user_id in temp_user_state and temp_user_state[user_id].get("mode") == "feedback_chat":
            call_feedback_ai(bot.get_channel_post(chat_id) if False else types.Message(message_id=0, from_user=types.User(user_id, False, "User"), date=0, chat=types.Chat(chat_id, "private"), content_type="text", options={}, json_string="")) 
            return

        is_admin = user_id in ADMIN_IDS
        if is_admin:
            prompt_file = FILES["prompt_code_logic"] if any(keyword in user_text.lower() for keyword in ["tạo mã", "tạo code", "mã khuyến mãi", "voucher", "mã giới thiệu", "referral", "affiliate"]) else FILES["prompt_admin"]
        else:
            prompt_file = FILES["prompt_user_twoface"]
        
        system_prompt = read_prompt_file(prompt_file)
        headers = {"Content-Type": "application/json", "Authorization": f"Bearer {DEEPSEEK_API_KEY}"}
        
        if is_admin and prompt_file == FILES["prompt_code_logic"]:
            system_prompt += "\n\nTrả về JSON với format:\n"
            system_prompt += "Tạo mã khuyến mãi: {\"cmd\": \"create_code\", \"code_name\": \"TENMA\", \"code_type\": \"FREE_VIP|DISCOUNT|BONUS_DAYS|ADD_MONEY\", \"value\": số, \"max_uses\": số, \"expiry_days\": số, \"expiry_date\": \"YYYY-MM-DD\" (tùy chọn), \"min_amount\": số (tùy chọn), \"reason\": \"Lý do\"}\n"
            system_prompt += "Tạo mã giới thiệu hàng loạt: {\"cmd\": \"mass_create_referral\", \"vip_days_referrer\": số, \"vip_days_new_user\": số, \"deposit_bonus_referrer\": số (%), \"deposit_bonus_new_user\": số (%), \"vip_discount\": số (%), \"reason\": \"Lý do\"}\n\n"
            system_prompt += "Chỉ trả về JSON, không thêm text khác."
        
        data = {"model": "deepseek-chat", "messages": [{"role": "system", "content": system_prompt}, {"role": "user", "content": user_text}], "stream": False}
        bot.send_chat_action(chat_id, 'typing')
        response = requests.post("https://api.deepseek.com/chat/completions", headers=headers, json=data, timeout=15)
        if response.status_code == 200:
            content = response.json()['choices'][0]['message']['content'].strip()
            if is_admin and content.startswith("{") and content.endswith("}"):
                try: 
                    cmd_data = json.loads(content)
                    execute_ai_command(cmd_data, chat_id)
                except: bot.send_message(chat_id, content)
            else:
                bot.send_message(chat_id, content)
    except: pass

def ai_create_broadcast(admin_id, topic):
    try:
        system_prompt = read_prompt_file(FILES["thongbao_prompt"])
        prompt_user = f"Viết thông báo về: {topic}. Ngắn gọn, thu hút."
        headers = {"Content-Type": "application/json", "Authorization": f"Bearer {DEEPSEEK_API_KEY}"}
        data = {"model": "deepseek-chat", "messages": [{"role": "system", "content": system_prompt}, {"role": "user", "content": prompt_user}]}
        bot.send_message(admin_id, "✍️ AI đang viết...")
        response = requests.post("https://api.deepseek.com/chat/completions", headers=headers, json=data, timeout=20)
        if response.status_code == 200:
            content = response.json()['choices'][0]['message']['content']
            markup = types.InlineKeyboardMarkup()
            markup.add(types.InlineKeyboardButton("📢 Gửi Thường", callback_data="exec_notify_normal"))
            markup.add(types.InlineKeyboardButton("💌 Gửi & Nhận Feedback", callback_data="exec_notify_feedback"))
            temp_user_state[admin_id] = {"broadcast_content": content}
            bot.send_message(admin_id, f"🔔 **NỘI DUNG:**\n\n{content}\n\n👇 Chọn cách gửi:", reply_markup=markup, parse_mode="Markdown")
    except: pass

def execute_broadcast_final(admin_id, content, mode="normal", photo_id=None):
    all_users = get_all_users_list()
    markup = None
    if mode == "feedback":
        markup = types.InlineKeyboardMarkup()
        markup.add(types.InlineKeyboardButton("💬 Phản hồi cho Admin", callback_data="feedback_reply"))
    count = 0
    bot.send_message(admin_id, "📤 Đang gửi...")
    for uid in all_users:
        try:
            if photo_id:
                caption = f"📢 **THÔNG BÁO:**\n\n{content}\n\n— Admin" if content else "📢 **THÔNG BÁO**\n\n— Admin"
                bot.send_photo(uid, photo_id, caption=caption, reply_markup=markup, parse_mode="Markdown")
            else:
                bot.send_message(uid, f"📢 **THÔNG BÁO:**\n\n{content}\n\n— Admin", reply_markup=markup, parse_mode="Markdown")
            count += 1; time.sleep(0.05)
        except: pass
    bot.send_message(admin_id, f"✅ Đã gửi {count} người.")

def check_uid_live_die(uid):
    user_agents = [
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    ]
    headers = {
        "User-Agent": random.choice(user_agents),
        "Accept": "application/json",
        "Accept-Language": "en-US,en;q=0.9"
    }
    urls = [
        f"https://graph.facebook.com/v3.3/{uid}/picture?redirect=0",
        f"https://graph2.facebook.com/v3.3/{uid}/picture?redirect=0"
    ]
    random.shuffle(urls)
    for url in urls:
        try:
            r = requests.get(url, headers=headers, timeout=5, allow_redirects=False)
            if r.status_code == 200:
                response_text = r.text
                if '"height"' in response_text or '"height":' in response_text:
                    return "LIVE"
                elif '"error"' in response_text:
                    return "DIE"
        except: continue
    return "DIE"

def check_single_uid(uid, info, cid):
    if info.get("status") == "done":
        return None
    try:
        time.sleep(random.uniform(3, 5))
        curr_status = check_uid_live_die(uid)
        last_status = info.get("last_check", "UNKNOWN")
        
        mem_info = manage_uid_memory(uid, info.get("name"), curr_status)
        last_status_change = mem_info.get("last_status_change", 0)
        
        if last_status == "UNKNOWN":
            return {
                "uid": uid, "info": info, "cid": cid, 
                "curr": curr_status, "update": True, "notify": False
            }
        
        if curr_status != last_status and curr_status in ["LIVE", "DIE"]:
            return {
                "uid": uid, "info": info, "cid": cid, 
                "curr": curr_status, "update": True, "notify": True,
                "duration_ts": last_status_change,
                "mem_name": mem_info.get("name")
            }
            
        return None
    except:
        return None

def auto_check_thread():
    executor = ThreadPoolExecutor(max_workers=10)
    try:
        while True:
            try:
                data = load_json(FILES["tracking"])
                if not data:
                    time.sleep(5)
                    continue
                
                tasks = []
                for cid, uids in data.items():
                    for uid, info in uids.items():
                        tasks.append((uid, info.copy(), cid))
                
                if not tasks:
                    time.sleep(5)
                    continue
                
                random.shuffle(tasks)
                futures = {executor.submit(check_single_uid, uid, info, cid): (uid, cid) for uid, info, cid in tasks}
                up = False
                notifications = []
                
                for future in as_completed(futures):
                    try:
                        result = future.result()
                        if result:
                            uid = result["uid"]
                            cid = result["cid"]
                            curr = result["curr"]
                            update = result["update"]
                            notify = result["notify"]
                            
                            if update:
                                if cid in data and uid in data[cid]:
                                    data[cid][uid]["last_check"] = curr
                                    up = True
                            
                            if notify:
                                if cid in data and uid in data[cid]:
                                    info = data[cid][uid]
                                    notifications.append({
                                        "uid": uid,
                                        "info": info,
                                        "cid": cid,
                                        "curr": curr,
                                        "duration_ts": result.get("duration_ts", 0),
                                        "mem_name": result.get("mem_name", info.get("name", f"UID {uid}"))
                                    })
                    except:
                        continue
                
                if up:
                    save_json(FILES["tracking"], data)
                
                for note in notifications:
                    try:
                        chat_id = int(note["cid"])
                        uid_str = note["uid"]
                        curr_status = note["curr"]
                        duration_ts = note.get("duration_ts", 0)
                        mem_name = note.get("mem_name", note["info"].get("name", f"UID {uid_str}"))
                        
                        telegram_name = "Bạn"
                        try:
                            chat_info = bot.get_chat(chat_id)
                            telegram_name = chat_info.first_name or "Bạn"
                        except: pass
                        
                        duration_str = get_time_diff(duration_ts)
                        
                        name = note["info"].get("name", "Facebook User")
                        note_text = note["info"].get("note", "")
                        price = note["info"].get("price", 0)
                        status_icon = "LIVE ✅" if curr_status == "LIVE" else "DIE ❌"
                        if curr_status == "LIVE":
                            progress_text = "🟢 Đang theo dõi trạng thái"
                        else:
                            progress_text = "🟢 Đang theo dõi chờ LIVE ✅"
                        time_str = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
                        name_emoji = "👤"
                        
                        prefix = ""
                        if curr_status == "LIVE":
                            prefix = f"✅ Sống rồi sếp ơi **{telegram_name}**!\n\n"
                        elif curr_status == "DIE":
                            prefix = f"❌ Die rồi sếp ơi **{telegram_name}**!\n\n"
                        
                        time_label = "Thời gian Die" if curr_status == "LIVE" else "Thời gian Sống"
                        
                        msg = f"{prefix}UID {uid_str} - {status_icon}\n\n{name_emoji} Tên: {name}\n📝 Ghi chú: {note_text}\n💵 Giá: {format_vnd(price)}\n🔄 Tiến trình: {progress_text}\n⏰ {time_label}: {duration_str}\n⏰ Thời gian: {time_str}"
                        markup = types.InlineKeyboardMarkup()
                        markup.add(types.InlineKeyboardButton("✅ Done", callback_data=f"done_{uid_str}"), types.InlineKeyboardButton("❌ Hủy", callback_data=f"del_{uid_str}"))
                        markup.add(types.InlineKeyboardButton("🔄 Tiếp tục", callback_data=f"keep_{uid_str}"))
                        bot.send_message(chat_id, msg, reply_markup=markup, parse_mode="Markdown")
                    except: pass
            except: pass
    finally:
        executor.shutdown(wait=False)

@bot.message_handler(commands=['start'])
def send_welcome(message):
    user_id = message.from_user.id
    user_name = message.from_user.first_name or "Bạn"
    save_user_global(user_id)
    
    referral_processed = False
    if message.text and len(message.text.split()) > 1:
        start_param = message.text.split()[1]
        if start_param.startswith("ref_"):
            referral_input = start_param.replace("ref_", "")
            result = use_referral_code(user_id, referral_input)
            if result.get("success"):
                bot.send_message(message.chat.id, result.get("message", ""), parse_mode="Markdown")
                referral_processed = True
            else:
                bot.send_message(message.chat.id, result.get('message', '⚠️ Mã giới thiệu không hợp lệ.'))
    
    msg = f"""
👋 **Xin chào {user_name}!**

💎 **HỆ THỐNG CHECK UID FACEBOOK VIP**
━━━━━━━━━━━━━━━━━━━━━━━━━━
🛠 **TÍNH NĂNG NỔI BẬT:**

1️⃣ **CHECK LIVE/DIE:**
   • Kiểm tra trạng thái UID liên tục.

2️⃣ **CHECK META VERIFIED (V10.0):**
   • **Nhập UID -> Bot tự treo.**
   • Sử dụng Cookie (User tự nạp) để check xuyên lục địa.
   • Báo **TING TING** ngay khi lên Tích.

3️⃣ **LƯU Ý:**
   • Muốn check nick VIP (như Mark) thì phải nạp Cookie.
   • Tự mua Clone mà lấy Cookie, Admin không rảnh phục vụ free =))

👨‍💻 **ADMIN:** Phạm Xuân Tiến - DVFB
━━━━━━━━━━━━━━━━━━━━━━━━━━
🚀 **CHỌN CHỨC NĂNG:**
"""
    markup = types.InlineKeyboardMarkup(row_width=2)
    markup.add(
        types.InlineKeyboardButton("➕ Thêm UID", callback_data="add_uid"),
        types.InlineKeyboardButton("🌟 Check Meta", callback_data="add_meta"),
        types.InlineKeyboardButton("📋 Danh sách", callback_data="list_uid"),
        types.InlineKeyboardButton("💰 Nạp Tiền", callback_data="deposit"),
        types.InlineKeyboardButton("✅ Mua VIP", callback_data="buy_vip"),
        types.InlineKeyboardButton("📊 Thống kê", callback_data="stats"),
        types.InlineKeyboardButton("👤 Tài khoản", callback_data="info_account"),
        types.InlineKeyboardButton("🍪 Nạp Cookie", callback_data="help_cookie"),
        types.InlineKeyboardButton("💬 Chat Support", callback_data="start_support"),
        types.InlineKeyboardButton("⭐ Góp ý & Đánh giá", callback_data="start_rating"),
        types.InlineKeyboardButton("📊 Xem đánh giá", callback_data="view_ratings"),
        types.InlineKeyboardButton("🎁 Mã Giới Thiệu", callback_data="show_referral"),
        types.InlineKeyboardButton("🎫 Nhập Mã", callback_data="enter_code")
    )
    if user_id in ADMIN_IDS:
        markup.add(types.InlineKeyboardButton("🛡️ Admin Panel", callback_data="open_admin_panel"))
    bot.send_message(message.chat.id, msg, reply_markup=markup, parse_mode="Markdown")

@bot.message_handler(commands=['admin'])
def admin_panel_command(message):
    if message.from_user.id not in ADMIN_IDS: return
    show_admin_panel(message.chat.id, message.from_user.id)

def show_admin_panel(chat_id, user_id):
    markup = types.InlineKeyboardMarkup(row_width=2)
    markup.add(
        types.InlineKeyboardButton(f"📋 DS Chờ ({len(support_queue)})", callback_data="admin_view_queue"),
        types.InlineKeyboardButton("🤖 AI Soạn TB", callback_data="admin_ai_broadcast"), 
        types.InlineKeyboardButton("👥 Quản lý User", callback_data="admin_manage_users"),
        types.InlineKeyboardButton("➕ Cộng tiền", callback_data="admin_add_guide"),
        types.InlineKeyboardButton("📊 Doanh Thu", callback_data="admin_stats_full"),
        types.InlineKeyboardButton("❌ Đóng", callback_data="close_panel")
    )
    bot.send_message(chat_id, f"🛡️ **ADMIN PANEL**\n👑 Admin: `{user_id}`", reply_markup=markup, parse_mode="Markdown")

@bot.message_handler(commands=['ai_thongbao'])
def command_ai_broadcast(message):
    if message.from_user.id not in ADMIN_IDS: return
    topic = message.text.replace("/ai_thongbao", "").strip()
    if not topic: return bot.reply_to(message, "⚠️ Nhập chủ đề.")
    threading.Thread(target=ai_create_broadcast, args=(message.from_user.id, topic)).start()

@bot.message_handler(commands=['thongbao'])
def send_broadcast(message):
    if message.from_user.id not in ADMIN_IDS: return
    msg_text = message.text.replace("/thongbao", "").strip() if message.text else ""
    photo_id = None
    
    if message.reply_to_message and message.reply_to_message.photo:
        photo_id = message.reply_to_message.photo[-1].file_id
        if message.reply_to_message.caption:
            msg_text = message.reply_to_message.caption if not msg_text else msg_text
    elif message.photo:
        photo_id = message.photo[-1].file_id
        if message.caption:
            msg_text = message.caption if not msg_text else msg_text
    
    if not msg_text and not photo_id: return bot.reply_to(message, "⚠️ Nhập nội dung hoặc paste/gửi hình ảnh.")
    execute_broadcast_final(message.from_user.id, msg_text, mode="normal", photo_id=photo_id)

@bot.message_handler(commands=['addmoney'])
def admin_add_money(message):
    if message.from_user.id not in ADMIN_IDS: return 
    try:
        _, uid, amount = message.text.split()
        uid = int(uid); amount = int(amount)
        
        bonus_info = calculate_bonus_with_ai(amount, uid)
        
        user_data = get_user_data(uid)
        referral_config = get_referral_config()
        referral_bonus_percent = 0
        if user_data.get("used_referral") and referral_config.get("deposit_bonus_percent_new_user", 0) > 0:
            referral_bonus_percent = referral_config["deposit_bonus_percent_new_user"]
            if bonus_info.get("has_bonus"):
                bonus_info["bonus_percent"] = bonus_info.get("bonus_percent", 0) + referral_bonus_percent
                base_decimal = Decimal(str(amount))
                total_bonus_decimal = base_decimal * Decimal(str(bonus_info["bonus_percent"])) / Decimal("100")
                bonus_info["bonus_amount"] = int(total_bonus_decimal.quantize(Decimal('1'), rounding=ROUND_HALF_UP))
                bonus_info["total_amount"] = int((base_decimal + total_bonus_decimal).quantize(Decimal('1'), rounding=ROUND_HALF_UP))
            else:
                bonus_info["has_bonus"] = True
                bonus_info["bonus_percent"] = referral_bonus_percent
                base_decimal = Decimal(str(amount))
                bonus_decimal = base_decimal * Decimal(str(referral_bonus_percent)) / Decimal("100")
                bonus_info["bonus_amount"] = int(bonus_decimal.quantize(Decimal('1'), rounding=ROUND_HALF_UP))
                bonus_info["total_amount"] = int((base_decimal + bonus_decimal).quantize(Decimal('1'), rounding=ROUND_HALF_UP))
                bonus_info["code_name"] = "Referral Bonus"
                bonus_info["code_valid"] = True
                bonus_info["validation_message"] = "Đạt"
        
        if bonus_info.get("has_bonus") and bonus_info.get("code_valid"):
            admin_msg = f"💰 **YÊU CẦU NẠP TIỀN**\n\n"
            admin_msg += f"👤 User: `{uid}`\n"
            admin_msg += f"💵 Nạp gốc: {format_vnd(bonus_info['base_amount'])}\n"
            admin_msg += f"🎫 Mã áp dụng: `{bonus_info['code_name']}` ({bonus_info['bonus_percent']}%)\n"
            admin_msg += f"📋 Điều kiện đạt: ✅ {bonus_info.get('validation_message', 'Đạt')}\n"
            if bonus_info.get('min_amount', 0) > 0:
                admin_msg += f"   • Tối thiểu: {format_vnd(bonus_info['min_amount'])} | Đạt: ✅\n"
            if bonus_info.get('expiry_date'):
                admin_msg += f"   • Hạn dùng: {bonus_info['expiry_date']} | Đạt: ✅\n"
            admin_msg += f"🎁 Thưởng thêm: {format_vnd(bonus_info['bonus_amount'])}\n"
            admin_msg += f"✅ **Số tiền cuối: {format_vnd(bonus_info['total_amount'])}**\n\n"
            admin_msg += f"👇 Bấm để duyệt:"
            
            markup = types.InlineKeyboardMarkup()
            markup.add(types.InlineKeyboardButton("✅ Duyệt", callback_data=f"approve_deposit_{uid}_{bonus_info['base_amount']}_{bonus_info['total_amount']}"))
            markup.add(types.InlineKeyboardButton("❌ Hủy", callback_data=f"cancel_deposit_{uid}"))
            
            bot.reply_to(message, admin_msg, reply_markup=markup, parse_mode="Markdown")
        elif bonus_info.get("has_bonus") and not bonus_info.get("code_valid"):
            admin_msg = f"⚠️ **MÃ KHÔNG HỢP LỆ**\n\n"
            admin_msg += f"👤 User: `{uid}`\n"
            admin_msg += f"💵 Nạp gốc: {format_vnd(amount)}\n"
            admin_msg += f"🎫 Mã: `{bonus_info.get('code_name', 'N/A')}`\n"
            admin_msg += f"❌ **Điều kiện đạt: {bonus_info.get('validation_message', 'Không đạt')}**\n\n"
            admin_msg += f"💡 Mã đã bị xóa khỏi tài khoản. Nạp tiền bình thường:"
            
            markup = types.InlineKeyboardMarkup()
            markup.add(types.InlineKeyboardButton("✅ Nạp không mã", callback_data=f"approve_deposit_{uid}_{amount}_{amount}"))
            markup.add(types.InlineKeyboardButton("❌ Hủy", callback_data=f"cancel_deposit_{uid}"))
            
            bot.reply_to(message, admin_msg, reply_markup=markup, parse_mode="Markdown")
        else:
            new_bal = update_balance(uid, amount)
            log_user_history(uid, "deposit", amount, "Admin cộng")
            bot.reply_to(message, f"✅ Cộng {format_vnd(amount)} cho `{uid}`.\nDư: {format_vnd(new_bal)}", parse_mode="Markdown")
            try: bot.send_message(uid, f"✅ **CỘNG TIỀN THÀNH CÔNG!**\n💰 +{format_vnd(amount)}\n💵 Số dư: {format_vnd(new_bal)}", parse_mode="Markdown")
            except: pass
    except: bot.reply_to(message, "⚠️ `/addmoney <UID> <TIỀN>`", parse_mode="Markdown")

@bot.message_handler(commands=['setprice'])
def admin_set_price(message):
    if message.from_user.id not in ADMIN_IDS: return
    try:
        _, price = message.text.split()
        update_config("vip_price_30d", int(price))
        bot.reply_to(message, f"✅ Đã đổi giá VIP 1 tháng thành: {format_vnd(price)}")
    except: bot.reply_to(message, "⚠️ Lỗi. Dùng: `/setprice <số_tiền>`")

@bot.message_handler(commands=['setbank'])
def admin_set_bank(message):
    if message.from_user.id not in ADMIN_IDS: return
    try:
        info = message.text.replace("/setbank", "").strip()
        if not info: return bot.reply_to(message, "⚠️ Nhập thông tin bank.")
        update_config("bank_info", info)
        bot.reply_to(message, f"✅ Đã đổi thông tin Bank:\n{info}")
    except: pass

@bot.message_handler(commands=['tangvip'])
def admin_give_vip(message):
    if message.from_user.id not in ADMIN_IDS: return
    try:
        _, uid, days = message.text.split()
        exp = set_vip(int(uid), int(days))
        bot.reply_to(message, f"✅ Đã tặng VIP {days} ngày cho `{uid}`.")
        try: bot.send_message(int(uid), f"🎁 **BẠN ĐƯỢC TẶNG VIP!**\nThời hạn: {days} ngày.")
        except: pass
    except: bot.reply_to(message, "⚠️ Dùng: `/tangvip <UID> <SỐ_NGÀY>`")

@bot.message_handler(commands=['addadmin'])
def admin_add_new_admin(message):
    if message.from_user.id != BOSS_ID: return 
    try:
        _, uid = message.text.split()
        if add_new_admin(int(uid)): bot.reply_to(message, f"✅ Đã thêm Admin `{uid}`", parse_mode="Markdown")
    except: pass

@bot.message_handler(commands=['endchat'])
def end_chat_command(message):
    user_id = message.from_user.id
    if user_id in active_chats:
        partner_id = active_chats[user_id]
        del active_chats[user_id]
        if partner_id in active_chats:
            del active_chats[partner_id]
        if user_id in ADMIN_IDS:
            bot.reply_to(message, "✅ Đã kết thúc hội thoại hỗ trợ với Quý khách.")
            try: bot.send_message(partner_id, "👋 Chuyên viên đã kết thúc hội thoại hỗ trợ. Cảm ơn Quý khách đã sử dụng dịch vụ!")
            except: pass
        else:
            bot.reply_to(message, "✅ Đã kết thúc hội thoại hỗ trợ. Cảm ơn Quý khách đã sử dụng dịch vụ!")
            try: bot.send_message(partner_id, "👋 Quý khách đã kết thúc hội thoại hỗ trợ.")
            except: pass
    else:
        bot.reply_to(message, "❌ Quý khách không đang trong hội thoại hỗ trợ nào.")

@bot.message_handler(commands=['naptien'], content_types=['text', 'photo'])
def handle_naptien(message):
    user_id = message.from_user.id
    chat_id = message.chat.id
    text = message.text or message.caption or ""
    parts = text.split()
    
    if len(parts) < 2 or not parts[0].startswith('/naptien'):
        temp_user_state[user_id] = {"mode": "deposit", "step": "wait_amount"}
        return bot.reply_to(message, "💰 **NẠP TIỀN**\n\n📝 Vui lòng nhập số tiền cần nạp (Ví dụ: 50000, 100000...)", parse_mode="Markdown")
    
    try:
        amount_text = parts[1].strip().replace(".", "").replace(",", "").replace(" ", "")
        if not amount_text.isdigit(): return bot.reply_to(message, "❌ Số tiền không hợp lệ.")
        amount = int(amount_text)
        if amount <= 0: return bot.reply_to(message, "❌ Số tiền phải > 0.")
        
        qr_url = f"https://qr.sepay.vn/img?acc=0398085063&bank=ICB&amount={amount}&des={user_id}&template=compact&download=false"
        form_msg = f"▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬\n🔥 HỆ THỐNG NẠP TIỀN NHANH 🔥\n▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬\n\n🏦 NGÂN HÀNG: VIETINBANK\n💳 STK: 0398085063\n👤 CHỦ TK: PHAM XUAN TIEN\n💰 SỐ TIỀN: {format_vnd(amount)} VNĐ\n\n📌 NỘI DUNG CK: 👉 {user_id} 👈\n\n👉 QUÉT MÃ QR HOẶC CK THEO THÔNG TIN TRÊN\n📝 Gửi bill tại đây để Admin duyệt.\n▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬"
        
        temp_user_state[user_id] = {"mode": "deposit", "step": "wait_bill", "amount": amount}
        bot.send_photo(chat_id, qr_url, caption=form_msg)
    except:
        bot.reply_to(message, "❌ Lỗi xử lý.")

@bot.callback_query_handler(func=lambda call: True)
def handle_callback(call):
    try:
        user_id = call.from_user.id; chat_id = call.message.chat.id
        
        if call.data == "start_support":
            process_chat_request(call.from_user, chat_id)
            bot.answer_callback_query(call.id)
            
        elif call.data == "help_cookie":
            bot.send_message(chat_id, "🍪 **HƯỚNG DẪN NẠP COOKIE:**\n\n👉 Mua Clone/Via về, lấy Cookie.\n👉 Gõ: `/cookie <dán_cookie>`\n\n(Người dùng tự trang bị cookie, Admin không cung cấp).", parse_mode="Markdown")
            bot.answer_callback_query(call.id)
        
        elif call.data == "admin_ai_broadcast":
            if user_id in ADMIN_IDS:
                bot.send_message(chat_id, "🤖 Nhập chủ đề thông báo:")
                temp_user_state[user_id] = {"mode": "ai", "step": "wait_ai_topic"}
            bot.answer_callback_query(call.id)
        
        elif call.data == "exec_notify_normal":
            if user_id in ADMIN_IDS and "broadcast_content" in temp_user_state[user_id]:
                execute_broadcast_final(user_id, temp_user_state[user_id]["broadcast_content"], "normal")
                temp_user_state.pop(user_id, None)
            bot.answer_callback_query(call.id)

        elif call.data == "exec_notify_feedback":
            if user_id in ADMIN_IDS and "broadcast_content" in temp_user_state[user_id]:
                execute_broadcast_final(user_id, temp_user_state[user_id]["broadcast_content"], "feedback")
                temp_user_state.pop(user_id, None)
            bot.answer_callback_query(call.id)

        elif call.data == "start_rating":
            msg = "⭐ **GÓP Ý & ĐÁNH GIÁ DỊCH VỤ**\n\nQuý khách vui lòng chọn số sao đánh giá (1-5 ⭐):"
            markup = types.InlineKeyboardMarkup(row_width=5)
            markup.add(
                types.InlineKeyboardButton("1⭐", callback_data="rate_1"),
                types.InlineKeyboardButton("2⭐", callback_data="rate_2"),
                types.InlineKeyboardButton("3⭐", callback_data="rate_3"),
                types.InlineKeyboardButton("4⭐", callback_data="rate_4"),
                types.InlineKeyboardButton("5⭐", callback_data="rate_5")
            )
            bot.send_message(chat_id, msg, reply_markup=markup, parse_mode="Markdown")
            bot.answer_callback_query(call.id)
        
        elif call.data.startswith("rate_"):
            stars = int(call.data.split("_")[1])
            role = "Admin" if user_id in ADMIN_IDS else "User"
            user_name = call.from_user.first_name or "Quý khách"
            temp_user_state[user_id] = {"mode": "rating", "step": "wait_message", "stars": stars, "role": role, "user_name": user_name}
            stars_display = "⭐" * stars
            bot.send_message(chat_id, f"✅ Quý khách đã chọn {stars} sao {stars_display}\n\n📝 Vui lòng nhập nội dung góp ý/đánh giá của Quý khách:", parse_mode="Markdown")
            bot.answer_callback_query(call.id)
        
        elif call.data == "view_ratings":
            stats = get_rating_stats()
            ratings = get_all_ratings(10)
            
            if not ratings:
                bot.send_message(chat_id, "📊 **ĐÁNH GIÁ DỊCH VỤ**\n\nChưa có đánh giá nào. Hãy là người đầu tiên đánh giá dịch vụ!", parse_mode="Markdown")
                bot.answer_callback_query(call.id)
                return
            
            msg = f"📊 **ĐÁNH GIÁ DỊCH VỤ**\n\n"
            msg += f"⭐ **Điểm trung bình:** {stats['average']}/5.0\n"
            msg += f"📈 **Tổng số đánh giá:** {stats['total']}\n\n"
            msg += f"📊 **Phân bố:**\n"
            for star in range(5, 0, -1):
                count = stats['distribution'][star]
                bar = "█" * (count // max(1, stats['total'] // 20)) if stats['total'] > 0 else ""
                msg += f"{star}⭐: {bar} {count}\n"
            msg += f"\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n"
            msg += f"💬 **ĐÁNH GIÁ GẦN ĐÂY:**\n\n"
            
            for idx, rating in enumerate(ratings[:5], 1):
                stars_display = "⭐" * rating.get("stars", 0)
                role_icon = "👑" if rating.get("role") == "Admin" else "👤"
                user_name = rating.get("user_name", "Người dùng")
                message = rating.get("message", "Không có nội dung")
                date = rating.get("date", "")
                msg += f"{idx}. {stars_display} {role_icon} **{user_name}**\n"
                msg += f"   💬 {message[:100]}{'...' if len(message) > 100 else ''}\n"
                msg += f"   📅 {date}\n\n"
            
            if len(ratings) > 5:
                msg += f"... và {len(ratings) - 5} đánh giá khác\n\n"
            
            markup = types.InlineKeyboardMarkup()
            markup.add(types.InlineKeyboardButton("🔄 Xem thêm", callback_data="view_ratings_more"))
            markup.add(types.InlineKeyboardButton("⭐ Đánh giá ngay", callback_data="start_rating"))
            
            bot.send_message(chat_id, msg, reply_markup=markup, parse_mode="Markdown")
            bot.answer_callback_query(call.id)
        
        elif call.data == "view_ratings_more":
            ratings = get_all_ratings(20)
            msg = "💬 **TẤT CẢ ĐÁNH GIÁ:**\n\n"
            for idx, rating in enumerate(ratings, 1):
                stars_display = "⭐" * rating.get("stars", 0)
                role_icon = "👑" if rating.get("role") == "Admin" else "👤"
                user_name = rating.get("user_name", "Người dùng")
                message = rating.get("message", "Không có nội dung")
                date = rating.get("date", "")
                msg += f"{idx}. {stars_display} {role_icon} **{user_name}**\n"
                msg += f"   💬 {message}\n"
                msg += f"   📅 {date}\n\n"
            
            bot.send_message(chat_id, msg, parse_mode="Markdown")
            bot.answer_callback_query(call.id)
        
        elif call.data == "show_referral":
            user_data = get_user_data(user_id)
            referral_code = user_data.get("referral_code")
            if not referral_code:
                referral_code = create_user_referral_code(user_id, call.from_user.first_name or "")
                user_data = get_user_data(user_id)
            
            referral_link = f"https://t.me/{bot.get_me().username}?start=ref_{referral_code}"
            used_referral = user_data.get("used_referral", False)
            referral_stats = user_data.get("referral_stats", {"total_referrals": 0, "total_earned": 0})
            referral_config = get_referral_config()
            
            msg = f"🎁 **MÃ GIỚI THIỆU CỦA BẠN**\n\n"
            msg += f"🔑 **Mã:** `{referral_code}`\n\n"
            msg += f"🔗 **Link giới thiệu:**\n`{referral_link}`\n\n"
            msg += f"💰 **Phần thưởng khi có người dùng mã:**\n"
            
            if referral_config.get("vip_days_referrer", 0) > 0:
                msg += f"👑 +{referral_config['vip_days_referrer']} ngày VIP\n"
            if referral_config.get("deposit_bonus_percent_referrer", 0) > 0:
                msg += f"💰 +{referral_config['deposit_bonus_percent_referrer']}% tiền nạp\n"
            
            if not referral_config.get("vip_days_referrer", 0) and not referral_config.get("deposit_bonus_percent_referrer", 0):
                msg += f"• Đang chờ Admin cấu hình quyền lợi\n"
            
            msg += f"\n📊 **Thống kê:**\n"
            msg += f"👥 Tổng người giới thiệu: {referral_stats.get('total_referrals', 0)}\n\n"
            
            if used_referral:
                referral_by = user_data.get("referral_by", "")
                referral_code_used = user_data.get("referral_code_used", "")
                msg += f"✅ Bạn đã sử dụng mã: `{referral_code_used}`\n"
                msg += f"👤 Từ user: `{referral_by}`\n\n"
            else:
                msg += f"💡 **Chưa sử dụng mã giới thiệu?**\n"
                msg += f"Nhập mã giới thiệu để nhận quyền lợi đặc biệt!\n\n"
            
            msg += f"📤 Chia sẻ link này để nhận thưởng!"
            
            markup = types.InlineKeyboardMarkup()
            markup.add(types.InlineKeyboardButton("📋 Sao chép Link", url=referral_link))
            if not used_referral:
                markup.add(types.InlineKeyboardButton("🎫 Nhập Mã Giới Thiệu", callback_data="enter_referral"))
            
            bot.send_message(chat_id, msg, reply_markup=markup, parse_mode="Markdown")
            bot.answer_callback_query(call.id)
        
        elif call.data == "enter_code":
            bot.send_message(chat_id, "🎫 **NHẬP MÃ KHUYẾN MÃI**\n\nVui lòng nhập mã khuyến mãi:", parse_mode="Markdown")
            temp_user_state[user_id] = {"mode": "enter_code", "step": "wait_code"}
            bot.answer_callback_query(call.id)
        
        elif call.data == "enter_referral":
            bot.send_message(chat_id, "🎁 **NHẬP MÃ GIỚI THIỆU**\n\nVui lòng nhập mã giới thiệu (Mã hoặc UID):", parse_mode="Markdown")
            temp_user_state[user_id] = {"mode": "enter_referral", "step": "wait_referral"}
            bot.answer_callback_query(call.id)
        
        elif call.data == "start_feedback_ai" or call.data == "feedback_reply":
            msg_intro = "🤖 **AI LỄ TÂN:**\nChào bạn! Bạn cần hỗ trợ vấn đề gì về hệ thống? Hãy mô tả chi tiết nhé!"
            if call.data == "feedback_reply":
                msg_intro = "🤖 **AI LỄ TÂN:**\nChào bạn! Bạn muốn phản hồi gì về thông báo này? Mình sẽ ghi nhận và gửi Admin."
            bot.send_message(chat_id, msg_intro)
            temp_user_state[user_id] = {"mode": "feedback_chat", "history": []}
            bot.answer_callback_query(call.id)

        elif call.data.startswith("admin_reply_"):
            t_uid = int(call.data.split("_")[2])
            bot.send_message(chat_id, f"✍️ Nhập nội dung trả lời cho UID `{t_uid}`:")
            temp_user_state[user_id] = {"mode": "admin_replying", "target_uid": t_uid}
            bot.answer_callback_query(call.id)

        elif call.data == "open_admin_panel":
            if user_id in ADMIN_IDS:
                show_admin_panel(chat_id, user_id)
            bot.answer_callback_query(call.id)

        elif call.data == "buy_vip":
            u = get_user_data(user_id)
            cfg = get_config()
            base_price = cfg.get("vip_price_30d", 30000)
            base_days = 30
            today_date = datetime.now().strftime('%Y-%m-%d')
            
            active_codes = get_user_active_codes(user_id)
            discount_code = active_codes.get("discount")
            bonus_days_code = active_codes.get("bonus_days")
            user_data = get_user_data(user_id)
            referral_vip_discount = user_data.get("referral_vip_discount", 0)
            
            final_price = base_price
            final_days = base_days
            discount_valid = False
            bonus_days_valid = False
            total_discount_percent = 0
            
            price_msg = f"💰 **THANH TOÁN VIP**\n\n"
            
            if discount_code:
                expiry_date = discount_code.get("expiry_date", "")
                min_amount = discount_code.get("min_amount", 0)
                
                if expiry_date and expiry_date < today_date:
                    user_data = get_user_data(user_id)
                    user_data["active_discount_code"] = None
                    data = load_json(FILES["users"])
                    data[str(user_id)] = user_data
                    save_json(FILES["users"], data)
                    discount_code = None
                elif min_amount > 0 and base_price < min_amount:
                    discount_valid = False
                else:
                    discount_valid = True
                    total_discount_percent += discount_code.get("value", 0)
            
            if referral_vip_discount > 0:
                total_discount_percent += referral_vip_discount
            
            if total_discount_percent > 0:
                base_decimal = Decimal(str(base_price))
                discount_decimal = base_decimal * Decimal(str(total_discount_percent)) / Decimal("100")
                final_price = int((base_decimal - discount_decimal).quantize(Decimal('1'), rounding=ROUND_HALF_UP))
                price_msg += f"💵 Giá gốc: {format_vnd(base_price)}\n"
                if discount_code and discount_valid:
                    price_msg += f"🎫 Mã giảm giá: `{discount_code.get('code_name')}` ({discount_code.get('value', 0)}%)\n"
                if referral_vip_discount > 0:
                    price_msg += f"🎁 Referral giảm: {referral_vip_discount}%\n"
                price_msg += f"✅ **Giá ưu đãi: {format_vnd(final_price)}**\n\n"
            else:
                price_msg += f"💵 Giá: {format_vnd(base_price)}\n\n"
            
            if bonus_days_code:
                expiry_date = bonus_days_code.get("expiry_date", "")
                if expiry_date and expiry_date < today_date:
                    user_data = get_user_data(user_id)
                    user_data["active_bonus_days_code"] = None
                    data = load_json(FILES["users"])
                    data[str(user_id)] = user_data
                    save_json(FILES["users"], data)
                    bonus_days_code = None
                else:
                    bonus_days_valid = True
                    bonus_days = bonus_days_code.get("value", 0)
                    final_days = base_days + bonus_days
                    price_msg += f"📅 Mua {base_days} ngày tặng thêm {bonus_days} ngày\n"
                    price_msg += f"✅ **Tổng: {final_days} ngày VIP**\n\n"
            
            if not bonus_days_code or not bonus_days_valid:
                price_msg += f"📅 Thời hạn: {base_days} ngày\n\n"
            
            price_msg += f"💳 Số dư hiện tại: {format_vnd(u['balance'])}\n"
            
            if u['balance'] >= final_price:
                markup = types.InlineKeyboardMarkup()
                markup.add(types.InlineKeyboardButton("✅ Xác nhận mua", callback_data=f"confirm_buy_vip_{final_price}_{final_days}"))
                markup.add(types.InlineKeyboardButton("❌ Hủy", callback_data="cancel_buy_vip"))
                bot.send_message(chat_id, price_msg, reply_markup=markup, parse_mode="Markdown")
            else:
                price_msg += f"❌ **Thiếu tiền. Cần thêm: {format_vnd(final_price - u['balance'])}**"
                bot.send_message(chat_id, price_msg, parse_mode="Markdown")
            bot.answer_callback_query(call.id)
        
        elif call.data.startswith("confirm_buy_vip_"):
            parts = call.data.split("_")
            final_price = int(parts[3])
            final_days = int(parts[4])
            
            u = get_user_data(user_id)
            if u['balance'] >= final_price:
                new_b = update_balance(user_id, -final_price)
                exp = set_vip(user_id, final_days)
                
                user_data = get_user_data(user_id)
                if user_data.get("active_discount_code"):
                    user_data["active_discount_code"] = None
                if user_data.get("active_bonus_days_code"):
                    user_data["active_bonus_days_code"] = None
                data = load_json(FILES["users"])
                data[str(user_id)] = user_data
                save_json(FILES["users"], data)
                
                bot.send_message(chat_id, f"🎉 **LÊN VIP THÀNH CÔNG!**\n\n📅 Hạn: {datetime.fromtimestamp(exp).strftime('%d/%m/%Y')}\n💵 Số dư còn lại: {format_vnd(new_b)}", parse_mode="Markdown")
            else:
                bot.send_message(chat_id, "❌ Số dư không đủ. Vui lòng nạp thêm tiền.")
            bot.answer_callback_query(call.id)
        
        elif call.data.startswith("approve_deposit_"):
            parts = call.data.split("_")
            uid = int(parts[2])
            base_amount = int(parts[3])
            total_amount = int(parts[4])
            bonus_amount = total_amount - base_amount
            
            user_data = get_user_data(uid)
            active_code_name = user_data.get("active_discount_code", None)
            code_info = None
            if active_code_name:
                code_info = get_code(active_code_name)
            
            new_bal = update_balance(uid, total_amount)
            log_user_history(uid, "deposit", total_amount, f"Admin cộng (Gốc: {base_amount}, Bonus: {bonus_amount})")
            
            admin_report = f"✅ **ĐÃ DUYỆT NẠP TIỀN**\n\n"
            admin_report += f"👤 User: `{uid}`\n"
            admin_report += f"💵 Nạp gốc: {format_vnd(base_amount)}\n"
            
            bonus_sources = []
            if active_code_name and code_info:
                bonus_sources.append(f"Mã {active_code_name}")
            
            user_data_check = get_user_data(uid)
            referral_config_check = get_referral_config()
            if user_data_check.get("used_referral") and referral_config_check.get("deposit_bonus_percent_new_user", 0) > 0:
                bonus_sources.append(f"Referral ({referral_config_check['deposit_bonus_percent_new_user']}%)")
            
            if bonus_sources:
                admin_report += f"🎫 Mã áp dụng: {', '.join(bonus_sources)}\n"
                validation_status = "✅ Đạt" if bonus_amount > 0 else "❌ Không đạt"
                admin_report += f"📋 Điều kiện đạt: {validation_status}\n"
                if active_code_name and code_info:
                    if code_info.get("min_amount", 0) > 0:
                        min_check = "✅" if base_amount >= code_info.get("min_amount", 0) else "❌"
                        admin_report += f"   • Tối thiểu {format_vnd(code_info.get('min_amount', 0))}: {min_check}\n"
                    if code_info.get("expiry_date"):
                        expiry_check = "✅" if code_info.get("expiry_date", "") >= datetime.now().strftime('%Y-%m-%d') else "❌"
                        admin_report += f"   • Hạn dùng {code_info.get('expiry_date', '')}: {expiry_check}\n"
                admin_report += f"🎁 Thưởng thêm: {format_vnd(bonus_amount)}\n"
            else:
                admin_report += f"🎫 Mã áp dụng: Không có\n"
                admin_report += f"📋 Điều kiện đạt: N/A\n"
            
            admin_report += f"✅ **Số tiền cuối: {format_vnd(total_amount)}**\n"
            admin_report += f"💵 Số dư: {format_vnd(new_bal)}"
            
            if user_data.get("active_discount_code"):
                user_data["active_discount_code"] = None
                data = load_json(FILES["users"])
                data[str(uid)] = user_data
                save_json(FILES["users"], data)
            
            bot.send_message(chat_id, admin_report, parse_mode="Markdown")
            try: 
                bot.send_message(uid, f"✅ **NẠP TIỀN THÀNH CÔNG!**\n\n💰 Nạp gốc: {format_vnd(base_amount)}\n🎁 Thưởng thêm: {format_vnd(bonus_amount)}\n💵 **Tổng nhận: {format_vnd(total_amount)}**\n\n💳 Số dư: {format_vnd(new_bal)}", parse_mode="Markdown")
            except: pass
            bot.answer_callback_query(call.id)
        
        elif call.data.startswith("cancel_deposit_"):
            parts = call.data.split("_")
            uid = int(parts[2])
            bot.send_message(chat_id, f"❌ Đã hủy yêu cầu nạp tiền cho `{uid}`.", parse_mode="Markdown")
            bot.answer_callback_query(call.id)
        
        elif call.data == "cancel_buy_vip":
            bot.send_message(chat_id, "❌ Đã hủy giao dịch mua VIP.")
            bot.answer_callback_query(call.id)
            
        elif call.data == "info_account":
            u = get_user_data(user_id)
            is_vip, vip_info = check_vip(user_id)
            stats = u.get("stats", {"done": 0, "cancel": 0, "tracking": 0, "money_generated": 0})
            level = u.get("level", 1)
            level_text = "👑 VIP" if level == 2 else "👤 Thường"
            
            vip_status = f"✅ {vip_info}" if is_vip else f"❌ {vip_info}"
            if is_vip and u.get("vip_expiry", 0) > 0:
                expiry_dt = datetime.fromtimestamp(u["vip_expiry"])
                vip_status = f"✅ {vip_info}\n📅 Hết hạn: {expiry_dt.strftime('%d/%m/%Y %H:%M:%S')}"
            
            history = get_user_history(user_id)
            recent_history = history[-5:] if len(history) > 5 else history
            history_text = ""
            if recent_history:
                history_text = "\n\n📜 **LỊCH SỬ GẦN ĐÂY:**\n"
                for h in reversed(recent_history):
                    h_time = datetime.fromtimestamp(h["time"]).strftime('%d/%m/%Y %H:%M')
                    h_type = h["type"]
                    h_amount = format_vnd(h["amount"]) if h["amount"] > 0 else ""
                    h_detail = h.get("detail", "")
                    history_text += f"• {h_time} - {h_type} {h_amount} {h_detail}\n"
            
            msg = f"""👤 **THÔNG TIN TÀI KHOẢN**

🆔 **UID:** `{user_id}`
💰 **Số dư:** {format_vnd(u['balance'])}
{level_text}

👑 **VIP:**
{vip_status}

📊 **THỐNG KÊ:**
✅ Done: {stats['done']}
❌ Cancel: {stats['cancel']}
👀 Đang theo dõi: {stats['tracking']}
💵 Tổng tiền: {format_vnd(stats['money_generated'])}
{history_text}"""
            bot.send_message(chat_id, msg, parse_mode="Markdown")
            bot.answer_callback_query(call.id)

        elif call.data == "stats":
            u = get_user_data(user_id)
            stats = u.get("stats", {"done": 0, "cancel": 0, "tracking": 0, "money_generated": 0})
            msg = f"📊 **THỐNG KÊ**\n\n✅ Done: {stats['done']}\n❌ Cancel: {stats['cancel']}\n👀 Đang theo dõi: {stats['tracking']}\n💰 Tổng tiền: {format_vnd(stats['money_generated'])}"
            bot.send_message(chat_id, msg, parse_mode="Markdown")
            bot.answer_callback_query(call.id)

        elif call.data == "admin_view_queue":
            if user_id not in ADMIN_IDS: return
            if not support_queue: return bot.answer_callback_query(call.id, "📭 Không có yêu cầu hỗ trợ nào trong hàng chờ.")
            msg = "📋 **DANH SÁCH HÀNG CHỜ HỖ TRỢ:**\n\n"
            markup = types.InlineKeyboardMarkup()
            for w_uid, w_name in support_queue.items():
                msg += f"👤 **{w_name}**\n🆔 ID: `{w_uid}`\n\n"
                markup.add(types.InlineKeyboardButton(f"💬 Kết nối với {w_name}", callback_data=f"connect_{w_uid}"))
            bot.send_message(chat_id, msg, reply_markup=markup, parse_mode="Markdown")
            bot.answer_callback_query(call.id)

        elif call.data.startswith("connect_"):
            if user_id not in ADMIN_IDS: return
            t_uid = int(call.data.split("_")[1])
            if user_id in active_chats: return bot.send_message(chat_id, "❌ Chuyên viên đang trong một hội thoại hỗ trợ khác. Vui lòng kết thúc hội thoại hiện tại trước.")
            if t_uid in support_queue:
                del support_queue[t_uid]
                active_chats[user_id] = t_uid; active_chats[t_uid] = user_id
                markup_end = types.InlineKeyboardMarkup()
                markup_end.add(types.InlineKeyboardButton("🔚 Kết thúc hội thoại hỗ trợ", callback_data="end_chat"))
                bot.send_message(chat_id, f"✅ Đã kết nối với Quý khách (ID: {t_uid}). Hội thoại hỗ trợ đã được thiết lập.", reply_markup=markup_end)
                try: 
                    bot.send_message(t_uid, "👨‍💼 **Chuyên viên đã tham gia hội thoại hỗ trợ**\n\nXin chào Quý khách! Chuyên viên sẵn sàng hỗ trợ bạn. Vui lòng mô tả vấn đề bạn đang gặp phải.", reply_markup=markup_end)
                except: pass
                bot.delete_message(chat_id, call.message.message_id)
            else: bot.answer_callback_query(call.id, "Quý khách đã rời khỏi hàng chờ.")

        elif call.data == "admin_stats_full":
            if user_id not in ADMIN_IDS: return
            s = get_admin_revenue_stats()
            bot.send_message(chat_id, f"📊 **DOANH THU**\n💵 Hôm nay: {format_vnd(s['today'])}\n💰 Tổng: {format_vnd(s['total'])}", parse_mode="Markdown")
            bot.answer_callback_query(call.id)

        elif call.data == "admin_add_guide":
            bot.send_message(chat_id, "ℹ️ LỆNH ADMIN:\n`/addmoney <UID> <TIỀN>`\n`/setprice <TIỀN>`\n`/setbank <INFO>`\n`/tangvip <UID> <NGÀY>`", parse_mode="Markdown")
            bot.answer_callback_query(call.id)

        elif call.data == "admin_manage_users":
            if user_id not in ADMIN_IDS: return
            all_users = get_all_users_list()
            if not all_users:
                bot.send_message(chat_id, "📭 Chưa có user nào.")
                bot.answer_callback_query(call.id)
                return
            msg = f"👥 **DANH SÁCH USER**\n\nTổng: {len(all_users)} user\n\n"
            users_data = load_json(FILES["users"])
            for idx, uid in enumerate(all_users[:20], 1):
                try:
                    u = users_data.get(str(uid), {})
                    balance = u.get("balance", 0)
                    is_vip = u.get("vip_active", False)
                    vip_icon = "👑" if is_vip else "👤"
                    try:
                        chat_member = bot.get_chat_member(uid, uid)
                        user_info = chat_member.user
                        first_name = user_info.first_name or ""
                        last_name = user_info.last_name or ""
                        username = f"@{user_info.username}" if user_info.username else "No Username"
                        full_name = f"{first_name} {last_name}".strip() or "Unknown"
                    except:
                        full_name = "Unknown"
                        username = "No Username"
                    msg += f"{idx}. {vip_icon} **{full_name}**\n"
                    msg += f"   🆔 `{uid}` | 🔗 {username}\n"
                    msg += f"   💰 {format_vnd(balance)}\n\n"
                except: pass
            if len(all_users) > 20:
                msg += f"... và {len(all_users) - 20} user khác\n\n"
            msg += "👇 Chọn user để quản lý:"
            markup = types.InlineKeyboardMarkup(row_width=2)
            for uid in all_users[:20]:
                try:
                    u = users_data.get(str(uid), {})
                    is_vip = u.get("vip_active", False)
                    vip_icon = "👑" if is_vip else "👤"
                    try:
                        chat_member = bot.get_chat_member(uid, uid)
                        user_info = chat_member.user
                        first_name = user_info.first_name or "User"
                    except:
                        first_name = "User"
                    markup.add(types.InlineKeyboardButton(f"{vip_icon} {first_name}", callback_data=f"admin_view_user_{uid}"))
                except: pass
            if len(all_users) > 20:
                markup.add(types.InlineKeyboardButton("📄 Xem thêm...", callback_data="admin_users_page_2"))
            bot.send_message(chat_id, msg, reply_markup=markup, parse_mode="Markdown")
            bot.answer_callback_query(call.id)

        elif call.data.startswith("admin_view_user_"):
            if user_id not in ADMIN_IDS: return
            target_uid = int(call.data.split("_")[3])
            try:
                chat_member = bot.get_chat_member(target_uid, target_uid)
                user_info = chat_member.user
                first_name = user_info.first_name or "Unknown"
                last_name = user_info.last_name or ""
                username = f"@{user_info.username}" if user_info.username else "No Username"
                full_name = f"{first_name} {last_name}".strip() or "Unknown"
                is_bot = user_info.is_bot
                bot_text = "🤖 Bot" if is_bot else "👤 User"
            except:
                full_name = "Unknown"
                username = "No Username"
                bot_text = "👤 User"
            
            u = get_user_data(target_uid)
            is_vip, vip_info = check_vip(target_uid)
            stats = u.get("stats", {"done": 0, "cancel": 0, "tracking": 0, "money_generated": 0})
            level = u.get("level", 1)
            level_text = "👑 VIP" if level == 2 else "👤 Thường"
            
            vip_status = f"✅ {vip_info}" if is_vip else f"❌ {vip_info}"
            if is_vip and u.get("vip_expiry", 0) > 0:
                expiry_dt = datetime.fromtimestamp(u["vip_expiry"])
                vip_status = f"✅ {vip_info}\n📅 Hết hạn: {expiry_dt.strftime('%d/%m/%Y %H:%M:%S')}"
            
            msg = f"""👤 **THÔNG TIN USER ĐẦY ĐỦ**

👤 **Tên:** {full_name}
🆔 **UID:** `{target_uid}`
🔗 **Username:** {username}
{bot_text}

💰 **Số dư:** {format_vnd(u['balance'])}
{level_text}

👑 **VIP:**
{vip_status}

📊 **THỐNG KÊ:**
✅ Done: {stats['done']}
❌ Cancel: {stats['cancel']}
👀 Đang theo dõi: {stats['tracking']}
💵 Tổng tiền: {format_vnd(stats['money_generated'])}"""
            markup = types.InlineKeyboardMarkup(row_width=2)
            markup.add(
                types.InlineKeyboardButton("💰 Cộng tiền", callback_data=f"admin_add_money_{target_uid}"),
                types.InlineKeyboardButton("👑 Tặng VIP", callback_data=f"admin_give_vip_{target_uid}"),
                types.InlineKeyboardButton("⛔ Xóa VIP", callback_data=f"admin_remove_vip_{target_uid}"),
                types.InlineKeyboardButton("🔙 Quay lại", callback_data="admin_manage_users")
            )
            bot.send_message(chat_id, msg, reply_markup=markup, parse_mode="Markdown")
            bot.answer_callback_query(call.id)

        elif call.data.startswith("admin_add_money_"):
            if user_id not in ADMIN_IDS: return
            target_uid = int(call.data.split("_")[3])
            bot.send_message(chat_id, f"💰 Nhập số tiền cộng cho `{target_uid}`:\n\nDùng: `/addmoney {target_uid} <SỐ_TIỀN>`", parse_mode="Markdown")
            bot.answer_callback_query(call.id)

        elif call.data.startswith("admin_give_vip_"):
            if user_id not in ADMIN_IDS: return
            target_uid = int(call.data.split("_")[3])
            bot.send_message(chat_id, f"👑 Nhập số ngày VIP cho `{target_uid}`:\n\nDùng: `/tangvip {target_uid} <SỐ_NGÀY>`", parse_mode="Markdown")
            bot.answer_callback_query(call.id)

        elif call.data.startswith("admin_remove_vip_"):
            if user_id not in ADMIN_IDS: return
            target_uid = int(call.data.split("_")[3])
            set_vip(target_uid, 0)
            bot.send_message(chat_id, f"⛔ Đã xóa VIP cho `{target_uid}`.", parse_mode="Markdown")
            try: bot.send_message(target_uid, "⚠️ VIP bị thu hồi bởi Admin.")
            except: pass
            bot.answer_callback_query(call.id)

        elif call.data == "close_panel":
            bot.delete_message(chat_id, call.message.message_id)

        elif call.data == "deposit":
            cfg = get_config()
            bank_txt = cfg.get("bank_info", "Liên hệ Admin")
            msg = f"💰 **NẠP TIỀN**\n🏦 {bank_txt}\n📝 ND: `Buy {user_id}`\n\n📸 Gõ `/naptien <SỐ TIỀN>` để báo Admin."
            bot.send_message(chat_id, msg, parse_mode="Markdown")
            bot.answer_callback_query(call.id)

        elif call.data == "add_uid":
            is_vip, _ = check_vip(user_id)
            if not is_vip: return bot.send_message(chat_id, "🔒 Cần VIP.")
            bot.send_message(chat_id, "📝 **THÊM UID THƯỜNG**\nNhập UID hoặc Link FB:", parse_mode="Markdown")
            temp_user_state[user_id] = {"mode": "normal", "step": "wait_uid"}
            bot.answer_callback_query(call.id)

        elif call.data == "add_meta":
            is_vip, _ = check_vip(user_id)
            if not is_vip: return bot.send_message(chat_id, "🔒 Cần VIP.")
            bot.send_message(chat_id, "🌟 **CHECK META VERIFIED**\nNhập UID cần Acc Tick xanh hoặc acc chuẩn bị lên Tích Xanh:", parse_mode="Markdown")
            temp_user_state[user_id] = {"mode": "meta", "step": "wait_uid"}
            bot.answer_callback_query(call.id)

        elif call.data == "list_uid":
            d = get_tracking(); u = d.get(str(chat_id), {})
            msg = "📋 **DANH SÁCH**\n"
            for k, v in u.items():
                if v['status']!='done':
                    if v.get("track_type") == "meta": status_icon = "💎 TREO TÍCH"
                    else: status_icon = "🟢 LIVE" if v['last_check']=='LIVE' else "🔴 DIE"
                    tick_icon = " ☑️ META VERIFIED" if v.get("is_verified") else ""
                    msg += f"{status_icon} `{k}`{tick_icon} | {v['name']}\n"
            bot.send_message(chat_id, msg, parse_mode="Markdown")
            bot.answer_callback_query(call.id)

        elif call.data.startswith("done_"):
            uid = call.data.split("_")[1]
            if mark_done_uid(chat_id, uid):
                d = get_tracking(); p = d.get(str(chat_id), {}).get(uid, {}).get('price', 0)
                update_user_stats(user_id, "done", p)
                bot.edit_message_text(f"✅ **LỤM LÚA!**\nUID `{uid}` done.", chat_id, call.message.message_id, parse_mode="Markdown")
                bot.answer_callback_query(call.id, "✅ Đã đánh dấu done!")

        elif call.data.startswith("del_"):
            uid = call.data.split("_")[1]
            if remove_tracking_uid(chat_id, uid):
                update_user_stats(user_id, "cancel")
                bot.delete_message(chat_id, call.message.message_id)
                bot.answer_callback_query(call.id, "✅ Đã xóa!")

        elif call.data.startswith("keep_"): bot.answer_callback_query(call.id, "Ok")
        elif call.data == "end_chat":
            if user_id in active_chats:
                partner_id = active_chats[user_id]
                del active_chats[user_id]
                if partner_id in active_chats:
                    del active_chats[partner_id]
                if user_id in ADMIN_IDS:
                    bot.send_message(chat_id, "✅ Đã kết thúc hội thoại hỗ trợ với Quý khách.")
                    try: bot.send_message(partner_id, "👋 Chuyên viên đã kết thúc hội thoại hỗ trợ. Cảm ơn Quý khách đã sử dụng dịch vụ!")
                    except: pass
                else:
                    bot.send_message(chat_id, "✅ Đã kết thúc hội thoại hỗ trợ. Cảm ơn Quý khách đã sử dụng dịch vụ!")
                    try: bot.send_message(partner_id, "👋 Quý khách đã kết thúc hội thoại hỗ trợ.")
                    except: pass
            else:
                bot.answer_callback_query(call.id, "❌ Không đang trong hội thoại hỗ trợ.")
        elif call.data == "help": bot.send_message(chat_id, "ℹ️ Nạp -> Mua VIP -> Thêm UID."); bot.answer_callback_query(call.id)
    except: pass

@bot.message_handler(content_types=['text', 'photo'])
def handle_text(message):
    if message.from_user.is_bot: return
    user_id = message.from_user.id
    chat_id = message.chat.id
    
    if user_id in active_chats:
        pid = active_chats[user_id]
        try:
            markup_end = types.InlineKeyboardMarkup()
            markup_end.add(types.InlineKeyboardButton("🔚 Kết thúc hội thoại hỗ trợ", callback_data="end_chat"))
            if message.content_type == 'text': 
                if user_id in ADMIN_IDS:
                    bot.send_message(pid, f"💬 **Chuyên viên:** {message.text}", reply_markup=markup_end)
                else:
                    bot.send_message(pid, f"💬 **Quý khách:** {message.text}", reply_markup=markup_end)
            elif message.content_type == 'photo': 
                caption_prefix = "**Chuyên viên:** " if user_id in ADMIN_IDS else "**Quý khách:** "
                bot.send_photo(pid, message.photo[-1].file_id, caption=(caption_prefix + (message.caption or "")), reply_markup=markup_end)
        except: bot.reply_to(message, "❌ Hệ thống gặp lỗi khi gửi tin nhắn. Vui lòng thử lại.")
        return

    st = temp_user_state.get(user_id)
    
    if user_id in ADMIN_IDS and isinstance(st, dict) and st.get("mode") == "admin_replying":
        target = st["target_uid"]
        try:
            bot.send_message(target, f"💌 **PHẢN HỒI TỪ ADMIN:**\n\n{message.text}")
            bot.reply_to(message, f"✅ Đã gửi cho UID `{target}`.")
        except: bot.reply_to(message, "❌ Không gửi được (Khách chặn bot?).")
        temp_user_state.pop(user_id, None)
        return

    if isinstance(st, dict) and st.get("mode") == "rating":
        if st.get("step") == "wait_message":
            stars = st.get("stars", 0)
            role = st.get("role", "User")
            user_name = st.get("user_name", "Quý khách")
            message_text = message.text.strip()
            
            if not message_text or len(message_text) < 3:
                bot.reply_to(message, "⚠️ Vui lòng nhập nội dung đánh giá ít nhất 3 ký tự.")
                return
            
            bot.send_chat_action(chat_id, 'typing')
            processing_msg = bot.reply_to(message, "⏳ Hệ thống đang xử lý đánh giá của Quý khách...")
            
            rating_entry = save_rating(user_id, user_name, role, stars, message_text)
            
            ai_analysis = analyze_rating_with_ai(stars, message_text)
            
            stars_display = "⭐" * stars
            role_icon = "👑" if role == "Admin" else "👤"
            
            public_msg = f"⭐ **ĐÁNH GIÁ MỚI**\n\n"
            public_msg += f"{stars_display} {role_icon} **{user_name}**\n"
            public_msg += f"💬 {message_text}\n"
            public_msg += f"📅 {rating_entry['date']}\n"
            public_msg += f"\n━━━━━━━━━━━━━━━━━━━━━━━━━━"
            
            if ai_analysis:
                sentiment_emoji = {
                    "praise": "🙏",
                    "suggestion": "💡",
                    "complaint": "😔",
                    "bug_report": "🐛"
                }.get(ai_analysis.get("sentiment", "suggestion"), "💬")
                
                public_msg += f"\n\n{sentiment_emoji} **AI Phân tích:**\n"
                public_msg += f"📝 {ai_analysis.get('summary', 'Đánh giá từ người dùng')}\n"
                public_msg += f"💬 {ai_analysis.get('response', 'Cảm ơn Quý khách đã đánh giá.')}"
            
            all_users = get_all_users_list()
            sent_count = 0
            for uid in all_users:
                try:
                    bot.send_message(uid, public_msg, parse_mode="Markdown")
                    sent_count += 1
                    time.sleep(0.03)
                except: pass
            
            user_response = f"✅ **CẢM ƠN QUÝ KHÁCH!**\n\n"
            user_response += f"Đánh giá {stars} sao của Quý khách đã được ghi nhận và công khai.\n\n"
            
            if ai_analysis:
                user_response += f"💬 **Phản hồi từ hệ thống:**\n{ai_analysis.get('response', 'Cảm ơn Quý khách đã dành thời gian đánh giá dịch vụ.')}"
            else:
                user_response += f"💬 Chúng tôi rất trân trọng ý kiến của Quý khách và sẽ không ngừng cải thiện chất lượng phục vụ."
            
            try:
                bot.delete_message(chat_id, processing_msg.message_id)
            except: pass
            
            bot.reply_to(message, user_response, parse_mode="Markdown")
            temp_user_state.pop(user_id, None)
            
            stats = get_rating_stats()
            admin_notification = f"📊 **ĐÁNH GIÁ MỚI**\n\n"
            admin_notification += f"{stars_display} {role_icon} {user_name} (ID: `{user_id}`)\n"
            admin_notification += f"💬 {message_text}\n\n"
            admin_notification += f"📈 **Thống kê hiện tại:**\n"
            admin_notification += f"⭐ Điểm TB: {stats['average']}/5.0\n"
            admin_notification += f"📊 Tổng: {stats['total']} đánh giá\n"
            admin_notification += f"📤 Đã gửi công khai cho {sent_count} người dùng"
            
            if ai_analysis:
                admin_notification += f"\n\n🤖 **AI Phân tích:**\n"
                admin_notification += f"🎯 Sắc thái: {ai_analysis.get('sentiment', 'unknown')}\n"
                admin_notification += f"📝 Tóm tắt: {ai_analysis.get('summary', 'N/A')}"
            
            for admin_id in ADMIN_IDS:
                try:
                    bot.send_message(admin_id, admin_notification, parse_mode="Markdown")
                except: pass
            
            return
    
    if isinstance(st, dict) and st.get("mode") == "enter_code":
        if st.get("step") == "wait_code":
            code_name = message.text.strip().upper()
            result = use_code(user_id, code_name, check_amount=0)
            
            if result.get("success"):
                code_info = result.get("code_info", {})
                expiry_date = code_info.get("expiry_date", "")
                min_amount = code_info.get("min_amount", 0)
                
                msg = result.get("message", "")
                if expiry_date:
                    msg += f"\n📅 Hạn dùng: {expiry_date}"
                if min_amount > 0:
                    msg += f"\n💰 Tối thiểu: {format_vnd(min_amount)}"
                
                bot.reply_to(message, msg, parse_mode="Markdown")
                
                if result.get("type") == "VIP":
                    bot.send_message(chat_id, f"🎉 Chúc mừng! Bạn đã nhận {result.get('value', 0)} ngày VIP miễn phí!", parse_mode="Markdown")
                elif result.get("type") == "MONEY":
                    new_balance = get_user_data(user_id)["balance"]
                    bot.send_message(chat_id, f"💰 Số dư hiện tại: {format_vnd(new_balance)}", parse_mode="Markdown")
            else:
                bot.reply_to(message, result.get('message', '❌ Mã không hợp lệ.'))
            
            temp_user_state.pop(user_id, None)
            return
    
    if isinstance(st, dict) and st.get("mode") == "enter_referral":
        if st.get("step") == "wait_referral":
            referral_input = message.text.strip()
            result = use_referral_code(user_id, referral_input)
            
            if result.get("success"):
                bot.reply_to(message, result.get("message", ""), parse_mode="Markdown")
                user_data = get_user_data(user_id)
                if user_data.get("referral_vip_discount", 0) > 0:
                    bot.send_message(chat_id, f"🎫 Bạn cũng được giảm {user_data['referral_vip_discount']}% khi mua VIP!", parse_mode="Markdown")
            else:
                bot.reply_to(message, result.get('message', '❌ Mã giới thiệu không hợp lệ.'))
            
            temp_user_state.pop(user_id, None)
            return
    
    if isinstance(st, dict) and st.get("mode") == "deposit":
        if st.get("step") == "wait_amount":
            if not message.text: return
            try:
                amt_text = message.text.strip().replace(".", "").replace(",", "").replace(" ", "")
                if not amt_text.isdigit(): return bot.reply_to(message, "❌ Số tiền không hợp lệ.")
                amt = int(amt_text)
                if amt <= 0: return bot.reply_to(message, "❌ Số tiền phải > 0.")
                
                qr_url = f"https://qr.sepay.vn/img?acc=0398085063&bank=ICB&amount={amt}&des={user_id}&template=compact&download=false"
                form_msg = f"▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬\n🔥 HỆ THỐNG NẠP TIỀN NHANH 🔥\n▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬\n\n🏦 NGÂN HÀNG: VIETINBANK\n💳 STK: 0398085063\n👤 CHỦ TK: PHAM XUAN TIEN\n💰 SỐ TIỀN: {format_vnd(amt)} VNĐ\n\n📌 NỘI DUNG CK: 👉 {user_id} 👈\n\n👉 QUÉT MÃ QR HOẶC CK THEO THÔNG TIN TRÊN\n📝 Gửi bill tại đây để Admin duyệt.\n▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬"
                bot.send_photo(chat_id, qr_url, caption=form_msg)
                st["step"] = "wait_bill"
                st["amount"] = amt
            except: bot.reply_to(message, "❌ Số tiền lỗi.")
        elif st.get("step") == "wait_bill":
            if message.photo:
                amt = st.get("amount", 0)
                bonus_info = calculate_bonus_with_ai(amt, user_id)
                base_amount = bonus_info.get("base_amount", amt)
                total_amount = bonus_info.get("total_amount", amt)
                bonus_amount = bonus_info.get("bonus_amount", 0)
                
                markup = types.InlineKeyboardMarkup()
                if bonus_info.get("has_bonus"):
                    bonus_sources = bonus_info.get("bonus_sources", [])
                    bonus_text = "\n".join([f"🎁 {s}" for s in bonus_sources])
                    admin_msg = f"💰 **YÊU CẦU NẠP TIỀN**\n\n"
                    admin_msg += f"🆔 UID: `{user_id}`\n"
                    admin_msg += f"💰 Số tiền gốc: {format_vnd(base_amount)}\n"
                    admin_msg += f"{bonus_text}\n"
                    admin_msg += f"💵 **Tổng nhận: {format_vnd(total_amount)}**"
                    markup.add(types.InlineKeyboardButton("✅ Duyệt", callback_data=f"approve_deposit_{user_id}_{base_amount}_{total_amount}"))
                    markup.add(types.InlineKeyboardButton("❌ Hủy", callback_data=f"cancel_deposit_{user_id}"))
                else:
                    admin_msg = f"💰 **YÊU CẦU NẠP TIỀN**\n\n"
                    admin_msg += f"🆔 UID: `{user_id}`\n"
                    admin_msg += f"💰 Số tiền: {format_vnd(amt)}\n"
                    admin_msg += f"💡 Mã đã bị xóa khỏi tài khoản. Nạp tiền bình thường:"
                    markup.add(types.InlineKeyboardButton("✅ Nạp không mã", callback_data=f"approve_deposit_{user_id}_{amt}_{amt}"))
                    markup.add(types.InlineKeyboardButton("❌ Hủy", callback_data=f"cancel_deposit_{user_id}"))
                
                for admin in ADMIN_IDS:
                    try: bot.send_photo(admin, message.photo[-1].file_id, caption=admin_msg, reply_markup=markup, parse_mode="Markdown")
                    except: pass
                bot.reply_to(message, "✅ Đã gửi bill. Chờ Admin duyệt.")
                temp_user_state.pop(user_id, None)
            else:
                bot.reply_to(message, "❌ Vui lòng gửi ảnh bill.")
        return

    if isinstance(st, dict) and st.get("mode") == "feedback_chat":
        call_feedback_ai(message) 
        return

    if isinstance(st, dict) and st.get("step") == "wait_ai_topic":
        if user_id not in ADMIN_IDS: return
        topic = message.text
        threading.Thread(target=ai_create_broadcast, args=(user_id, topic)).start()
        temp_user_state.pop(user_id, None); return

    if isinstance(st, dict) and st.get("step") == "wait_uid":
        txt = message.text.strip(); uid = txt; name_from_link = None
        if not uid.isdigit():
            bot.reply_to(message, "🔍 Check link...")
            uid, name_from_link = get_uid_from_link(txt)
            if not uid: return bot.reply_to(message, "❌ Link lỗi.")
            if name_from_link: st["name"] = name_from_link
        
        if st.get("mode") == "meta":
            is_verified = check_tick_xanh(uid)
            name_to_save = name_from_link if name_from_link else "Săn Meta Verified"
            save_tracking_uid(chat_id, uid, name_to_save, "Auto Meta Check", 0, track_type="meta", is_verified=is_verified)
            update_user_stats(user_id, "add")
            status_text = "☑️ Đã có Meta Verified" if is_verified else "❌ Chưa có"
            msg = f"✅ **ĐÃ LƯU UID!**\nUID: `{uid}`\nTrạng thái: {status_text}\n\n(Bot đang treo theo dõi...)"
            markup = types.InlineKeyboardMarkup()
            markup.add(types.InlineKeyboardButton("❌ Hủy Theo Dõi", callback_data=f"del_{uid}"))
            bot.reply_to(message, msg, reply_markup=markup, parse_mode="Markdown")
            temp_user_state.pop(user_id, None); return
        else:
            st["uid"] = uid; st["step"] = "note"
            bot.reply_to(message, "📝 Vui lòng nhập Ghi chú:")
            return

    elif isinstance(st, dict):
        step = st.get("step")
        if step == "note":
            st["note"] = message.text; st["step"] = "price"
            bot.reply_to(message, "💰 Nhập GIÁ (Số):")
        elif step == "price":
            try: p = int(message.text.replace(".", ""))
            except: return bot.reply_to(message, "❌ Phải là số.")
            
            checking_msg = bot.reply_to(message, "⏳ Đang kiểm tra UID...")
            
            stat = check_uid_live_die(st["uid"])
            is_verified = False
            if stat == "LIVE":
                is_verified = check_tick_xanh(st["uid"])
            
            initial_status = stat
            
            def update_profile_async():
                try:
                    profile = fb_extractor.get_profile(st["uid"])
                    if "error" in profile:
                        return
                    
                    profile_name = profile.get("name", "")
                    profile_avatar = profile.get("profile_picture_url", "")
                    
                    if profile_name == "Name not found":
                        profile_name = ""
                    if profile_avatar == "Profile picture URL not found":
                        profile_avatar = ""
                    
                    if profile_name:
                        if "name" not in st or not st.get("name") or st.get("name") == "Facebook User" or st.get("name") == "Name not found" or st.get("name") == f"UID {st['uid']}":
                            st["name"] = profile_name
                    
                    if profile_avatar:
                        st["avatar"] = profile_avatar
                    
                    tracking_data = load_json(FILES["tracking"])
                    if str(chat_id) in tracking_data and str(st["uid"]) in tracking_data[str(chat_id)]:
                        if profile_name:
                            tracking_data[str(chat_id)][str(st["uid"])]["name"] = profile_name
                            save_json(FILES["tracking"], tracking_data)
                except: pass
            
            threading.Thread(target=update_profile_async, daemon=True).start()
            
            if "name" not in st or not st.get("name") or st.get("name") == "Facebook User":
                st["name"] = f"UID {st['uid']}"
            
            status_icon = "LIVE ✅" if initial_status == "LIVE" else "DIE ❌"
            if initial_status == "LIVE":
                progress_text = "🟢 Đang theo dõi trạng thái"
            else:
                progress_text = "🟢 Đang theo dõi chờ LIVE ✅"
            
            time_str = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            name_emoji = "👤"
            
            if initial_status == "LIVE":
                msg = f"✅ **ĐÃ LƯU UID THÀNH CÔNG**\n\nUID: `{st['uid']}` - {status_icon}\n\n{name_emoji} **Tên:** {st['name']}\n📝 **Ghi chú:** {st['note']}\n💵 **Giá:** {format_vnd(p)}\n🔄 **Tiến trình:** {progress_text}\n⏰ **Thời gian:** {time_str}"
            else:
                msg = f"✅ **ĐÃ LƯU UID**\n\nUID: `{st['uid']}` - {status_icon}\n\n{name_emoji} **Tên:** {st['name']}\n📝 **Ghi chú:** {st['note']}\n💵 **Giá:** {format_vnd(p)}\n🔄 **Tiến trình:** {progress_text}\n⏰ **Thời gian:** {time_str}"
            
            save_tracking_uid(chat_id, st["uid"], st["name"], st["note"], p, track_type="normal", is_verified=is_verified, initial_status=initial_status)
            update_user_stats(user_id, "add")
            
            markup = types.InlineKeyboardMarkup()
            markup.add(types.InlineKeyboardButton("✅ Done", callback_data=f"done_{st['uid']}"), types.InlineKeyboardButton("❌ Hủy", callback_data=f"del_{st['uid']}"))
            markup.add(types.InlineKeyboardButton("🔄 Tiếp tục", callback_data=f"keep_{st['uid']}"))
            try:
                bot.delete_message(chat_id, checking_msg.message_id)
            except: pass
            
            bot.send_message(chat_id, msg, reply_markup=markup, parse_mode="Markdown")
            temp_user_state.pop(user_id, None)
        return

    text = message.text if message.text else ""
    if text:
        uid_check, _ = get_uid_from_link(text) if not text.isdigit() else (None, None)
        if text.isdigit() or uid_check:
            bot.reply_to(message, "⚠️ Vui lòng chọn 'Thêm UID' trong menu để thêm vào danh sách theo dõi.")
            return

    call_deepseek_ai(user_id, message.chat.id, message.text)

def notify_bot_start():
    try:
        now = datetime.now().strftime('%d/%m/%Y %H:%M:%S')
        msg = f"🤖 **BOT ĐÃ KHỞI ĐỘNG**\n\n⏰ Thời gian: {now}\n✅ Trạng thái: Hoạt động bình thường\n🔄 Đang theo dõi UID...\n\n— Hệ thống tự động"
        all_users = get_all_users_list()
        for user_id in all_users:
            try:
                bot.send_message(user_id, msg, parse_mode="Markdown")
                time.sleep(0.05)
            except: pass
    except: pass

def notify_bot_stop():
    try:
        now = datetime.now().strftime('%d/%m/%Y %H:%M:%S')
        msg = f"⚠️ **BOT ĐÃ TẮT**\n\n⏰ Thời gian: {now}\n❌ Trạng thái: Đã dừng hoạt động\n\n— Hệ thống tự động"
        all_users = get_all_users_list()
        for user_id in all_users:
            try:
                bot.send_message(user_id, msg, parse_mode="Markdown")
                time.sleep(0.05)
            except: pass
    except: pass

def signal_handler(signum, frame):
    notify_bot_stop()
    sys.exit(0)

if __name__ == "__main__":
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    atexit.register(notify_bot_stop)
    t = threading.Thread(target=auto_check_thread); t.daemon = True; t.start()
    print("Bot đang chạy...")
    threading.Thread(target=notify_bot_start).start()
    time.sleep(2)
    try:
        bot.infinity_polling()
    except KeyboardInterrupt:
        notify_bot_stop()
    except Exception as e:
        notify_bot_stop()
        raise