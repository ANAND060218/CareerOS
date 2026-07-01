"""Shared Lemma platform client for CareerOS agents."""

from __future__ import annotations

import asyncio
import base64
import json
import os
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import httpx

DEFAULT_CONFIG_PATH = Path.home() / ".lemma" / "config.json"
CAREER_OS_POD_NAME = "career-os"

# In-memory session cache to support refresh token rotation in server environments (like Render)
_SESSION_CACHE = {
    "token": None,
    "refresh_token": None,
}


@dataclass
class LemmaConfig:
    base_url: str
    pod_id: str
    token: str
    refresh_token: str | None = None
    config_path: Path = DEFAULT_CONFIG_PATH
    server_name: str = "local"


def _decode_jwt_exp(token: str) -> int | None:
    try:
        payload = token.split(".")[1]
        padding = "=" * (-len(payload) % 4)
        data = json.loads(base64.urlsafe_b64decode(payload + padding))
        exp = data.get("exp")
        return int(exp) if exp is not None else None
    except Exception:
        return None


def _token_expired(token: str, *, skew_seconds: int = 30) -> bool:
    exp = _decode_jwt_exp(token)
    if exp is None:
        return False
    return time.time() >= (exp - skew_seconds)


def _load_root_config(config_path: Path = DEFAULT_CONFIG_PATH) -> dict[str, Any]:
    if not config_path.exists():
        return {}
    with open(config_path, "r", encoding="utf-8") as handle:
        return json.load(handle)


def _get_server_config(root_config: dict[str, Any], server_name: str) -> dict[str, Any]:
    servers = root_config.get("servers", {})
    if not isinstance(servers, dict):
        return {}
    server = servers.get(server_name, {})
    return server if isinstance(server, dict) else {}


def _extract_token(server_config: dict[str, Any]) -> str | None:
    auth = server_config.get("auth")
    if isinstance(auth, dict):
        token = auth.get("access_token") or auth.get("token")
        if isinstance(token, str) and token:
            return token
    token = server_config.get("token")
    return token if isinstance(token, str) and token else None


def _extract_refresh_token(server_config: dict[str, Any]) -> str | None:
    auth = server_config.get("auth")
    if isinstance(auth, dict):
        token = auth.get("refresh_token")
        if isinstance(token, str) and token:
            return token
    token = server_config.get("refresh_token")
    return token if isinstance(token, str) and token else None


def _persist_refreshed_session(
    root_config: dict[str, Any],
    server_name: str,
    session: dict[str, Any],
    config_path: Path,
) -> None:
    servers = root_config.setdefault("servers", {})
    server_config = servers.setdefault(server_name, {})
    auth = server_config.setdefault("auth", {})
    auth.update(session)
    if session.get("access_token"):
        server_config["token"] = session["access_token"]
    if session.get("refresh_token"):
        server_config["refresh_token"] = session["refresh_token"]
    if session.get("base_url"):
        server_config["base_url"] = session["base_url"]
    with open(config_path, "w", encoding="utf-8") as handle:
        json.dump(root_config, handle, indent=2)


def refresh_access_token(base_url: str, refresh_token: str) -> dict[str, Any]:
    with httpx.Client(timeout=30.0) as client:
        response = client.post(
            f"{base_url.rstrip('/')}/auth/cli/refresh",
            json={"refresh_token": refresh_token},
            headers={"Accept": "application/json"},
        )
    if response.status_code >= 400:
        detail = response.text.strip() or response.reason_phrase
        raise RuntimeError(f"Lemma token refresh failed: {detail}")
    return response.json()


