# Changelog

Player-facing changes in each Hyrule Tracker version. Every published version needs a `## [version]` section here:
`scripts/ensure-release.mjs` uses it as the GitHub release text, and the in-app updater shows it before the player decides to update.
Format: `New`, `Improved`, `Fixed`, `Removed`, `Known` (open issue).

## [1.5.0] - 2026-11-21

### New
- **Walkthrough.** Follow the 20 story chapters and six side quests in any of the tracker's 12 languages. With a save connected, the guide highlights your chapter and checks off steps as you progress. Click an objective to see its location, available photos and completion status in the same card used by the map, right inside the chapter. The nine new guide translations were machine-assisted and reviewed by sample.
- **Save profiles.** Pick a profile from the save menu when a game or emulator has more than one. You can switch between players without browsing for their save folders. Thanks to raphael-s-souza for requesting this. [#16](https://github.com/jv-prado/hyrule-tracker/issues/16)
- **Game activity and counters.** Daily Log can show enemies defeated, damage taken, songs played and estimated time by area from the game's own log, including play while the tracker was closed. My Data shows the save's jump, roll and sword swing totals. Thanks to Kabosune for documenting the save fields. [#15](https://github.com/jv-prado/hyrule-tracker/issues/15)
- **Rekarina saves on Windows.** The tracker finds Rekarina's save folders and updates progress when you save. Thanks to PainKiller2k for suggesting support. [#20](https://github.com/jv-prado/hyrule-tracker/issues/20)
- **Experimental live tracking on macOS.** On Apple silicon, a self-built tracker can read progress and show Link's live position when playing through nxnative. Live tracking requires administrator privileges. Thanks to Daniel Rijavec (driajvec) for proposing, building and testing it. [#17](https://github.com/jv-prado/hyrule-tracker/issues/17) · [#19](https://github.com/jv-prado/hyrule-tracker/pull/19)

### Improved
- **Brazilian Portuguese and Spanish names.** Item, place, song, enemy and character names across the tracker and walkthrough follow the remake's localizations.
- **Collectible and quest guides.** Checked locations, requirements and instructions against the remake guides. Updated hints for heart pieces, upgrades, Great Fairy rewards, the trading quests and other objectives.

### Fixed
- **Gold Skulltula #99.** The map pin and guide now point to the grotto in southeastern Hyrule Field. The guide explains what to do there as Child Link and how to collect the token as Adult Link. Thanks to unleed-l for reporting the incorrect location and supplying both steps. [#18](https://github.com/jv-prado/hyrule-tracker/issues/18)

### Known
- **Rekarina and macOS.** Rekarina support is save-based. The macOS overlay is untested, and macOS builds are available from source.

## [1.4.8] - 2026-11-19

### Improved
- **Map controls on the map.** The region, floor, filters, child/adult and the "Hide unseen regions" and "Follow Link" switches sit in one bar over the map, and the progress panel sits on the map's right edge, so the map uses the whole width. The full screen button moved to the zoom buttons. On a wide window the bar wraps into a second row when it doesn't fit, instead of going under the panel.
- **Child and adult in one switch.** Tap the child or adult side to see only that age, and tap it again to see both. With a keyboard, Enter steps through both, child and adult.
- **Map on a phone.** The map is taller, the zoom buttons sit in a row under it, and the bar folds to one row (the arrow opens the rest). Outside full screen the progress panel stays under the map. In full screen it opens from the bottom, and the zoom buttons move above it. Turned sideways, the panel sits on the right.
- **Switches and menus.** On/off options are switches, and menus use the tracker's own arrow, on every page.
- **Full screen hides the note** about recomps and emulators, so the map gets that space.

Thanks to alexesba for designing and contributing this. [#14](https://github.com/jv-prado/hyrule-tracker/pull/14)

### Removed
- **Region picture in the progress panel.** The panel starts with the region's name and score, to leave more room for the list.

## [1.4.7] - 2026-11-19

### New
- **HeyListen.** The tracker finds HeyListen (a Hookshot fork) and follows it live, like Hookshot. On Windows it reads the game (`bin\HeyListen.exe`) and not its launcher, which has the same name. On Linux it follows the saves in `~/.local/share/heylisten`. Thanks to rrafito for requesting this. [#13](https://github.com/jv-prado/hyrule-tracker/issues/13)

### Known
- **HeyListen live reading is untested.** It hasn't been tried with the game running yet. If live doesn't start, please share the tracker's error log in [#13](https://github.com/jv-prado/hyrule-tracker/issues/13).

## [1.4.6] - 2026-11-19

### New
- **Full screen map.** The "Full screen" button on the map page shows the map alone, for a second monitor. Link's live position, the markers, the filters and "Follow Link" keep working. The progress panel stays beside the map: the percentage of each region on the Hyrule map, and what is left to do in a region. Press Esc or the button again to leave. Thanks to alexesba for the suggestion. [#12](https://github.com/jv-prado/hyrule-tracker/issues/12)
- **QR code for the Second Screen.** Scan the code on the Second Screen page with a phone or tablet camera to open the tracker, without typing the address. If the PC has more than one address, pick one to see its code. The code is made on your PC, with no outside service. Thanks to alexesba for the suggestion. [#12](https://github.com/jv-prado/hyrule-tracker/issues/12)

## [1.4.5] - 2026-11-19

### New
- **Pinch to zoom the maps.** On a phone or tablet, pinch with two fingers to zoom the Hyrule and dungeon maps, drag with one finger to move a zoomed map, and double-tap to zoom in. At normal size, one finger still scrolls the page.

### Improved
- **Second Screen on phones and tablets.** Every page was reviewed on phones and tablets in portrait and landscape:
  - Buttons, filters and tabs are large enough to tap.
  - Long names wrap instead of being cut off.
  - Nothing slides off the side of the screen.
  - Content keeps clear of the notch and the home indicator.
- **What to do on a phone.** Tapping an objective opens its details in a panel that slides up from the bottom. Before, the details changed at the top of the page, out of view. On tablets, the list and the details sit side by side.
- **Map marker details on a phone.** The details stay inside the map instead of sliding off the screen.
- **Checklist on a phone.** Tiles fill each card and show their full names. Tap outside the details panel to close it.

### Fixed
- **Scrolling on phones.** The Enemy Hall list and the What to do details no longer trap your finger in a box inside the page.
- **Checklist categories.** Picking a category in the "Categories" menu did nothing.
- **Map floors.** Tapping a marker found on both the child and adult floors switched floors and reset the zoom.
- **Daily quiz.** The score read "2of 5correct", without spaces.

## [1.4.4] - 2026-11-18

### New
- **macOS (build it yourself).** `npm run dist:mac` builds an app for Apple silicon that finds saves, including nxnative's Ocarina of Time port. Live reading is not available on macOS. Thanks to Pedro Nascimento for building this. [#9](https://github.com/jv-prado/hyrule-tracker/pull/9)

### Fixed
- **Invisible window on Linux with NVIDIA.** In a Wayland session with NVIDIA's driver, the app now opens natively in Wayland, where before XWayland showed an invisible window. If the window still opens invisible, start the app with `HYRULE_TRACKER_WAYLAND=1`. In native Wayland, overlay placement and global shortcuts may be limited. Thanks to BroOtti for reporting this and testing the workarounds. [#10](https://github.com/jv-prado/hyrule-tracker/issues/10)

## [1.4.3] - 2026-11-18

### New
- **NX2Saria.** The tracker finds NX2Saria's saves and follows it live on Windows and Linux. Turn on its tracker API (`tracker_api = 1` under `[tracker]` in `nx2saria.ini`, NX2Saria 0.17.0 or later) and the game sends its progress and Link's position to the tracker, without memory reading. Thanks to Larbaco for building this. [#8](https://github.com/jv-prado/hyrule-tracker/pull/8)

### Improved
- **Link on the map.** Link is now a red arrow with a halo that points where he faces, easier to spot on the map. Thanks to csomi for suggesting the new look.
- **Live position in emulators.** The map now says that in emulators Link's position only updates when you save. Live position works in recomps.
- **Connection problems.** When the tracker can't connect to the running game, the sidebar says why. The error is also written to `error.log` in the app's data folder, so you can send it with a report.

### Fixed
- **Live position on Linux.** Link's live position works with the native Linux build of Hookshot. Before, the map only moved him when the game saved. Thanks to csomi for reporting this on Discord and testing the fix.

## [1.4.2] - 2026-11-17

### Improved
- **Second Screen on Windows.** The installer offers to allow Hyrule Tracker through Windows Firewall on private networks, so phones and tablets can connect. Windows asks for permission once; updates never ask.
- **Second Screen on Windows.** If Windows has set your network to Public, the Second Screen page warns you and opens the network settings so you can switch it to Private. On a Public network the firewall blocks other devices, even after you allowed the app. Thanks to h1ghland3r for reporting this (#6).

## [1.4.1] - 2026-11-17

### Improved
- **Find saves.** Pick a detected program by icon, name and latest save date, then choose a slot.
- **Page loading.** Skeletons match each screen on phones and tablets. Page changes have a short transition that respects reduced motion.
- **In-game overlay.** Settings shows the shortcut next to the overlay button.

### Fixed
- **Update window.** Fixed the blue background behind the **New** section.

### Removed
- **Automatic screenshots.** Removed game-window captures and their setting. The activity log still records progress and can show thumbnails from saves. Thanks to Ryan for raising this on Discord.

## [1.4.0] - 2026-11-17

### New
- **Second screen.** Open the tracker in a browser on the same Wi-Fi to follow your progress on a phone, tablet or another computer. Thanks to jrmedd for the suggestion. [#4](https://github.com/jv-prado/hyrule-tracker/issues/4)
- **Easter Eggs and Secrets.** Explore 45 discoveries by region and check them off even without a connected save.
- **Progress bars.** See completion in the checklist, Threads of Time+, Minigames and Hall of Fallen Foes.

### Improved
- **Navigation.** Added layouts for phones and tablets, improved keyboard focus and simplified the map and checklist.
- **Language loading.** Translations load when you select a language.

### Fixed
- **Second screen.** Recover from a dropped connection and retry if the tracker fails to open.
- **Daily log.** Added the missing space between counts and labels.
- **Linux startup.** The AppImage opens on Wayland-only desktops. Thanks to Digital-Storm for requesting the Linux build. [#3](https://github.com/jv-prado/hyrule-tracker/issues/3)
- **Windows overlay.** Fixed mouse lag after switching out of the game with Alt+Tab.
- **Proper names.** Kept the original spelling of recomp, emulator and character names. Thanks to h1ghland3r for reporting the mouse lag and suggesting the naming fix. [#5](https://github.com/jv-prado/hyrule-tracker/issues/5)

### Removed
- Removed the Rumor Quests photo hunt.

## [1.3.0] - 2026-11-17

### New
- **Linux (experimental).** Hyrule Tracker now has a Linux build: an **AppImage** (x86_64) next to the Windows installer. It finds saves of games run natively or through **Wine/Proton** (Steam, Lutris, Bottles, Heroic), follows the game live and updates itself like on Windows. It hasn't been tested on enough systems yet, so **please tell us how it works for you**: your distro, desktop (X11 or Wayland), how you run the game, and what worked or didn't. Open an issue on GitHub or write on the Triforce Discord.
- **9 new languages.** French, German, Italian, Dutch, Russian, Japanese, Korean, Simplified Chinese and Traditional Chinese, for 12 in total. They were translated with AI help, so corrections from native speakers are very welcome. On first start the app picks your system's language.
- **Language menu.** The language button now opens a list of every language, instead of cycling through them one by one.
- **What to do?** A new page lists what you can get right now, region by region, where you are first. Each one shows its spot on the map, photos of the place, how to get it and the items you can use.
- **View in checklist.** Map markers have a **View in checklist** button, and **View on map** opens the marker itself. Every map marker now belongs to a checklist row, with the same status.

### Improved
- **Icons everywhere.** Minigames, events, Gossip Stones and the other new rows have their own icon or game art.
- **Update window.** The changes in a new version are grouped and easier to read.
- **Completion by region.** The map shows what counts toward 100% and the map extras, overall and per region.

### Fixed
- **Portuguese names in English.** Minigame and event names now show in the language you picked.
- **Missing fairy thoughts.** The four without a photo marker now show on the map.

### Known
- **Linux: reading the game live may be blocked.** Many distros (Ubuntu, Arch and others) only let a program read another one's memory if it started it. The tracker then says so and still follows your saves; running  allows it until the next restart.
- **Linux: Wayland.** The tracker runs through XWayland so the overlay, hotkeys and game screenshot work. The overlay can't stay above a game in exclusive fullscreen or in Gamescope (Steam Deck Game Mode).
- **Linux: AppImage doesn't start on Ubuntu 24.04+.** If it closes right away with a sandbox error, start it with .

## [1.2.0] - 2026-11-17

### New
- **Play time.** The **Overview** shows how long you've played, read from your save (for example `7h 50m`). In **Live** it shows the time as of your last save. Suggested by **T3CH-M0T1V8R** from the Triforce Discord. Thank you!
- **View on map.** Chests, Gossip Stones, Big Poes, cows and grottos now have a **View on map** button that opens the map right on the spot, plus a short hint on how to get each one.
- **Zoom and pan on the maps.** Scroll to zoom, drag to move, with buttons to zoom in, out and reset.
- **Area completion.** The map page shows your completion rate per region, and a button to go back to the Hyrule map from any regional map.
- **Linked markers.** A map marker and its checklist row that watch the same save flag now tick together, including when you tick one by hand.
- **Enemy photos on the checklist.** Statues and rematch rows show the enemy photo, like the Hall of Fallen Foes.

### Improved
- **Map icons restyled** to match the tracker's look.
- **Side panel can be hidden** on the map pages to give the map more room.
- Tile captions are translated before being shortened, so names like fishing records show properly in every language.

### Fixed
- **Magic Bean Spots Planted removed.** The save doesn't record it, so the card could never fill in.

## [1.1.1] - 2026-11-17

### Fixed
- **Pinned save briefly missing.** While a pinned save was being rewritten by the game, the tracker switched to the most recent save but kept acting as if the pin were still on: Link's live position stopped, **Refresh** didn't read the game, and manual marks were saved to the wrong place and seemed to vanish. It now behaves fully as "Most recent" until the pinned save is back, then returns to it. Fix and tests by **Guih** ([Guihakka2](https://github.com/Guihakka2)). Thank you!

## [1.1.0] - 2026-11-17

### New
- **Link on the map.** A pin with a facing cone shows where Link is on the Hyrule map and on each regional and dungeon floor map. It moves in real time while **Live** reads Hookshot, Longshot, NX2navi (Triforce) or ReLink, and otherwise shows where you last saved.
- **Live tracking is always on.** With the game open, the tracker follows it right away; there's no setting to turn it on. The sidebar shows whether it's waiting for the game, looking for Link or tracking him live.
- **Follow Link switches floors.** In dungeons the regional map now follows Link between floors (and child/adult maps) on its own.
- **Big Poes defeated on the counter card.** The **Big Poes Sold** card also shows how many of the ten Hyrule Field Big Poes you've defeated.

### Improved
- **Maps fit the window.** In fullscreen or maximized windows, the Hyrule map and the regional floor maps now shrink to fit the screen height instead of growing past it.

### Fixed
- **Big Poes now detected.** The Poe Collector counts points (100 per Big Poe), so a full collection showed as "1000 of 10", and the ten Hyrule Field Big Poes stayed pending on the map and checklist even after all were sold. Both now show 10/10, and finishing the Poe Collector's bottle quest counts as at least 5 sold. Thanks to **memorialpaper** for reporting it and sharing a save that pinned down the cause.

- **Update notices work again.** The app never checked for new versions, so 1.0.0 never offered an update. From this version on, new releases show up on their own. If you're on 1.0.0, install this one by hand from the Releases page.

### Known
- If you've sold only some of the Big Poes (1 to 9), the save doesn't say which ones, so their Hyrule Field spots stay pending until all ten are sold. Mark them by hand if you want them ticked.
- The two amiibo masks (Young Link and Young Zelda) are detected from best-guess save flags and may need manual marking.
- The installer is not code-signed yet, so Windows SmartScreen may warn on first install.

## [1.0.0] - 2026-11-16

### New
- **First public release.** Live save tracking for the Ocarina of Time remake on Nintendo Switch 2, with checklist, Hyrule map, minigames, Hall of Enemies, daily log, rumor quests and daily quiz.
- **Windows installer.** Hyrule Tracker now ships as a regular `.exe` installer instead of a portable executable.
- **Automatic update check.** The app looks for new versions on GitHub, shows what changed and only downloads after you confirm.
- **PT, EN and ES.** The whole interface is available in Portuguese, English and Spanish.
- **In-game overlay** with counters, remaining objectives and what is available now.
- **Manual save folder.** If the save is not found automatically, pick the folder yourself with **Choose folder**.

### Known
- The two amiibo masks (Young Link and Young Zelda) are detected from best-guess save flags and may need manual marking.
- The installer is not code-signed yet, so Windows SmartScreen may warn on first install.
