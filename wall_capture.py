"""
[WORM-GPT v2] WALL CAPTURE - Chụp wall Facebook khi UID die
Dùng Chrome Profile riêng đã login sẵn Facebook

Cách dùng:
    LẦN ĐẦU (setup - login Facebook):
        python wall_capture.py --setup

    CHỤP WALL (gọi từ Node.js):
        python wall_capture.py <uid>
"""
import sys
import os
import time

try:
    from selenium import webdriver
    from selenium.webdriver.chrome.options import Options
    from selenium.webdriver.chrome.service import Service
except ImportError:
    import subprocess
    subprocess.check_call([sys.executable, '-m', 'pip', 'install', 'selenium', 'webdriver-manager', '--quiet'],
                          stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    from selenium import webdriver
    from selenium.webdriver.chrome.options import Options
    from selenium.webdriver.chrome.service import Service

try:
    from webdriver_manager.chrome import ChromeDriverManager
    HAS_WDM = True
except ImportError:
    HAS_WDM = False

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CHROME_PROFILE_DIR = os.path.join(BASE_DIR, 'data', 'chrome_profile')
SCREENSHOT_DIR = os.path.join(BASE_DIR, 'data', 'wall_screenshots')

# Chiều cao tối đa full page (px) - tránh ảnh quá dài
MAX_PAGE_HEIGHT = 3000


def get_chrome_service():
    """Lấy ChromeDriver service"""
    if HAS_WDM:
        try:
            return Service(ChromeDriverManager().install())
        except:
            pass
    return None


def create_setup_driver():
    """
    Chrome CHO SETUP: sạch nhất có thể, KHÔNG gắn cờ automation
    để Facebook không phát hiện → không bị đá ra.
    """
    os.makedirs(CHROME_PROFILE_DIR, exist_ok=True)

    options = Options()
    # Chỉ set profile, KHÔNG thêm bất kỳ cờ automation nào
    options.add_argument(f'--user-data-dir={CHROME_PROFILE_DIR}')
    options.add_argument('--profile-directory=Default')
    options.add_argument('--start-maximized')
    options.add_argument('--lang=vi-VN')
    # KHÔNG thêm: excludeSwitches, useAutomationExtension, custom user-agent
    # để Chrome hoạt động như bình thường, FB không detect

    service = get_chrome_service()
    if service:
        return webdriver.Chrome(service=service, options=options)
    return webdriver.Chrome(options=options)


def create_capture_driver():
    """Chrome CHO CHỤP ẢNH: headless, dùng profile đã login"""
    options = Options()
    options.add_argument(f'--user-data-dir={CHROME_PROFILE_DIR}')
    options.add_argument('--profile-directory=Default')
    options.add_argument('--headless=new')
    options.add_argument('--no-sandbox')
    options.add_argument('--disable-dev-shm-usage')
    options.add_argument('--window-size=1280,900')
    options.add_argument('--disable-gpu')
    options.add_argument('--lang=vi-VN')

    service = get_chrome_service()
    if service:
        return webdriver.Chrome(service=service, options=options)
    return webdriver.Chrome(options=options)


def setup_login():
    """
    Mở Chrome CÓ GIAO DIỆN để anh login Facebook thủ công.
    Chrome mở SẠCH, không cờ automation → FB không phát hiện.
    """
    print("=" * 50)
    print("  SETUP CHROME PROFILE CHO WALL CAPTURE")
    print("=" * 50)
    print()
    print("  Chrome se mo, anh hay:")
    print("   1. Login vao Facebook (tai khoan phu)")
    print("   2. Login xong -> quay lai day nhan ENTER")
    print("   3. Session tu luu, lan sau bot tu vao duoc")
    print()
    print("  Dang mo Chrome...")
    print()

    driver = create_setup_driver()

    try:
        driver.get('https://www.facebook.com/')
        print("  Chrome da mo! Hay login Facebook.")
        print("  (Chrome nay SACH, FB se khong phat hien bot)")
        print()

        try:
            input(">>> Nhan ENTER sau khi da login xong... ")
        except:
            print("  Cho 5 phut cho anh login...")
            time.sleep(300)

    finally:
        try:
            driver.quit()
        except:
            pass

    print()
    print("  DONE! Profile da luu.")
    print(f"  Thu muc: {CHROME_PROFILE_DIR}")
    print("  Gio bot tu chup wall duoc roi!")


def capture_wall(uid):
    """Chụp FULL PAGE wall Facebook của UID"""
    os.makedirs(SCREENSHOT_DIR, exist_ok=True)

    # Kiểm tra profile có tồn tại chưa
    if not os.path.exists(CHROME_PROFILE_DIR):
        print('')
        return

    driver = None
    try:
        driver = create_capture_driver()
        driver.set_page_load_timeout(20)

        # Vào thẳng profile (đã có session từ profile)
        url = f'https://www.facebook.com/profile.php?id={uid}'
        driver.get(url)
        time.sleep(3)

        # Đóng popup nếu có
        try:
            driver.execute_script("""
                // Đóng popup cookie consent
                var btns = document.querySelectorAll('[data-cookiebanner="accept_button"]');
                btns.forEach(function(b) { b.click(); });

                // Đóng dialog overlay
                var closeBtns = document.querySelectorAll('[role="dialog"] [aria-label="Close"], [role="dialog"] [aria-label="Đóng"]');
                closeBtns.forEach(function(b) { b.click(); });

                // Ẩn overlay
                var overlays = document.querySelectorAll('[role="dialog"], [data-testid="cookie-policy-manage-dialog"]');
                overlays.forEach(function(o) { o.style.display = 'none'; });

                document.body.style.overflow = 'auto';
                document.documentElement.style.overflow = 'auto';
            """)
            time.sleep(0.5)
        except:
            pass

        # ===== CHỤP FULL PAGE =====
        total_height = driver.execute_script(
            "return Math.max(document.body.scrollHeight, document.documentElement.scrollHeight)"
        )
        page_height = min(total_height, MAX_PAGE_HEIGHT)

        # Resize viewport = full page height → chụp hết
        driver.set_window_size(1280, page_height)
        time.sleep(1)

        # Chụp screenshot full page
        screenshot_path = os.path.join(SCREENSHOT_DIR, f'wall_{uid}.png')
        driver.save_screenshot(screenshot_path)

        if os.path.exists(screenshot_path) and os.path.getsize(screenshot_path) > 1000:
            print(screenshot_path)
        else:
            print('')

    except Exception as e:
        print('')
    finally:
        if driver:
            try:
                driver.quit()
            except:
                pass


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print('')
        sys.exit(0)

    arg = sys.argv[1]

    if arg == '--setup':
        setup_login()
    else:
        capture_wall(arg)