def load_lemma_config(
    *,
    config_path: Path = DEFAULT_CONFIG_PATH,
    server_name: str | None = None,
    refresh_if_expired: bool = True,
) -> LemmaConfig:
    root_config = _load_root_config(config_path)
    active_server = server_name or os.getenv("LEMMA_SERVER") or root_config.get("active_server", "local")
    server_config = _get_server_config(root_config, active_server)

    base_url = (
        os.getenv("LEMMA_API_URL")
        or os.getenv("LEMMA_BASE_URL")
        or server_config.get("base_url")
        or "http://127.0.0.1:8711"
    ).rstrip("/")

    pod_id = (
        os.getenv("LEMMA_POD_ID")
        or server_config.get("defaults", {}).get("pod_id")
        or os.getenv("CAREEROS_LEMMA_POD_ID")
    )
    if not pod_id:
        raise RuntimeError(
            "Lemma pod_id not found. Run setup_lemma.ps1 or set LEMMA_POD_ID in the environment."
        )

    global _SESSION_CACHE

    # 1. Try to load from in-memory cache first (most up-to-date)
    token = _SESSION_CACHE["token"]
    refresh_token = _SESSION_CACHE["refresh_token"]

    # 2. If not in cache, load from config file if it exists and has auth (prevents using stale .env values)
    if not token:
        config_token = _extract_token(server_config)
        if config_token:
            token = config_token
            refresh_token = _extract_refresh_token(server_config)

    # 3. If still not found, fall back to environment variables (for cloud/Docker environments)
    if not token:
        token = os.getenv("LEMMA_TOKEN") or os.getenv("LEMMA_ACCESS_TOKEN")
        refresh_token = os.getenv("LEMMA_REFRESH_TOKEN")

    if not token:
        raise RuntimeError(
            "Lemma access token not found. Run `lemma auth login` or set LEMMA_TOKEN."
        )

    if refresh_if_expired and _token_expired(token) and refresh_token:
        try:
            session = refresh_access_token(base_url, refresh_token)
            token = session.get("access_token") or token
            refresh_token = session.get("refresh_token") or refresh_token
            
            # Cache the rotated session in-memory
            _SESSION_CACHE["token"] = token
            _SESSION_CACHE["refresh_token"] = refresh_token
            
            try:
                config_path.parent.mkdir(parents=True, exist_ok=True)
                _persist_refreshed_session(root_config, active_server, session, config_path)
            except Exception as write_err:
                print(f"[LEMMA CLIENT] Warning: could not write refreshed session to {config_path}: {write_err}")
        except Exception as refresh_err:
            print(f"[LEMMA CLIENT] Warning: token refresh failed: {refresh_err}")

    return LemmaConfig(
        base_url=base_url,
        pod_id=pod_id,
        token=token,
        refresh_token=refresh_token,
        config_path=config_path,
        server_name=active_server,
    )


def auth_headers(config: LemmaConfig) -> dict[str, str]:
    return {"Authorization": f"Bearer {config.token}"}


def _list_items(payload: dict[str, Any]) -> list[dict[str, Any]]:
    items = payload.get("items")
    if isinstance(items, list):
        return items
    entries = payload.get("entries")
    if isinstance(entries, list):
        return entries
    return []


def _message_text(message: dict[str, Any]) -> str:
    text = message.get("text")
    if isinstance(text, str) and text:
        return text
    content = message.get("content")
    return content if isinstance(content, str) else ""


def _conversation_status(value: Any) -> str | None:
    """Normalize Lemma status payloads from both desktop and cloud runtimes."""
    if isinstance(value, str):
        return value.upper()
    if isinstance(value, dict):
        for key in ("status", "state", "name", "value"):
            normalized = _conversation_status(value.get(key))
            if normalized:
                return normalized
    return None


async def list_agents(config: LemmaConfig | None = None, *, timeout: float = 12.0) -> list[dict[str, Any]]:
    cfg = config or load_lemma_config()
    async with httpx.AsyncClient(timeout=timeout) as client:
        response = await client.get(
            f"{cfg.base_url}/pods/{cfg.pod_id}/agents",
            headers=auth_headers(cfg),
        )
    if response.status_code == 401 and cfg.refresh_token:
        global _SESSION_CACHE
        session = refresh_access_token(cfg.base_url, cfg.refresh_token)
        cfg.token = session.get("access_token") or cfg.token
        cfg.refresh_token = session.get("refresh_token") or cfg.refresh_token
        
        # Cache the rotated session in-memory
        _SESSION_CACHE["token"] = cfg.token
        _SESSION_CACHE["refresh_token"] = cfg.refresh_token
        
        async with httpx.AsyncClient(timeout=20.0) as client:
            response = await client.get(
                f"{cfg.base_url}/pods/{cfg.pod_id}/agents",
                headers=auth_headers(cfg),
            )
    response.raise_for_status()
    return _list_items(response.json())


