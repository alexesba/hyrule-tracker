# progress.sav format (GameData container)

Worked out from six real saves (Hookshot v2.0.14, GameDataList revision 110).
Parser: `src/gamedata/parser.ts`. Every statement below is checked by the parser's
layout check: each value must end exactly where the next begins, up to end of file.
All 14 local save files (6 × progress.sav, 6 × caption.sav, option.sav, account.sav)
decode with zero warnings.

## Header

| Offset | Type | Value | Meaning |
|---|---|---|---|
| 0x00 | u32 | 0x01020304 | magic |
| 0x04 | u32 | 0x002D80EB | format version |
| 0x08 | u32 | 0x000175D8 | end of record table = start of data area. Matches `MetaData.SaveDataOffsetPos[0]` (95704) in the game's GameDataList |
| 0x0C–0x27 | — | 0 | unused |

## Record table (0x28 → data start)

8-byte records: `u32 hash, u32 value`, little-endian.

- Records are **grouped by type**. A record with hash `0` starts a section, and its
  value is the **type id** of the records that follow. The first section (Bool, id 0)
  has no separator. Empty sections appear as runs of separators.
- Hashes are **Murmur3 x86_32, seed 0** of the key name. Confirmed: enum values in the
  GameDataList are hashes of their names (`murmur3("AttackByWeapon") = 0xB58C29C3`).

| id | type | stored as |
|---|---|---|
| 0 | Bool | inline (0/1) |
| 1 | BoolArray | offset → `u32 bitCount`, bits packed in u32 words |
| 2 | Int | inline s32 |
| 3 | IntArray | offset → `u32 count`, count × s32 |
| 4 | Float | inline f32 |
| 5 | FloatArray | offset → count + f32s |
| 6 | Enum | inline u32 = murmur3(value name) |
| 7 | EnumArray | offset → count + u32 hashes |
| 8 / 9 | Vector2 / Array | (none in these saves) |
| 10 | Vector3 | offset → 3 × f32 |
| 11 | Vector3Array | (none) |
| 12 / 13 | String16 / Array | (none) |
| 14 | String32 | offset → 32 bytes, NUL-padded |
| 15 | String32Array | (none) |
| 16 | String64 | offset → 64 bytes |
| 17 | String64Array | offset → count + 64-byte strings |
| 18 | Binary | offset → `u32 size` + bytes |
| 19 | BinaryArray | offset → count, then per element `u32 size` + bytes (only empty elements seen) |
| 20 | UInt | inline u32 |
| 21 | UIntArray | offset → count + u32s |
| 22 | Int64 | offset → s64 |
| 23 | Int64Array | (none) |
| 24 | UInt64 | offset → u64 |
| 25 | UInt64Array | offset → count + u64s |
| 26–31 | WString16/32/64 (+Array) | UTF-16LE, 32/64/128 bytes per string |
| 32 | Bool64bitKey | single record; offset → sorted list of u64 keys to end of file. **Only keys that are set are stored.** Offset 0 = none. A trailing 0 key is padding. |

## Counts (identical in all six progress.sav files)

11,925 keys: 10,212 Bool, 1,144 Int, 155 IntArray, 101 Enum, 87 UInt, 76 Float, …
These match the GameDataList entries with `SaveFileIndex = 0` exactly.
104–109 Bool64bitKey flags are set, depending on the slot.

## caption.sav

Same container, 46 keys, data at 0x2A0. Contains a JPEG thumbnail (Binary, `FF D8 …`)
and area strings such as `"Market"` / `"Market/Market_Adult"` (String64), usable as the
slot's location label.

## Uncertain

- The one String32 key starts with a NUL byte followed by text (`\0okiriForest_Adult`).
  It's decoded as-is and shown with a leading `\0`. Its meaning is unknown.
- BinaryArray elements: only empty ones seen, so the per-element layout is a guess
  (but consistent with the layout check).
- The 64-bit keys (Bool64bitKey) can't be named yet. In TotK these are per-object
  flags (hash of map/object ids). They change when collecting things (for example
  `0x3F93661D8E17C1D0` was set together with getting Prelude of Light), so they'll be
  mapped by diffing.

## Names

