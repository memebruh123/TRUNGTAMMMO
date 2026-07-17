import sys
import re
import time
from curl_cffi import requests

def get_only_3_digits():
    if len(sys.argv) < 2:
        return
    
    uid = sys.argv[1]
    url = f"https://www.facebook.com/recover/password/?u={uid}&n=999999"
    
    headers = {
        "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        "accept-language": "vi-VN,vi;q=0.9,en-US;q=0.8",
    }

    max_retries = 2
    for attempt in range(max_retries + 1):
        try:
            response = requests.get(url, impersonate="chrome", headers=headers, timeout=10)
            
            if response.status_code == 200:
                match = re.search(r'/help/(\d+)', response.text)
                if match:
                    full_id = match.group(1)
                    print(full_id[-3:])
                    return
            
            # Non-200 status — retry
            if attempt < max_retries:
                time.sleep(1.5)
                    
        except Exception:
            if attempt < max_retries:
                time.sleep(1.5)

if __name__ == "__main__":
    get_only_3_digits()