import re


def strip_html(text: str) -> str:
    if not text:
        return ""
    cleaned = re.sub(r"<br\s*/?>", "\n", text, flags=re.IGNORECASE)
    cleaned = re.sub(r"<[^>]+>", " ", cleaned)
    cleaned = re.sub(r"\s+", " ", cleaned)
    return cleaned.strip()


async def run_agent(
    config: LemmaConfig,
    agent_name: str,
    content: str,
    *,
    poll_seconds: int = 600,
) -> str:
    try:
        return await _run_agent_once(config, agent_name, content, poll_seconds=poll_seconds)
    except RuntimeError as exc:
        message = str(exc)
        if "429" in message or "RESOURCE_EXHAUSTED" in message:
            raise RuntimeError(
                f"Lemma agent '{agent_name}' failed because Gemini quota is exhausted. "
                f"Lemma agents call gemini-2.5-flash through the Lemma runtime. Details: {message}"
            ) from exc
        raise


async def _run_agent_once(
    config: LemmaConfig,
    agent_name: str,
    content: str,
    *,
    poll_seconds: int,
) -> str:
    headers = auth_headers(config)

    # Use granular timeouts to handle long-running agent responses
    # connect: 10s, read: 600s (10 min), write: 60s, pool: 60s
    timeout = httpx.Timeout(600.0, connect=10.0, read=600.0, write=60.0, pool=60.0)
    async with httpx.AsyncClient(timeout=timeout) as client:
        create_response = await client.post(
            f"{config.base_url}/pods/{config.pod_id}/conversations",
            json={"agent_name": agent_name, "title": f"Run {agent_name}"},
            headers=headers,
        )
        if create_response.status_code == 401 and config.refresh_token:
            global _SESSION_CACHE
            session = refresh_access_token(config.base_url, config.refresh_token)
            config.token = session.get("access_token") or config.token
            config.refresh_token = session.get("refresh_token") or config.refresh_token
            
            # Cache the rotated session in-memory
            _SESSION_CACHE["token"] = config.token
            _SESSION_CACHE["refresh_token"] = config.refresh_token
            
            headers = auth_headers(config)
            create_response = await client.post(
                f"{config.base_url}/pods/{config.pod_id}/conversations",
                json={"agent_name": agent_name, "title": f"Run {agent_name}"},
                headers=headers,
            )
        if create_response.status_code != 201:
            raise RuntimeError(
                f"Failed to create conversation for {agent_name}: {create_response.text}"
            )

        conv_id = create_response.json().get("id")
        send_response = await client.post(
            f"{config.base_url}/pods/{config.pod_id}/conversations/{conv_id}/messages",
            json={"content": content},
            headers=headers,
        )
        if send_response.status_code != 200:
            raise RuntimeError(f"Failed to send message to {agent_name}: {send_response.text}")

        final_status = None
        last_run_error = None
        for _ in range(poll_seconds):
            await asyncio.sleep(1.0)
            status_response = await client.get(
                f"{config.base_url}/pods/{config.pod_id}/conversations/{conv_id}",
                headers=headers,
            )
            if status_response.status_code == 200:
                status_data = status_response.json()
                final_status = _conversation_status(status_data.get("status"))
                last_run_error = status_data.get("last_run_error")
                if final_status in {"COMPLETED", "FAILED", "STOPPED"}:
                    break

        messages_response = await client.get(
            f"{config.base_url}/pods/{config.pod_id}/conversations/{conv_id}/messages",
            headers=headers,
        )
        if messages_response.status_code != 200:
            raise RuntimeError(f"Failed to fetch messages for {agent_name}: {messages_response.text}")

        entries = _list_items(messages_response.json())
        assistant_msgs = [message for message in entries if message.get("role") == "assistant"]
        if assistant_msgs:
            last_content = _message_text(assistant_msgs[-1])
            if "status_code: 400" in last_content or "No LLM model" in last_content:
                raise RuntimeError(f"Agent run failed with error: {last_content}")
            return last_content

        if final_status == "FAILED" and last_run_error:
            raise RuntimeError(f"Lemma agent '{agent_name}' failed: {last_run_error}")

        raise RuntimeError(f"No assistant response found for {agent_name}")