`npm run sav -- names <romfs>` decompresses the RomFS (zstd with the game's own
dictionaries from `Pack/ZsDic.pack.zs`), harvests identifier strings from logic, event
and parameter files and the ExeFS, and keeps the ones whose Murmur3 hash is a save key.
Compound names (`IsGet.<actor>`, `PouchData.<actor>.StockNum`, `<Dungeon>.SmallKeyNum`)
are built from parts already found. The result goes to `local/names.json` (gitignored).
All 1,817 names that also appear in the OOT-SW2SE schema agree with it.

## Totals in progress.sav: jumps, rolls, sword swings

Found by [Kabosune](https://github.com/Kabosune/oot-remake-modding/blob/main/docs/zelda-notes.md)
with a save diff (4 jumps, 5 sword swings and 6 rolls, nothing else, in one slot). Each slot
keeps them as **Int64** fields; the names are unknown, so the tracker uses the hashes.

| Hash | Type | Meaning |
|---|---|---|
| `0xA6454431` | Int64 | jumps |
| `0x4AC3FF5D` | Int64 | rolls |
| `0x2A24450A` | Int64 | sword swings |

Checked here on 12 local saves from two save folders (game 1.1.1): all three are present in
every slot with plausible, close values across the slots of one game (for example 1,454 to 1,457
jumps). The diff itself was not repeated here. The tracker shows them on "My play data". Live, they come from the game's Int64 table
([live-memory.md](live-memory.md)), which the tracker already reads; that path was not checked
with the game running.

## option.sav: the game's play log

Also found and documented by Kabosune (the data behind Zelda Notes' "Today's Record"; the game
writes it whether or not Zelda Notes is set up). `option.sav` sits next to the `slot_NN` folders,
one per user, so the log covers every slot.

| Hash | Type | Meaning |
|---|---|---|
| `0x5392E233` | Binary | events: 1,024 entries of 24 bytes, a ring buffer |
| `0x25418E68` | Int | the next slot to write (the oldest entry once the ring is full) |
| `0xE110CEB6` | Int | entries in use (at most 1,024) |
| `0x3C99C416` | Binary | position trail: 1,024 × 16 bytes (not used by the tracker) |
| `0x9B03CB4F` / `0xC2A3144C` | Int | the trail's next slot and count |

Each event is `{u32 time, u32 kind, u32 name1, u32 name2, s32 value1, s32 value2}`, little-endian.
The time is seconds since 1 January 2026, UTC. Actor names are **CRC32** of the actor name
(`Player_Child`, `Enemy_Stalchild`, `Item_Melody_SunSong`); scene and event names are **Murmur3**
(`HyruleField_Child`, `Dm_SY_Ocarina`).

The tracker reads these kinds (Kabosune's table has the rest):

| Kind | Event | Fields used |
|---|---|---|
| 1 | Link hurt | value2 = damage in quarter hearts |
| 3 | enemy defeated | name1 = who defeated it, name2 = the enemy |
| 17 | a file loaded | |
| 25 | area change | name1 = from, name2 = to (scenes) |
| 30 | a song played | name1 = `Item_Melody_*` |

Checked here on 7 local `option.sav` files (game 1.1.1; two save folders, five of the files are
earlier backups of one of them, so their logs overlap):

- The layout check passes; both Binary fields have the sizes above, and the count was 1,024 in all.
- Read from the next slot, the times never go back.
- Every area change starts in the scene the previous one ended in (31 of 31).
- Every kind 1 damage matched the drop in life of the next kind 39 entry (22 of 22).
- With the names the tracker ships (enemy statues, chest items, the 13 songs, the checklist areas),
  every song in these logs resolved, and every scene but one (`0x9EE9BA59`). Scenes without a
  checklist area (houses, shops) and enemies without a statue are shown as "other places" /
  "unidentified". A local `names.json` adds more actor names.
- The defeated entries come from `Player_Child` (129 of 134), from an enemy that takes others with
  it (a Peahat and its larvae, 2) or from 0 (3). The tracker counts all but the enemy ones. No kill
  in these logs is by adult Link, so the name `Player_Adult` is assumed.

How the tracker uses it ("Today's record"): per local day, enemies defeated by name, damage taken,
songs played and an approximate time per area. The time between two entries goes to the area Link
is in; gaps over 5 minutes are breaks; after a file loads the area is taken from the next area
change's "from". 1,024 entries are not much: one test log covered 51 minutes (lots of talk and
Z-targeting), another 10 hours. The page says which span the log covers.

Not used: kind 26 (the game saved), kind 37 (hurt by the world; "likely" in Kabosune's table), kind 39
(life and magic) and
the position trail.
