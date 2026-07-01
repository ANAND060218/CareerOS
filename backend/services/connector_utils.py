"""Connector utility functions for CareerOS."""

import httpx
from services.lemma_client import auth_headers, LemmaConfig


async def disconnect_connector(
    config: LemmaConfig,
    connector_id: str,
) -> bool:
    """Disconnect a connector account via Lemma REST API."""
    headers = auth_headers(config)
    async with httpx.AsyncClient(timeout=60.0) as client:
        # First, get the account ID for this connector
        try:
            res = await client.get(f"{config.base_url}/connectors/accounts", headers=headers)
            if res.status_code != 200:
                print(f"Failed to fetch connector accounts: {res.status_code}")
                return False
            
            data = res.json()
            items = data.get("items", [])
            account_to_delete = None
            for item in items:
                if item.get("connector_id") == connector_id and item.get("status") == "CONNECTED":
                    account_to_delete = item
                    break
            
            if not account_to_delete:
                print(f"No connected account found for connector: {connector_id}")
                return False
            
            account_id = account_to_delete.get("id")
            
            # Delete the account
            delete_res = await client.delete(
                f"{config.base_url}/connectors/accounts/{account_id}",
                headers=headers
            )
            
            if delete_res.status_code == 200:
                print(f"Successfully disconnected connector: {connector_id}")
                return True
            else:
                print(f"Failed to disconnect connector {connector_id}: {delete_res.status_code}")
                return False
                
        except Exception as e:
            print(f"Error disconnecting connector {connector_id}: {e}")
            return False