def gemini_configured() -> bool:
    key = os.getenv("GEMINI_API_KEY", "")
    return bool(key and key != "GEMINI_API_KEY")


def prefer_lemma_default() -> bool:
    return os.getenv("PREFER_LEMMA", "true").strip().lower() in {"1", "true", "yes"}


# Models that work with the CareerOS Gemini OPENAI_COMPATIBLE profile (local stack).
RECOMMENDED_GEMINI_MODELS = [
    "gemini-2.5-flash",
    "gemini-2.0-flash",
    "models/gemini-2.5-flash",
    "models/gemini-2.0-flash",
    "models/gemini-2.0-flash-lite",
]

# Broken on local Lemma — routes OpenAI model names to Gemini generateContent (404).
AVOID_LOCAL_MODELS = ["gpt-4o-mini", "gpt-4o"]


def _careeros_profile_id() -> str | None:
    profile = os.getenv("LEMMA_RUNTIME_PROFILE", "").strip()
    if profile and profile != "system:lemma":
        return profile
    return None


def _pick_recommended_models(catalog: list[dict[str, Any]]) -> list[str]:
    names = [entry.get("name") for entry in catalog if isinstance(entry.get("name"), str)]
    picked: list[str] = []
    for candidate in RECOMMENDED_GEMINI_MODELS:
        if candidate in names and candidate not in picked:
            picked.append(candidate)
    if not picked and names:
        picked = [name for name in names if "flash" in name.lower() and "tts" not in name.lower()][:6]
    return picked


async def list_runtime_profiles(config: LemmaConfig | None = None) -> list[dict[str, Any]]:
    cfg = config or load_lemma_config()
    async with httpx.AsyncClient(timeout=15.0) as client:
        for path in ("/runtime-profiles", "/runtime/profiles"):
            response = await client.get(
                f"{cfg.base_url}{path}",
                headers=auth_headers(cfg),
            )
            if response.status_code == 200:
                return _list_items(response.json())
    return []


async def get_pod(config: LemmaConfig | None = None) -> dict[str, Any]:
    cfg = config or load_lemma_config()
    async with httpx.AsyncClient(timeout=12.0) as client:
        response = await client.get(
            f"{cfg.base_url}/pods/{cfg.pod_id}",
            headers=auth_headers(cfg),
        )
    response.raise_for_status()
    return response.json()


def patch_pod_default_profile(profile_id: str, config: LemmaConfig | None = None) -> bool:
    cfg = config or load_lemma_config()
    payload = {
        "config": {
            "default_profile_id": profile_id,
            "join_policy": "INVITE_ONLY",
        }
    }
    with httpx.Client(timeout=20.0) as client:
        response = client.put(
            f"{cfg.base_url}/pods/{cfg.pod_id}",
            json=payload,
            headers=auth_headers(cfg),
        )
    return response.status_code == 200


