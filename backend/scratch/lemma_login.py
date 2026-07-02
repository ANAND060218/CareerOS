"""
Lemma browser-based login flow for Windows.
Opens browser for login, captures the tokens via a local callback server.
This bypasses the `lemma auth login` CLI which is broken on Windows (termios).
"""
import http.server
import json
import threading
import time
import webbrowser
from pathlib import Path
from urllib.parse import parse_qs, urlparse

import httpx

LEMMA_AUTH_URL = "https://lemma.work/auth"
LEMMA_API_URL = "https://api.lemma.work"
CALLBACK_PORT = 9876
CONFIG_PATH = Path.home() / ".lemma" / "config.json"


def refresh_and_save(refresh_token: str):
    """Try to refresh and save new tokens."""
    print(f"\n[*] Attempting token refresh...")
    r = httpx.post(
        f"{LEMMA_API_URL}/auth/cli/refresh",
        json={"refresh_token": refresh_token},
        headers={"Accept": "application/json"},
        timeout=30.0,
    )
    if r.status_code >= 400:
        print(f"[!] Refresh failed: {r.text}")
        return None
    
    session = r.json()
    print(f"[+] Refresh succeeded!")
    print(f"    New access_token: ...{session.get('access_token', '')[-20:]}")
    print(f"    New refresh_token: ...{session.get('refresh_token', '')[-20:]}")
    return session


def update_config(session: dict):
    """Update ~/.lemma/config.json with new tokens."""
    config = {}
    if CONFIG_PATH.exists():
        with open(CONFIG_PATH) as f:
            config = json.load(f)
    
    servers = config.setdefault("servers", {})
    cloud = servers.setdefault("cloud", {})
    auth = cloud.setdefault("auth", {})
    
    auth.update(session)
    if session.get("access_token"):
        cloud["token"] = session["access_token"]
    if session.get("refresh_token"):
        cloud["refresh_token"] = session["refresh_token"]
    
    cloud["base_url"] = LEMMA_API_URL
    cloud["auth_url"] = LEMMA_AUTH_URL
    config["active_server"] = "cloud"
    
    CONFIG_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(CONFIG_PATH, "w") as f:
        json.dump(config, f, indent=2)
    
    print(f"[+] Updated {CONFIG_PATH}")


def print_render_env(session: dict):
    """Print the env vars to set on Render."""
    at = session.get("access_token", "")
    rt = session.get("refresh_token", "")
    
    print("\n" + "=" * 60)
    print("  COPY THESE TO RENDER ENVIRONMENT VARIABLES")
    print("=" * 60)
    print(f"\nLEMMA_TOKEN={at}")
    print(f"\nLEMMA_REFRESH_TOKEN={rt}")
    print("\n" + "=" * 60)
    print("\n[!] IMPORTANT: After setting these on Render,")
    print("    DO NOT run any lemma commands locally!")
    print("    The tokens will be invalidated if refreshed from your PC.")
    print("=" * 60)


def main():
    # First, try reading current config and refreshing
    if CONFIG_PATH.exists():
        with open(CONFIG_PATH) as f:
            config = json.load(f)
        
        cloud = config.get("servers", {}).get("cloud", {})
        rt = cloud.get("refresh_token") or cloud.get("auth", {}).get("refresh_token")
        
        if rt:
            session = refresh_and_save(rt)
            if session:
                update_config(session)
                print_render_env(session)
                return
            else:
                print("[!] Current refresh token is dead. Need fresh login.")
    
    # If refresh failed, need manual re-login
    print("\n[!] All tokens are expired/invalidated.")
    print("[!] You need to do a fresh login via the Lemma website.")
    print("\nPlease follow these steps:")
    print("  1. Go to https://lemma.work and login with your account")
    print("  2. Open browser DevTools (F12) -> Application -> Cookies")
    print("  3. Find the cookies for lemma.work")
    print("  4. Look for 'sRefreshToken' cookie value")
    print("  5. Paste it below:")
    
    rt = input("\nPaste sRefreshToken value: ").strip()
    if not rt:
        print("[!] No token provided. Exiting.")
        return
    
    session = refresh_and_save(rt)
    if session:
        update_config(session)
        print_render_env(session)
    else:
        print("[!] Could not refresh with provided token.")
        print("[!] The cookie-based refresh token format may differ from CLI format.")
        print("[!] Try logging in via WSL: wsl pip install lemma-terminal && wsl lemma auth login")


if __name__ == "__main__":
    main()
