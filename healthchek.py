#!/usr/bin/env python3
import asyncio
import sys

import aiohttp


async def main():
    try:
        timeout = aiohttp.ClientTimeout(total=5)
        async with aiohttp.ClientSession(timeout=timeout) as session:
            async with session.get('https://webrtcchat-production.up.railway.app') as response:
                sys.exit(0 if response.status == 200 else 1)
    except Exception:
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())