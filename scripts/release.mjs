// One command for a whole release: bumps the versions, commits, pushes, builds the Windows installer,
// the Linux AppImage and the Decky plugin, uploads all of them to the draft GitHub release, checks that
// nothing is missing, and publishes it.
//
//   GH_TOKEN=<token with repo access> node scripts/release.mjs 2.0.5
//
// Write the "## [2.0.5]" section of CHANGELOG.md first; it becomes the release text.
// The Decky plugin's experimental number goes up by one with every release.
// Running it again with the same version resumes: the bump and the commit are skipped, the builds run
// again, and assets already on the draft are replaced.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const version = process.argv[2];
const fail = message => { console.error('[release] ' + message); process.exit(1); };
if (!/^\d+\.\d+\.\d+$/.test(version ?? '')) fail('usage: node scripts/release.mjs <x.y.z>');
const token = process.env.GH_TOKEN;
if (!token) fail('GH_TOKEN is not set.');

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const run = (cmd, args, cwd = root) => {
  console.log('[release] > ' + [cmd, ...args].join(' '));
  const result = spawnSync(cmd, args, { cwd, stdio: 'inherit', shell: process.platform === 'win32' && cmd === npm });
  if (result.status !== 0) fail(`${cmd} ${args.join(' ')} failed`);
};
const out = (cmd, args) => spawnSync(cmd, args, { cwd: root, encoding: 'utf8' }).stdout.trim();
const readJson = file => JSON.parse(readFileSync(path.join(root, file), 'utf8'));

if (out('git', ['rev-parse', '--abbrev-ref', 'HEAD']) !== 'master') fail('release from master.');
const changelog = readFileSync(path.join(root, 'CHANGELOG.md'), 'utf8');
if (!changelog.includes(`## [${version}]`)) fail(`CHANGELOG.md has no "## [${version}]" section.`);

const current = readJson('package.json').version;
const newer = (a, b) => { const x = a.split('.').map(Number), y = b.split('.').map(Number); return x[0] - y[0] || x[1] - y[1] || x[2] - y[2]; };
if (current !== version) {
  if (newer(version, current) <= 0) fail(`${version} is not newer than ${current}.`);
  run(npm, ['run', 'typecheck']);
  run(npm, ['test']);
  run(npm, ['version', version, '--no-git-tag-version']);
  run(npm, ['version', 'prerelease', '--preid', 'experimental', '--no-git-tag-version'], path.join(root, 'decky'));
  run('git', ['add', '-A']);
  run('git', ['commit', '-m', `Release ${version}`]);
} else {
  console.log(`[release] package.json is already ${version}: resuming after the bump.`);
}
if (out('git', ['status', '--porcelain'])) fail('the working tree has uncommitted changes.');
run('git', ['push', 'origin', 'master']);

const { owner, repo } = readJson('package.json').build.publish;
const decky = readJson('decky/package.json').version;
const tag = `v${version}`;
const api = `https://api.github.com/repos/${owner}/${repo}/releases`;
const headers = { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'User-Agent': 'hyrule-tracker-release-script' };
const draft = async () => {
  const list = await fetch(`${api}?per_page=50`, { headers });
  if (!list.ok) fail(`could not list releases: ${list.status}`);
  const found = (await list.json()).find(r => r.draft && r.tag_name === tag);
  if (!found) fail(`no draft release ${tag}.`);
  return found;
};

run(process.execPath, ['scripts/ensure-release.mjs']);
run(npm, ['run', 'build']);
run(npm, ['exec', '--', 'electron-builder', '--win', 'nsis', '--publish', 'always']);
run(process.execPath, ['scripts/dist-linux.mjs', '--publish']);
run(process.execPath, ['scripts/dist-decky.mjs']);

// electron-builder does not know the Decky zip; it goes up through the API, replacing an older upload.
const zip = `Hyrule-Tracker-Decky-${decky}.zip`;
let release = await draft();
const old = release.assets.find(asset => asset.name === zip);
if (old && !(await fetch(`${api}/assets/${old.id}`, { method: 'DELETE', headers })).ok) fail(`could not replace ${zip}.`);
const upload = await fetch(`https://uploads.github.com/repos/${owner}/${repo}/releases/${release.id}/assets?name=${zip}`, {
  method: 'POST', headers: { ...headers, 'Content-Type': 'application/zip' }, body: readFileSync(path.join(root, 'release', zip)),
});
if (!upload.ok) fail(`could not upload ${zip}: ${upload.status}`);

release = await draft();
const expected = [
  `Hyrule-Tracker-Setup-${version}.exe`, `Hyrule-Tracker-Setup-${version}.exe.blockmap`, 'latest.yml',
  `Hyrule-Tracker-${version}-x86_64.AppImage`, 'latest-linux.yml', zip,
];
const missing = expected.filter(name => !release.assets.some(asset => asset.name === name && asset.state === 'uploaded'));
if (missing.length) fail('the draft is missing ' + missing.join(', ') + '; it stays a draft.');

const published = await fetch(`${api}/${release.id}`, { method: 'PATCH', headers, body: JSON.stringify({ draft: false, tag_name: tag, target_commitish: 'master' }) });
if (!published.ok) fail(`could not publish ${tag}: ${published.status}`);
console.log(`[release] ${tag} published with ${expected.length} files (Decky ${decky}): ${(await published.json()).html_url}`);
run('git', ['fetch', 'origin', '--tags']);
