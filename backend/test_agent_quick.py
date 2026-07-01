import asyncio
import sys

from services.lemma_client import load_lemma_config, run_agent

PROMPT = (
    'Return JSON only: {"match_score":77,"missing_skills":[],"strengths":["Python"],'
    '"weaknesses":[],"reasoning":"test"}'
)


async def main():
    agent = sys.argv[1] if len(sys.argv) > 1 else "job-matcher"
    try:
        out = await run_agent(load_lemma_config(), agent, PROMPT, poll_seconds=120)
        print("OK:", out[:400])
    except Exception as exc:
        print("FAIL:", exc)


if __name__ == "__main__":
    asyncio.run(main())
