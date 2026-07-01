import sys
import os
import requests
import json

# Add backend directory to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

from services.auth_service import create_access_token

def main():
    user_id = "6a410345382256b8d318cf19"
    email = "anandv.csbs2023@citchennai.net"
    name = "anand"
    
    # Generate token
    token = create_access_token(user_id, email, name)
    print("Generated token:", token[:30] + "...")
    
    # Do GET request to the insights endpoint
    url = "http://127.0.0.1:5002/dashboard/ai-insights"
    headers = {
        "Authorization": f"Bearer {token}"
    }
    
    print("Calling GET /dashboard/ai-insights...")
    import time
    start_time = time.time()
    try:
        r = requests.get(url, headers=headers, timeout=180)
        print("Status Code:", r.status_code)
        print("Response Time:", round(time.time() - start_time, 2), "seconds")
        print("Response JSON:")
        print(json.dumps(r.json(), indent=2))
    except Exception as e:
        print("Error calling API:", e)

if __name__ == "__main__":
    main()
