// error.log in the user data folder: what users can send when something goes wrong.
import fs from 'node:fs';
import path from 'node:path';

export function logError(userData: string, where: string, e: unknown) {
  const line = `[${new Date().toISOString()}] ${where}: ${e instanceof Error ? e.stack ?? e.message : String(e)}\n`;
  try { fs.appendFileSync(path.join(userData, 'error.log'), line); } catch { /* ignore */ }
  console.error(line);
}
