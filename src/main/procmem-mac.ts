// macOS: read-only access to another process's memory, through koffi (libSystem, Mach calls).
// task_for_pid gives a task port for the process; mach_vm_read_overwrite only copies bytes out of it
// and mach_vm_region only lists its memory blocks: nothing here can write to, or otherwise change, the process.
// macOS lets a program do this only with the right to (administrator rights, or a game built with the
// get-task-allow entitlement), so a refusal is reported as MemoryAccessDenied for the window to explain.
import { execFile } from 'node:child_process';
import type { GameProcess, MemRegion } from './procmem.js';
import { MemoryAccessDenied } from './procmem-linux.js';

type Fn = (...args: unknown[]) => unknown;
let api: { mach_task_self: Fn; task_for_pid: Fn; mach_port_deallocate: Fn; mach_vm_read_overwrite: Fn; mach_vm_region: Fn; proc_pidpath: Fn } | null | undefined;

const KERN_SUCCESS = 0;
const VM_REGION_BASIC_INFO_64 = 9;
const VM_REGION_BASIC_INFO_COUNT_64 = 9; // 36 bytes of info, counted in 4-byte words
const VM_PROT_READ = 1, VM_PROT_EXECUTE = 4;
/** Memory block types, the same numbers Windows uses (see sweepRanges). */
const PRIVATE = 0x20000, MAPPED = 0x40000, IMAGE = 0x1000000;

