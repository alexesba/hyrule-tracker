import asyncio
import json
from collections import deque
from pathlib import Path
from urllib.parse import urlparse

import decky


class Plugin:
    def __init__(self):
        self._lock = asyncio.Lock()
        self._process = None
        self._url = None
        self._drain = None

    def _log_file(self):
        return Path(decky.DECKY_PLUGIN_LOG_DIR) / "tracker.log"

    async def get_tracker(self):
        async with self._lock:
            if self._process is not None and self._process.returncode is None and self._url:
                return {"url": self._url, "home": decky.DECKY_USER_HOME}

            root = Path(decky.DECKY_PLUGIN_DIR)
            runtime = Path(decky.DECKY_PLUGIN_RUNTIME_DIR)
            runtime.mkdir(parents=True, exist_ok=True)
            self._log_file().parent.mkdir(parents=True, exist_ok=True)
            version = json.loads((root / "package.json").read_text(encoding="utf-8"))["trackerVersion"]
            with self._log_file().open("ab") as log:
                log.write(f"Starting Hyrule Tracker {version}\n".encode())
                log.flush()
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
                with self._log_file().open("ab") as log:
                    log.write(f"Tracker listening on port {parsed.port}\n".encode())
            except BaseException:
                await self._stop()
                raise
            # Node writes its stdout to a pipe synchronously on Linux: a pipe nobody reads fills up and stops the
            # tracker. Everything after the address goes to the log.
            self._drain = asyncio.create_task(self._copy_output(self._process))
            return {"url": self._url, "home": decky.DECKY_USER_HOME}

    async def get_log(self):
        """The last lines of the tracker's log, shown when it doesn't open."""
        try:
            with self._log_file().open("r", encoding="utf-8", errors="replace") as log:
                return "".join(deque(log, maxlen=12))
        except OSError:
            return ""

    async def _copy_output(self, process):
        try:
            with self._log_file().open("ab") as log:
                while True:
                    line = await process.stdout.readline()
                    if not line:
                        return
                    log.write(line)
                    log.flush()
        except (OSError, asyncio.CancelledError):
            return

    async def _stop(self):
        process, self._process = self._process, None
        self._url = None
        drain, self._drain = self._drain, None
        if drain is not None:
            drain.cancel()
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
