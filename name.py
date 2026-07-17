import requests
import json
import re
import urllib3
import sys
import os

# Tắt cảnh báo SSL
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# Danh sách tên không hợp lệ (trang login, lỗi, ...)
INVALID_NAMES = [
    "Facebook", "Log in", "Đăng nhập", "Log Into Facebook",
    "Facebook – log in or sign up", "Name not found",
    "Đăng nhập Facebook", "Đăng nhập hoặc đăng ký",
    "Page Not Found", "Content Not Found"
]

class FacebookProfileExtractor:
    def __init__(self):
        self.base_url = "https://www.facebook.com/profile.php"
        self.headers = {
            'User-Agent': "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            'Accept': "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
            'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
            'sec-fetch-site': "none",
            'sec-fetch-mode': "navigate",
            'sec-fetch-user': "?1",
            'sec-fetch-dest': "document",
            'accept-language': "vi-VN,vi;q=0.9",
        }
        self._load_cookie()

    def _load_cookie(self):
        """Đọc cookie từ data/cookie.txt"""
        cookie_paths = [
            os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data', 'cookie.txt'),
            os.path.join(os.path.dirname(os.path.abspath(__file__)), 'cookie.txt'),
        ]
        for p in cookie_paths:
            try:
                with open(p, 'r', encoding='utf-8') as f:
                    cookie = f.read().strip()
                    if cookie:
                        self.headers['Cookie'] = cookie
                        return
            except:
                pass

    def extract_profile_info(self, html_content):
        # Lấy Tên
        title_match = re.search(r'<title>(.*?)</title>', html_content)
        name = title_match.group(1) if title_match else "Name not found"
        
        # Clean name
        name = name.replace(" | Facebook", "").replace(" - Facebook", "").strip()
        
        # Check tên không hợp lệ
        if any(inv.lower() == name.lower() for inv in INVALID_NAMES):
            name = "Name not found"

        # Lấy Avatar (Tìm og:image trước)
        profile_pic_match = re.search(r'<meta property="og:image" content="([^"]+)"', html_content)
        profile_pic_url = profile_pic_match.group(1) if profile_pic_match else None
        
        if not profile_pic_url:
            profile_pic_url = "Profile picture URL not found"
        else:
            profile_pic_url = profile_pic_url.replace("&amp;", "&")
        
        return {
            "name": name,
            "avatar": profile_pic_url
        }
    
    def get_profile(self, user_id):
        params = {"id": user_id}
        try:
            response = requests.get(self.base_url, params=params, headers=self.headers, verify=False, timeout=15)
            return self.extract_profile_info(response.text)
        except Exception as e:
            return {"name": "Name not found", "avatar": "Profile picture URL not found", "error": str(e)}

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"name": "Error", "avatar": "Missing UID argument"}))
        sys.exit(1)

    uid = sys.argv[1]
    extractor = FacebookProfileExtractor()
    info = extractor.get_profile(uid)
    
    print(json.dumps(info))
