// Read-only access to a running game's memory: Windows (kernel32 through koffi), Linux (/proc) or macOS (Mach calls through koffi).
// Picks the system's implementation; everything above this file is the same on all of them.
import type { Mem } from '../gamedata/live.js';
import { WindowsProcessMemory, findWindowsProcesses, initWindowsMemoryAccess } from './procmem-win.js';
import { LinuxProcessMemory, findLinuxProcesses } from './procmem-linux.js';
import { MacProcessMemory, findMacProcesses, initMacMemoryAccess } from './procmem-mac.js';

/** The system refused to let the tracker read the game (on Linux: ptrace rules; on macOS: task_for_pid). */
export { MemoryAccessDenied } from './procmem-linux.js';

/** A committed, readable block of the process's memory. type: 0x20000 private, 0x40000 mapped, 0x1000000 image. */
export interface MemRegion { base: bigint; size: bigint; type: number }

/** A running game, opened for reading only. */
export interface GameProcess extends Mem {
  readonly pid: number;
  /** Full path of the program (e.g. D:\Games\Longshot\hookshot.exe), if the system will say. */
  imagePath(): string | undefined;
  /** Where the game keeps %APPDATA% when it isn't the tracker's own (a Wine/Proton prefix on Linux). */
  appData?(): string | undefined;
  /** The process's committed, readable memory blocks. */
  regions(): MemRegion[];
  alive(): boolean;
  close(): void;
}

const linux = process.platform === 'linux';
const mac = process.platform === 'darwin';

/** Load what reading memory needs, once. False when this system can't. */
export async function initMemoryAccess(): Promise<boolean> {
  if (linux) return true;
  if (mac) return initMacMemoryAccess();
  return initWindowsMemoryAccess();
}

export function openProcess(pid: number): GameProcess {
  return linux ? new LinuxProcessMemory(pid) : mac ? new MacProcessMemory(pid) : new WindowsProcessMemory(pid);
}

/** Process ids of running programs with this image name (e.g. "hookshot.exe"; on Linux also a native build without ".exe"). */
export function findProcesses(image: string): Promise<number[]> {
  return linux ? findLinuxProcesses(image) : mac ? findMacProcesses(image) : findWindowsProcesses(image);
}