/** Load koffi and the libSystem functions once. Call before using MacProcessMemory. */
export async function initMacMemoryAccess(): Promise<boolean> {
  if (api !== undefined) return !!api;
  if (process.platform !== 'darwin') return !!(api = null);
  try {
    const mod = await import('koffi');
    const koffi = (mod as { default?: unknown }).default ?? mod;
    api = bind(koffi);
  } catch (e) {
    console.error('koffi unavailable', e);
    api = null;
  }
  return !!api;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function bind(koffi: any) {
  const sys = koffi.load('/usr/lib/libSystem.B.dylib');
  return {
    mach_task_self: sys.func('uint32_t mach_task_self()'),
    task_for_pid: sys.func('int task_for_pid(uint32_t host, int pid, _Out_ uint32_t *task)'),
    mach_port_deallocate: sys.func('int mach_port_deallocate(uint32_t task, uint32_t name)'),
    // The destination is declared as a pointer to our own buffer (the C prototype takes its address as an integer).
    mach_vm_read_overwrite: sys.func('int mach_vm_read_overwrite(uint32_t task, uint64_t addr, uint64_t size, _Out_ uint8_t *data, _Out_ uint64_t *outsize)'),
    // The info block is read as raw bytes (36 of them) instead of a struct: protection at 0, shared at 12.
    mach_vm_region: sys.func('int mach_vm_region(uint32_t task, _Inout_ uint64_t *addr, _Out_ uint64_t *size, int flavor, _Out_ uint8_t *info, _Inout_ uint32_t *infoCount, _Out_ uint32_t *objectName)'),
    proc_pidpath: sys.func('int proc_pidpath(int pid, _Out_ uint8_t *buffer, uint32_t size)'),
  };
}

export class MacProcessMemory implements GameProcess {
  private task: number | undefined;
  constructor(readonly pid: number) {
    if (!api) throw new Error('Process memory access is not available on this system');
    const out = [0];
    const kr = api.task_for_pid(api.mach_task_self(), pid, out) as number;
    // KERN_FAILURE (5) is what macOS answers when the caller may not take the process's task port.
    if (kr === 5) throw new MemoryAccessDenied(`Not allowed to read process ${pid}`);
    if (kr !== KERN_SUCCESS) throw new Error(`Couldn't open process ${pid} for reading (Mach error ${kr})`);
    this.task = out[0];
  }
  read(addr: bigint, len: number): Buffer | null {
    if (this.task === undefined || len <= 0) return null;
    const buf = Buffer.alloc(len), got = [0n];
    // Like ReadProcessMemory: all of it or nothing (a gap in the range fails the read).
    const kr = api!.mach_vm_read_overwrite(this.task, addr, BigInt(len), buf, got) as number;
    return kr === KERN_SUCCESS && BigInt(got[0]) === BigInt(len) ? buf : null;
  }
  /** Full path of the program (e.g. /Applications/Game.app/Contents/MacOS/Game), if macOS will say. */
  imagePath(): string | undefined {
    const buf = Buffer.alloc(4096);
    const n = api!.proc_pidpath(this.pid, buf, buf.length) as number;
    return n > 0 ? buf.subarray(0, n).toString('utf8') : undefined;
  }
  /** The process's readable memory blocks. */
  regions(): MemRegion[] {
    const out: MemRegion[] = [];
    if (this.task === undefined) return out;
    let addr = 0n;
    for (;;) {
      const a = [addr], size = [0n], info = Buffer.alloc(36), count = [VM_REGION_BASIC_INFO_COUNT_64], obj = [0];
      if (api!.mach_vm_region(this.task, a, size, VM_REGION_BASIC_INFO_64, info, count, obj) !== KERN_SUCCESS) break;
      const base = BigInt(a[0]), len = BigInt(size[0]);
      const protection = info.readInt32LE(0), shared = info.readUInt32LE(12) !== 0;
      if (len > 0n && protection & VM_PROT_READ) {
        // Shared blocks count as "mapped" (where an emulator keeps guest memory), executable ones as "image".
        out.push({ base, size: len, type: shared ? MAPPED : protection & VM_PROT_EXECUTE ? IMAGE : PRIVATE });
      }
      if (len === 0n || base + len <= addr) break;
      addr = base + len;
    }
    return out;
  }
  alive(): boolean {
    if (this.task === undefined) return false;
    try { process.kill(this.pid, 0); return true; } catch (e) { return (e as NodeJS.ErrnoException).code === 'EPERM'; }
  }
  close() {
    if (this.task !== undefined) try { api!.mach_port_deallocate(api!.mach_task_self(), this.task); } catch { /* already gone */ }
    this.task = undefined;
  }
}

/** Base name of a path, lowercase, without ".app" / ".exe" ("/Applications/Game.app/Contents/MacOS/Game" is "game"). */
const programName = (p: string) => (p.split('/').pop() ?? p).toLowerCase().replace(/\.(exe|app)$/, '');

/** One process list serves every name the live search asks for in the same pass (it asks for each program in turn). */
let listing: { at: number; procs: Promise<{ pid: number; name: string }[]> } | undefined;
const LISTING_MS = 1000;

function processList(): Promise<{ pid: number; name: string }[]> {
  if (listing && Date.now() - listing.at < LISTING_MS) return listing.procs;
  const procs = new Promise<{ pid: number; name: string }[]>((resolve, reject) => {
    // ps shows the full program path in "comm" on macOS; pid first so a path with spaces stays whole.
    execFile('/bin/ps', ['-axo', 'pid=,comm='], { timeout: 5000, maxBuffer: 8 << 20 }, (err, out) => {
      if (err) return reject(new Error(`ps failed: ${err.message}`));
      const list: { pid: number; name: string }[] = [];
      for (const line of String(out).split('\n')) {
        const m = /^\s*(\d+)\s+(.+)$/.exec(line);
        if (m && Number(m[1]) !== process.pid) list.push({ pid: Number(m[1]), name: programName(m[2]) });
      }
      resolve(list);
    });
  });
  listing = { at: Date.now(), procs };
  procs.catch(() => { listing = undefined; });
  return procs;
}

/** Process ids of running programs with this name (e.g. "nxnative"; a ".exe" on the name is ignored). */
export async function findMacProcesses(image: string): Promise<number[]> {
  if (process.platform !== 'darwin') return [];
  const want = programName(image);
  return (await processList()).filter(p => p.name === want).map(p => p.pid);
}
