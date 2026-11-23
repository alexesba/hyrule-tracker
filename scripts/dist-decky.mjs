import { spawnSync } from 'node:child_process';
import { copyFileSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = fileURLToPath(new URL('../', import.meta.url));
const decky = path.join(root, 'decky');
const readJson = file => JSON.parse(readFileSync(file, 'utf8'));
const plugin = readJson(path.join(decky, 'package.json'));
const tracker = readJson(path.join(root, 'package.json'));
const archive = `Hyrule-Tracker-Decky-${plugin.version}.zip`;
const release = path.join(root, 'release');
const tempRoot = realpathSync(tmpdir());
const stage = mkdtempSync(path.join(tempRoot, 'hyrule-decky-'));
const bundle = path.join(stage, 'HyruleTracker');

function run(cmd, args, cwd = root) {
  const result = spawnSync(cmd, args, { cwd, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${path.basename(cmd)} exited with ${result.status ?? result.signal}`);
}

const pack = `import sys
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED

root = Path('/stage/HyruleTracker')
target = Path('/out') / sys.argv[1]
temporary = target.with_suffix('.zip.tmp')
with ZipFile(temporary, 'w', compression=ZIP_DEFLATED, compresslevel=6) as archive:
    for file in sorted(root.rglob('*')):
        if file.is_file():
            archive.write(file, file.relative_to(root.parent))
with ZipFile(temporary) as archive:
    node = archive.getinfo('HyruleTracker/bin/node')
    if not (node.external_attr >> 16) & 0o111:
        raise ValueError('The bundled Node runtime is not executable')
temporary.replace(target)
`;

try {
  const deckyRollup = path.join(decky, 'node_modules', 'rollup', 'dist', 'bin', 'rollup');
  if (!existsSync(deckyRollup)) throw new Error('Install the Decky build dependencies with npm --prefix decky ci.');
  run(process.execPath, [deckyRollup, '-c'], decky);
  await build({
    absWorkingDir: root, entryPoints: ['src/main/decky-server.ts'], outfile: path.join(bundle, 'server.mjs'),
    bundle: true, format: 'esm', platform: 'node', target: 'node22', external: ['koffi'],
  });
  const ui = path.join(bundle, 'ui');
  run(process.execPath, [path.join(root, 'node_modules/vite/bin/vite.js'), 'build', '--outDir', ui]);
  for (const folder of ['atlas', 'items', 'reference']) {
    if (!existsSync(path.join(ui, 'images', folder))) throw new Error(`Missing ${folder} images. See README.md for the image setup.`);
  }
  const stageData = path.join(bundle, 'data');
  mkdirSync(stageData, { recursive: true });
  for (const file of ['atlas', 'checklist', 'companion', 'descriptions', 'easter-eggs', 'logic', 'save-mapping', 'world-markers']) {
    copyFileSync(path.join(root, 'data', file + '.json'), path.join(stageData, file + '.json'));
  }
  cpSync(path.join(decky, 'dist'), path.join(bundle, 'dist'), { recursive: true, filter: file => !file.endsWith('.map') });
  for (const file of ['main.py', 'plugin.json', 'README.md']) copyFileSync(path.join(decky, file), path.join(bundle, file));
  for (const file of ['LICENSE', 'THIRD_PARTY_NOTICES.md']) copyFileSync(path.join(root, file), path.join(bundle, file));
  copyFileSync(path.join(root, 'docs', 'atlas-license.txt'), path.join(bundle, 'atlas-license.txt'));
  // Decky Loader imports dist/index.js as an ES module only when package.json says "type": "module".
  // Without it, the loader evaluates the bundle as a legacy script and fails on its `export`.
  writeFileSync(path.join(bundle, 'package.json'), JSON.stringify({
    name: plugin.name, version: plugin.version, type: 'module', trackerVersion: tracker.version, author: tracker.author, license: tracker.license,
  }, null, 2) + '\n');

  mkdirSync(release, { recursive: true });
  mkdirSync(path.join(bundle, 'bin'));
  writeFileSync(path.join(stage, 'pack.py'), pack);
  const bind = (dir, dest) => `${dir.replaceAll('\\', '/')}:${dest}`;
  run('docker', ['run', '--rm', '--network', 'none', '--platform', 'linux/amd64',
    '-v', bind(stage, '/stage'), '-v', bind(release, '/out'), 'node:22-bookworm', 'sh', '-ec',
    'cp /usr/local/bin/node /stage/HyruleTracker/bin/node && chmod 755 /stage/HyruleTracker/bin/node && cp /usr/local/LICENSE /stage/HyruleTracker/NODE-LICENSE && python3 /stage/pack.py "$1"',
    'decky-package', archive]);
  console.log(path.join(release, archive));
} finally {
  if (path.dirname(path.resolve(stage)) === tempRoot && path.basename(stage).startsWith('hyrule-decky-')) {
    rmSync(stage, { recursive: true, force: true });
  }
}
