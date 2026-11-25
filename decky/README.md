# Hyrule Tracker for Decky Loader

Experimental plugin for Steam Deck Gaming Mode. The journal opens inside the quick access menu, in the same phone layout as Hyrule Tracker’s Second Screen, and **Full screen** opens it at the size of the screen. The plugin reads compatible save files on the Deck and updates when the game saves. The desktop overlay and live memory reader are outside the scope of this build.

## Install the test build

1. With Decky Loader installed, download the experimental ZIP and keep it intact.
2. In Gaming Mode, press `…` and open Decky. Enable Developer Mode under Decky Settings, then use **Install Plugin from ZIP File** in the Developer tab. Select the archive you downloaded. You can also use the URL installer with a direct link to the ZIP.
3. Open **Hyrule Tracker** from the Decky menu. The journal loads in the menu. The app looks for supported game installations automatically. Use the save picker in the tracker if you need to choose a different folder.

## What to test on a Steam Deck

1. Open the tracker in the quick access menu while the game is running. Check that the Overview, Map and Walkthrough fit the menu and respond to the directional controls and A. At the top of the journal, pressing up again reaches the **Full screen** button. In full screen, B goes back.
2. If the journal doesn't load, the menu says whether the tracker didn't start or its page didn't load, with the last lines of its log (`~/homebrew/logs/HyruleTracker/tracker.log`). **Open in the Steam browser** opens the journal without the menu. A screenshot of that message is the most useful report.
3. Confirm the tracker finds the right save and slot. If it asks for a folder, try choosing the profile folder that contains the `slot_*` folders.
4. Collect an item, save in the game, then reopen the tracker. Check that the new progress shows up.
5. If a step fails, report the SteamOS and Decky versions, the port or emulator, and which step failed. [Issue #21](https://github.com/jv-prado/hyrule-tracker/issues/21)

## Build the ZIP

Run `npm ci` and set up the images as described in the [project README](../README.md). With Docker running, install the plugin’s build dependencies with `npm --prefix decky ci` and run `npm run dist:decky` from the repository root. The archive lands in `release/` and includes its Linux x64 Node runtime.
