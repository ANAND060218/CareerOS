import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

import asyncio
from services.lemma_client import load_lemma_config, list_agents

async def main():
    try:
        config = load_lemma_config()
        agents = await list_agents(config)
        print("ONLINE AGENTS IN POD:")
        for a in agents:
            print(f"- {a.get('name')}: {a.get('description')}")
    except Exception as e:
        print("Error listing agents:", e)

if __name__ == "__main__":
    asyncio.run(main())