async def check_lemma_health() -> dict[str, Any]:
    base: dict[str, Any] = {
        "gemini_configured": gemini_configured(),
        "prefer_lemma": prefer_lemma_default(),
        "workflow_note": (
            "Workflows try Lemma agents first when PREFER_LEMMA=true and the local Lemma stack is running. "
            "If Lemma is offline or an agent step fails, CareerOS falls back to direct Gemini using GEMINI_API_KEY in backend/.env. "
            "Your .env Gemini key does NOT automatically configure Lemma — set the model API key inside Lemma (lemma-stack / lemma.work pod settings)."
        ),
    }
    try:
        config = load_lemma_config()
        agents = await list_agents(config, timeout=10.0)
        profiles = await list_runtime_profiles(config)
        pod = await get_pod(config)
        careeros_profile_id = _careeros_profile_id()
        active_profile = next(
            (profile for profile in profiles if profile.get("id") == careeros_profile_id),
            None,
        )
        if not active_profile and careeros_profile_id:
            active_profile = next(
                (profile for profile in profiles if profile.get("name") == "CareerOS Gemini"),
                None,
            )
        catalog = active_profile.get("model_catalog", []) if active_profile else []
        recommended = _pick_recommended_models(catalog) or list(RECOMMENDED_GEMINI_MODELS[:4])
        configured_model = os.getenv("LEMMA_RUNTIME_MODEL", "gemini-2.5-flash")
        agent_runtimes = {
            agent.get("name"): agent.get("agent_runtime")
            for agent in agents
            if agent.get("name")
        }
        pod_default = (pod.get("config") or {}).get("default_profile_id")
        pod_misconfigured = pod_default == "system:lemma"
        base.update({
            "connected": True,
            "base_url": config.base_url,
            "pod_id": config.pod_id,
            "agent_count": len(agents),
            "agents": [agent.get("name") for agent in agents],
            "runtime_mode": "lemma" if prefer_lemma_default() else "gemini_direct",
            "active_profile_id": careeros_profile_id or (active_profile or {}).get("id"),
            "active_profile_name": (active_profile or {}).get("name", "CareerOS Gemini"),
            "configured_model": configured_model,
            "pod_default_profile_id": pod_default,
            "pod_misconfigured": pod_misconfigured,
            "recommended_models": recommended,
            "avoid_models": AVOID_LOCAL_MODELS,
            "agent_runtimes": agent_runtimes,
            "lemma_ui_hint": (
                "In Lemma Web UI, pick profile 'CareerOS Gemini' and model "
                f"'{configured_model}' (or gemini-2.0-flash). "
                "Do NOT use system:lemma or gpt-4o-mini — they 404 on local stack."
            ),
        })
        if pod_misconfigured and careeros_profile_id:
            try:
                if patch_pod_default_profile(careeros_profile_id, config):
                    base["pod_default_profile_id"] = careeros_profile_id
                    base["pod_misconfigured"] = False
                    base["pod_fix_applied"] = True
            except Exception:
                pass
        return base
    except Exception as exc:
        err = str(exc)
        hint = "Start Lemma: run `lemma-stack start` (Docker must be running), then refresh."
        if "Connect" in err or "timeout" in err.lower() or "refused" in err.lower():
            hint = "Lemma local server is not reachable. Run `lemma-stack start` in a terminal."
        base.update({
            "connected": False,
            "error": err,
            "hint": hint,
            "runtime_mode": "gemini_direct" if gemini_configured() else "offline",
        })
        return base


async def execute_connector_operation(
    config: LemmaConfig,
    auth_config_name: str,
    operation: str,
    payload: dict,
) -> dict:
    """Execute a connector operation via Lemma REST API."""
    headers = auth_headers(config)
    async with httpx.AsyncClient(timeout=300.0) as client:
        # Fetch organization ID
        org_id = None
        try:
            orgs_res = await client.get(f"{config.base_url}/organizations", headers=headers)
            if orgs_res.status_code == 200:
                orgs = orgs_res.json().get("items", [])
                if orgs:
                    org_id = orgs[0].get("id")
        except Exception as e:
            print(f"Failed to fetch organization ID in execute: {e}")
            
        if not org_id:
            try:
                pod_res = await client.get(f"{config.base_url}/pods/{config.pod_id}", headers=headers)
                if pod_res.status_code == 200:
                    org_id = pod_res.json().get("organization_id")
            except Exception as e:
                print(f"Failed to fetch organization ID from pod in execute: {e}")
                
        if not org_id:
            raise RuntimeError("Lemma organization ID not found for connector execution.")

        url = f"{config.base_url}/organizations/{org_id}/connectors/{auth_config_name}/operations/{operation}/execute"
        body = {
            "payload": payload,
        }
        try:
            response = await client.post(url, json=body, headers=headers)
            response.raise_for_status()
            return response.json()
        except Exception as e:
            print(f"Lemma connector operation execute failed: {e}")
            raise

