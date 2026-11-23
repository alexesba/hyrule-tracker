import asyncio
import json
from pathlib import Path
from urllib.parse import urlparse

import decky


class Plugin:
    def __init__(self):
        self._lock = asyncio.Lock()
        self._process = None
        self._url = None

    async def get_tracker(self):
        async with self._lock:
            if self._process is not None and self._process.returncode is None and self._url:
                return {"url": self._url, "home": decky.DECKY_USER_HOME}

            root = Path(decky.DECKY_PLUGIN_DIR)
            runtime = Path(decky.DECKY_PLUGIN_RUNTIME_DIR)
            logs = Path(decky.DECKY_PLUGIN_LOG_DIR)
            runtime.mkdir(parents=True, exist_ok=True)
            logs.mkdir(parents=True, exist_ok=True)
            version = json.loads((root / "package.json").read_text(encoding="utf-8"))["trackerVersion"]
            with (logs / "tracker.log").open("ab") as log:
                self._process = await asyncio.create_subprocess_exec(
                    str(root / "bin" / "node"), str(root / "server.mjs"),
                    str(root), str(runtime), version,
                    stdout=asyncio.subprocess.PIPE, stderr=log,
                )
            try:
                line = await asyncio.wait_for(self._process.stdout.readline(), timeout=10)
                if not line:
                    raise RuntimeError("Tracker exited during startup")
                url = json.loads(line)["url"]
                parsed = urlparse(url)
                if parsed.scheme != "http" or parsed.hostname != "127.0.0.1" or not parsed.port:
                    raise RuntimeError("Unexpected tracker address")
                self._url = url
            except BaseException:
                await self._stop()
                raise
            return {"url": self._url, "home": decky.DECKY_USER_HOME}

    async def _stop(self):
        process, self._process = self._process, None
        self._url = None
        if process is None or process.returncode is not None:
            return
        try:
            process.terminate()
            await asyncio.wait_for(process.wait(), timeout=5)
        except ProcessLookupError:
            await process.wait()
        except TimeoutError:
            try:
                process.kill()
            except ProcessLookupError:
                pass
            await process.wait()

    async def _unload(self):
        async with self._lock:
            await self._stop()
