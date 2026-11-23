# Hyrule Tracker for Decky Loader

Experimental plugin for Steam Deck Gaming Mode. The Decky menu opens the same responsive interface as Hyrule Tracker’s Second Screen. The plugin reads compatible save files on the Deck and updates when the game saves. The desktop overlay and live memory reader are outside the scope of this build.

## Install the test build

1. With Decky Loader installed, download the experimental ZIP and keep it intact.
2. In Gaming Mode, press `…` and open Decky. Enable Developer Mode under Decky Settings, then use **Install Plugin from ZIP File** in the Developer tab. Select the archive you downloaded. You can also use the URL installer with a direct link to the ZIP.
3. Open **Hyrule Tracker** from the Decky menu and select **Open Hyrule Tracker**. The app looks for supported game installations automatically. Use the save picker in the tracker if you need to choose a different folder.

## What to test on a Steam Deck

1. Open the tracker while the game is running. Check that the Overview, Map and Walkthrough fit the screen and respond to the directional controls, A and B.
2. Confirm the tracker finds the right save and slot. If it asks for a folder, try choosing the profile folder that contains the `slot_*` folders.
3. Collect an item, save in the game, then reopen the tracker. Check that the new progress shows up.
4. If a step fails, report the SteamOS and Decky versions, the port or emulator, and which step failed. [Issue #21](https://github.com/jv-prado/hyrule-tracker/issues/21)

## Build the ZIP

Run `npm ci` and set up the images as described in the [project README](../README.md). With Docker running, install the plugin’s build dependencies with `npm --prefix decky ci` and run `npm run dist:decky` from the repository root. The archive lands in `release/` and includes its Linux x64 Node runtime.
