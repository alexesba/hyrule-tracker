<div align="center">

# 🗡️ Hyrule Tracker

### Track your journey through the Ocarina of Time remake for Nintendo Switch 2

![Platform](https://img.shields.io/badge/platform-Windows%20x64-0078D6?logo=windows&logoColor=white)
![Linux](https://img.shields.io/badge/Linux-AppImage%20(experimental)-FCC624?logo=linux&logoColor=black)
![License](https://img.shields.io/badge/license-MIT-green)
![Languages](https://img.shields.io/badge/languages-12-orange)
![Open Source](https://img.shields.io/badge/open%20source-contributions%20welcome-brightgreen)

A desktop app for Windows and Linux that **reads your local save** and updates the checklist, map and counters as you play. 🌍 Available in English, Portuguese, Spanish, French, German, Italian, Dutch, Russian, Japanese, Korean and Chinese (simplified and traditional).

👤 Created by **João Victor Prado**.

[🚀 First use](#-first-use) · [🐧 Linux](#-linux-experimental) · [🍎 macOS](#-macos-saves-only) · [✨ Features](#-features) · [🎮 Compatibility](#-compatibility) · [🔒 Local data](#-local-data) · [🛠️ Development](#️-development) · [🤝 Contributing](#-contributing)

</div>

---

## 🚀 First use

1. 🎮 Open the game in a compatible environment and load a game with at least one save.
2. Download the Windows installer (`.exe`) or the [Linux AppImage](#-linux-experimental) from [Releases](https://github.com/jv-prado/hyrule-tracker/releases). Open **Hyrule Tracker** to search for saves in known installations.
   > 🛡️ The installer is not code-signed yet, so Windows SmartScreen may show "Windows protected your PC". Click **More info → Run anyway**.
3. 🟢 Check the status next to the installation name:
   - **Save connected** → the tracker read the save from disk.
   - **Live** → the tracker is reading the running game.
4. 📂 Save not found? Click **Choose folder** (on the start screen or in **Settings**) and select the folder that contains the `slot_*` directories (game folder or emulator data folder, as long as it has a recognized layout). Picking a `slot_*` folder or a folder just above the profile also works.
5. 🌐 On first launch the tracker uses your system language when it has it (English otherwise). Click the flag next to **Refresh now** to pick another one from the list. The tracker remembers your choice.

> 💡 **Automatic updates:** the app checks GitHub for new versions, shows what changed and only downloads after you confirm. **Refresh now** re-reads your save progress.

## 🐧 Linux (experimental)

The Linux build is new and hasn't been tested on many systems yet. **Please tell us how it works for you** (distro, X11 or Wayland, how you run the game) in an [issue](https://github.com/jv-prado/hyrule-tracker/issues).

1. Download `Hyrule-Tracker-<version>-x86_64.AppImage`, make it executable (`chmod +x`) and run it. It updates itself like the Windows app.
2. Saves are found for games run natively or through **Wine/Proton** (Steam, Lutris, Bottles, Heroic, `~/.wine`), and on disks mounted under `/media`, `/run/media` or `/mnt`. Otherwise use **Choose folder**.
3. **Live** reading needs permission to read the game's memory. Most distros only allow it for programs that started the game (Yama `ptrace_scope` 1). The tracker tells you when that happens; to allow it until the next restart run:
   ```sh
   sudo sysctl kernel.yama.ptrace_scope=0
   ```
   This lets programs of your user read each other's memory, as on Windows. Without it the tracker still follows your saves.
4. In a Wayland-only session, Electron can open the app natively without an environment override. When `DISPLAY` is set, the app requests X11 (XWayland on Wayland) for overlay placement and global shortcuts. With NVIDIA's driver in a Wayland session, the app opens natively in Wayland instead, because XWayland can show an invisible window there. **If the window opens invisible**, start the app with `HYRULE_TRACKER_WAYLAND=1`, which leaves the decision to Electron; `HYRULE_TRACKER_X11=1` forces X11. On a Wayland desktop with XWayland, pass `--ozone-platform=x11` on launch to select X11 explicitly. Overlay placement and global shortcuts may be limited in native Wayland. The overlay requires windowed or borderless mode outside Gamescope.
5. If the AppImage closes right away on Ubuntu 24.04+ with a sandbox error, start it with `--no-sandbox`. Older distros may need `libfuse2`.

## 🍎 macOS (saves only)

There is no macOS release. You can build the app yourself on Apple silicon; it finds saves on disk (nxnative's Ocarina of Time port keeps them in `~/Library/Application Support/nxnative/0400486024DEC000`) but **cannot follow the running game live**: reading another program's memory needs `task_for_pid`, which is not implemented. The status stays **Save connected**, so save in the game or click **Refresh now**. The in-game overlay is untested.

```sh
npm ci
npm run dist:mac    # fetches the missing images, builds, signs ad hoc: release/mac-arm64/Hyrule Tracker.app
```

- Needs Node.js 22+ and an `ffmpeg` with libwebp for the item images (Homebrew's default `ffmpeg` has none; check with `ffmpeg -encoders | grep libwebp`). If npm skipped Electron's install script, the script runs it.
- The app is signed ad hoc, not notarized. Build it on the Mac that runs it, or clear the quarantine flag after copying it: `xattr -dr com.apple.quarantine "Hyrule Tracker.app"`. Automatic updates do not apply to it; build again for a new version.

## ✨ Features

| | Screen | What you can track |
| :-: | --- | --- |
| 📊 | **Overview** | Checklist %, hearts, Gold Skulltulas, opened chests, rupees and recent activity. |
| 🗺️ | **Hyrule Map** | 32 regions, per-floor maps, location photos and filters by Link's age, collectible type and completion. A red arrow shows **where Link is** and which way he faces: live in recomps; in emulators it only updates when you save ([why](#-compatibility)). **Follow Link** keeps his region and dungeon floor on screen. Maps fit the window, even fullscreen. |
| ✅ | **100% Checklist** | Hearts, 100 Gold Skulltulas, songs, equipment, trades, dungeons, Big Poes and more. Done items are struck through. **Available now** shows what you can get with known requirements. |
| ⏳ | **Threads of Time+** | Chapters, story steps and seven expandable side quests with guidance and progress from the save. |
| 🎯 | **Minigames** | 18 activities with wins, prizes and scores: shooting galleries, Bombchu Bowling, fishing, races. Deku Theater and expert modes accept manual marking. |
| ⚔️ | **Hall of Enemies** | 84 statues, 25 rematches and three trials, with best times from your save and reference images. |
| | **Easter Eggs and Secrets** | Browse region photos and discover hidden details, reactions and dialogue. Mark finds by hand in a single list that works with or without a connected save. |
| 📅 | **Daily log and My data** | Progress seen while the tracker is open, thumbnails from game saves and medals calculated from your game. |
| 🧩 | **Daily quiz** | Test your knowledge of the game with rotating questions. |
| 📱 | **Second screen** | Open the tracker on a phone, tablet or another computer on the same Wi-Fi while you play on the TV. The page shows the address to type, and the layout adapts to phones and tablets, portrait or landscape. |

The overall percentage uses the **100% Checklist** objectives. Minigame prizes that belong to it (heart pieces, equipment upgrades) already count. Wins and records are counted separately on the **Minigames** page.

👻 **Big Poes** are read from the Poe Collector's points (100 per Poe, bottle at 500, Gold Rupee at 1,000). The card also shows how many of the ten Hyrule Field Big Poes you've defeated. The save doesn't record which spot each sold Poe came from, so the field spots are ticked together once all ten are sold. Before that, mark them by hand if you want.

📚 The catalog includes **206** chest flags, **23** Fairy Thoughts, **16** Pierre summons and **37** underground entrance markers. Entries without automatic detection accept manual marking, and the map flags chests whose position is still unmapped. See the [sources and coverage details](docs/coverage-sources.md).

### 🔄 Updating during play

| Mode | Behavior |
| --- | --- |
| ⚡ **Live** | Always on: as soon as the game is open, progress is polled about every half second once the tracker links the running session to the recent save. In the recomps, Link's position also moves on the map in real time. The sidebar shows the live tracking status. |
| 💾 **Save connected** | Follows the next save or autosave, watching the folder and periodically checking slots. |
| 🔁 **Refresh now** | Forces an immediate read, retrying if the save is being written. |
| 📌 **Follow latest save** | Uses live reading. Pinning a slot shows the on-disk reading of that save. |

### 🪟 In-game overlay

Turn on **Show in-game overlay** in Settings. It can show counters, remaining objectives in the region or what is available now, with adjustable opacity and locking.

| Default shortcut | Action |
| --- | --- |
| `Ctrl + Shift + O` | 👁️ Show or hide the overlay. |
| `Ctrl + Shift + L` | 🔒 Lock or unlock the overlay for moving and resizing. |

## 🎮 Compatibility

- 🖥️ Desktop app for **Windows x64** and **Linux x86_64** (experimental), using the save format of the **Nintendo Switch 2 remake**.
- 🔎 Search recognizes installations and saves from **Triforce / NX2navi**, **NX2Saria**, **Hookshot**, **Longshot**, **ReLink**, **Ocarina Reborn**, **Fritchii** and **Lichii**.
- ⚡ Live reading depends on the game version and the memory layout of the port or emulator. See the [live mode documentation](docs/live-memory.md).
- 🧭 **Link's live position works only in recomps.** A recomp always keeps the game in the same place in memory, so the tracker knows where to find Link. An emulator moves it every time the game starts, so there the arrow only updates when you save.
- ⚡ **NX2Saria** answers live reading itself, on Windows and Linux: turn on its tracker API (`tracker_api = 1` under `[tracker]` in `nx2saria.ini`) and the tracker reads the running game through `127.0.0.1:6545`, read-only, without reading the game's memory. Its saves are found in `<game folder>/profile/save`.
- 🗂️ Saves from other environments can be selected manually if they expose the same format.
- ❌ Nintendo 64, Ocarina of Time 3D and original-game port saves use different formats and are **not** supported.

<details>
<summary>❓ <b>My game does not appear</b></summary>

1. Confirm that you saved inside the game. The tracker looks for `progress.sav` inside a `slot_*` directory.
2. Open **Settings → Find saves** and select a program to open its most recent save. Use the **Slot** selector to switch slots. If a program is missing from the list, use **Choose folder** to select its profile folder.
3. For **Live** reading, keep the game loaded and select **Follow latest save**. The indicator changes to **Live** when the tracker finds the running game.
4. If the status stays **Save connected**, save in the game or click **Refresh now** to confirm the on-disk reading follows your changes.

</details>

## 🔒 Local data

- 📴 Works **offline**. Preferences, manual marks and activity are stored in `%APPDATA%\Hyrule Tracker` (Windows) or `~/.config/Hyrule Tracker` (Linux).
- 🗺️ Maps, photos and WebP icons are bundled with the app. The only internet access is the update check on GitHub.
- 📱 **Second screen** serves the tracker on your local network (port `5184`), so any device on it can see your progress and tick items. It is on by default; turn it off on the **Second screen** page.
- 👀 Save and memory reading is **read-only**. The tracker reads new journal thumbnails directly from game saves.
- 🏠 Everything is local: no Nintendo account, remote database or VPS.

## 🛠️ Development

Built with **Electron**, **React**, **TypeScript**, **Vite** and **Vitest**. Requires **Node.js 22+** and npm. The first install and packaging may download build tools and binaries.

```powershell
npm ci
npm run dev
```

| Command | Result |
| --- | --- |
| `npm start` | ▶️ Builds and opens the app. |
| `npm run typecheck` | 🔍 Checks TypeScript types. |
| `npm test` | 🧪 Runs the test suite (tests needing private fixtures are skipped in public clones). |
| `npm run dist` | 📦 Builds the Windows x64 installer (`Hyrule-Tracker-Setup-<version>.exe`) in `release/`. |
| `npm run dist:linux` | 🐧 Builds the Linux AppImage in Docker (works from Windows with Docker Desktop). |
| `npm run dist:mac` | 🍎 Builds an ad-hoc signed macOS arm64 app on a Mac, fetching the images it lacks (see [macOS](#-macos-saves-only)). |
| `npm run dist:publish` | 🚀 Creates the draft GitHub release from `CHANGELOG.md` and uploads the installer (needs `GH_TOKEN`). |

### 🚀 Releasing a version

1. Bump `version` in `package.json` and add a `## [x.y.z]` section to [CHANGELOG.md](CHANGELOG.md). That section is the release text **and** the "What's new" the app shows to players.
2. Run `GH_TOKEN=<token> npm run dist:publish`. It creates a **draft** release and uploads the installer, `latest.yml` and the blockmap.
   Then `GH_TOKEN=<token> npm run dist:linux:publish` adds the AppImage and `latest-linux.yml` to the same draft.
3. Review the draft on GitHub and publish it. Installed apps only see published releases.

### 🖼️ Images

Images are **not** stored in Git (`src/renderer/public/images/` is ignored), so a fresh clone needs this step before `npm run build` or `npm run dist`, otherwise the app ships without icons and maps. Fetch the game and wiki images into `src/renderer/public/` before building. The item icon importer uses FFmpeg to create WebP files.

```powershell
node scripts/fetch-item-images.mjs
node scripts/fetch-reference-images.mjs
node scripts/fetch-atlas.mjs
```

### 📁 Project layout

```text
src/main/        Electron process, save discovery, watching and live reading
src/preload/     IPC bridge between the window and the main process
src/gamedata/    Binary format reading and flag evaluation
src/core/        Catalog, progress rules, maps and availability logic
src/renderer/    React interface, translations and bundled images
data/            Checklist, mappings and remake data
test/            Automated tests
docs/            References and technical documentation
```

## 🤝 Contributing

Hyrule Tracker is **open source** and everyone is welcome to contribute! 💚 Bug reports, translations, new detections, data fixes, UI ideas and code are all appreciated.

1. 🍴 Fork [the repository](https://github.com/jv-prado/hyrule-tracker) and create a branch for your change.
2. 🛠️ Run `npm install`, then `npm run dev` to work with hot reload.
3. ✅ Before opening a pull request, make sure `npm run typecheck` and `npm test` pass.
4. 📬 Open a [pull request](https://github.com/jv-prado/hyrule-tracker/pulls) describing what changed and why.

Not a coder? Open an [issue](https://github.com/jv-prado/hyrule-tracker/issues) with suggestions, missing translations or wrong data — that helps a lot too.

🐛 **Reporting an issue:** include the tracker version, port or emulator, connection status and the objective you observed. Steps and observed values are usually enough, no need to share save files. See [the save format](docs/save-format.md) and [the mapping rules](docs/save-mapping.md) to contribute detections.

## 🙏 Credits and license

- 👤 **João Victor Prado** created Hyrule Tracker.
- 🗺️ Maps, location photos and the live Link position come from [Ocarina Atlas](https://github.com/antonioalvromero/Ocarina-Atlas) by antonioalvromero, which credits its imagery to [Nintendúo](https://www.nintenduo.com/). Enemy, region and item images are credited in the docs.
- 🧩 Save mapping and game logic build on [Clawshot](https://github.com/hiKareeem/Clawshot), [OOT-SW2SE](https://github.com/Traiver/OOT-SW2SE), [dlr-developer's save editor](https://github.com/dlr-developer/the-legend-of-zelda-ocarina-of-time-switch-2-save-editor) and [OoT Randomizer](https://github.com/OoTRandomizer/OoT-Randomizer). See [third-party credits](THIRD_PARTY_NOTICES.md) for everything else.
- 📄 Code is under the [MIT license](LICENSE). Game images and trademarks belong to their owners and have their own terms of use.

> ⚠️ Hyrule Tracker is an independent fan project, not affiliated with Nintendo.
