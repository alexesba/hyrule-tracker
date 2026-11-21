# Third-party notices

## Bundled libraries

- **koffi** by Niels Martignène, MIT License (https://github.com/Koromix/koffi). Used to
  read the running game's memory through Windows' `ReadProcessMemory` (read-only).
- **qrcode-generator** by Kazuhiko Arase, MIT License (https://github.com/kazuhikoarase/qrcode-generator).
  Draws the Second Screen QR code in the app, offline. "QR Code" is a registered trademark of DENSO WAVE INCORPORATED.
- Electron, React and the build tools listed in `package.json`, under their own licenses.

## Application and images

The [Ocarina Atlas](https://github.com/antonioalvromero/Ocarina-Atlas), by antonioalvromero, supplies Hyrule and dungeon maps,
collectible coordinates, save-key mappings, location screenshots, and the map calibration, dungeon floor
heights and player-position memory chain used to draw Link on the map (`src/core/position.ts`, `src/gamedata/player.ts`). Its MIT license is included in
`docs/atlas-license.txt`. Ocarina Atlas credits the base atlas and gameplay imagery to [Nintendúo](https://www.nintenduo.com/).
Enemy renders and region images were obtained from the
[Mt. Wildwood Zelda Wiki](https://zelda.mtwildwood.net/en-gb/), with individual references in
`src/renderer/reference-images.json`. Game imagery belongs to its respective rights holders.

Inventory, collectible and HUD images were sourced from the
[Zelda Wiki Switch 2 sprite gallery](https://zeldawiki.wiki/wiki/Category:Ocarina_of_Time_(Nintendo_Switch_2)_Sprites),
its [model gallery](https://zeldawiki.wiki/wiki/Category:Ocarina_of_Time_(Nintendo_Switch_2)_Models),
and [Mt. Wildwood Zelda Wiki](https://zelda.mtwildwood.net/en-gb/items/). Original image URLs
are recorded in `src/renderer/item-images.json`. The tracker bundles resized WebP copies
for offline use.

## Save picker icons

The following original icon files identify the projects in Find saves. They are stored
in `src/renderer/public/program-icons` with the upstream GPL license text.

- [Triforce icon](https://git.triforceproject.com/triforce/source/src/commit/93eeb714c2f2d9dda543447564ee953f417b9c38/assets/triforce.png) by the Triforce contributors.
- [ReLink icon](https://github.com/pixl27/ProjectReLink/blob/30d7df16e53ef94bad59d76bbbac79e90b32e9f2/assets/relink.png) by the Project ReLink contributors.
- [Longshot icon](https://git.magicbean.dev/MagicBeanDev/LongshotLauncher/src/commit/321a9e1c47077ca02f01b919eba1ed471254da06/App/Assets/longshot.png) by the Longshot Launcher contributors. The [Hookshot icon](https://github.com/YoshiRodriguez/Longshot/blob/779bdcf4316b1c93b4551c6685f2de8fafad05d3/builder/py/hookshot_builder/assets/hookshot.png) is preserved in the Longshot source.
- [Ocarina Reborn icon](https://github.com/ocarina-pc-native-build/ocarina-pc-native-build.github.io/blob/2b6bcc252dd1ffeab8fe5796aef7aa174e1f8f67/assets/favicon.png) from the project website.
- [Lichii icon](https://github.com/zortos293/Lichii/blob/e59131404958ef0ad9ee2721df90bd16bb8f4cc5/dist/branding/lichii_icon.png) by YOB (`yobslab`), also shipped in [Fritchii's source](https://github.com/Frizti/Fritchii/blob/f66ea633db6058efe31a9611718019e5bd1667eb/dist/branding/lichii_icon.png).
- Windows icons from [Eden](https://git.eden-emu.dev/eden-emu/eden/src/commit/d85bad89248fcae68f812d7e1c937436261404cb/dist/eden.ico), [Orchid](https://github.com/MythosOfs/Orchid/blob/8fe9d7a7610c20202c6a35b369b6fa1439edd670/dist/eden.ico) and [Eglantine](https://github.com/Eglantine-Community/Eglantine/blob/e1b46769125213316265de67fdd8cfaf50f9fdc8/dist/eden.ico). [PokeDinner](https://git.eden-emu.dev/Franseven/PokeDinner-a-Eglantine-Fork/src/commit/23f383cab532bf3834ea55f3488b48841f3c727b/dist/eden.ico) ships the same icon file as Eglantine.

## References

No code from the projects below is included in this repository at this time. They were
used as references, and their mapping facts (which key hash means what) may be reused
in `data/save-mapping.json`, with credit there per entry.

## OOT-SW2SE, by Traiver — MIT License
https://github.com/Traiver/OOT-SW2SE
Reference for the GameData format and key meanings. Its key-name schema was used only to
cross-check the names this project derives from the user's own game files (1,817 shared
names, 0 conflicts).

## The Legend of Zelda: Ocarina of Time Switch 2 Save Editor, by dlr-developer — MIT License
https://github.com/dlr-developer/the-legend-of-zelda-ocarina-of-time-switch-2-save-editor
Reference for key hashes (wallets, capacity tiers, ammo, token and heart-piece counts,
stones, medallions, songs, trade items).

## Clawshot, by Kareem Albaba and the Clawshot contributors — MIT License
https://github.com/hiKareeem/Clawshot
Reference for the remake's logic in `data/logic.json`: which checks moved or need different
items than in the original game, that the clock only starts once Link has met Zelda, and how the
remake routes its dungeons. Facts only, rewritten in this project's own format; no code or data
files copied. Its object ids (game facts) also give the save keys in `data/save-mapping.json`
for Gold Skulltulas, loose heart pieces, boss heart containers and chest heart pieces (a chest's
open state is the Bool `IsTreasureBoxOpen.<object id>`, as its notes record), credited per entry.

## OoT Randomizer, by the OoTRandomizer contributors — MIT License
https://github.com/OoTRandomizer/OoT-Randomizer
The original game's requirements per check, as Clawshot translates them; the base the remake's
changes above apply to.

## Hookshot, by NotRexed — GPL-3.0
https://github.com/NotRexed/Hookshot
Save-folder discovery ideas only. No code copied (GPL-3.0 code would change this
project's license).

## Published guides (facts only, no text copied)
- Zelda Central's Ocarina of Time remake guides (https://zeldacentral.com/games/ocarina-of-time-remake/):
  the checklist's Gold Skulltula and heart piece numbering, and where each numbered one is.
- Video Games Chronicle's per-dungeon Gold Skulltula lists and Nintendo Life's heart piece guide:
  second sources for the dungeon Skulltulas and the Magic Bean heart pieces.
- IGN's Ocarina of Time Remake walkthrough (https://www.ign.com/wikis/ocarina-of-time-remake/Walkthrough)
  and its chapter and side quest pages: the order of events, routes, puzzles and bosses in the
  Walkthrough page. Each chapter in `data/walkthrough.json` names the page it was checked against.

The location descriptions in `data/descriptions.json` and the steps in `data/walkthrough.json` were
written for this project from these facts; no guide text or images are reproduced.

## Format write-ups for Tears of the Kingdom saves
General GameData container background (Murmur3 keys, typed sections).

---

## Checklist

`data/checklist.json` lists item names, numbers and areas only (game facts). Category
totals were cross-checked against several public 100% guides; no guide text is included.

---

The Legend of Zelda and Ocarina of Time are trademarks of Nintendo. Hyrule Tracker is an independent
fan project. The game executable, keys and player saves are supplied by the player's own installation.
Optional readable key-name tables are built locally and stay in gitignored folders.
