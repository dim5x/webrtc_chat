#!/usr/bin/env python3
import os
from urllib.request import urlopen


try:
    port = os.environ.get("PORT", "8080")
    with urlopen(f"http://127.0.0.1:{port}/health", timeout=5) as response:
        raise SystemExit(0 if response.status == 200 else 1)
except OSError:
    raise SystemExit(1)
