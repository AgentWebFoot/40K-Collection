import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = join(root, 'dist', 'game-packages');
const [version = '0.1.0'] = process.argv.slice(2);
if (!/^\d+\.\d+\.\d+(?:-[\w.-]+)?$/.test(version)) throw new Error('Specify a package version such as 0.1.0.');
await mkdir(output, { recursive: true });
const stage = await mkdtemp(join(tmpdir(), 'expedition-backend-package-'));
try {
  await build({
    entryPoints: [join(root, 'packages', 'expedition-backend.mjs')],
    outfile: join(stage, 'index.mjs'), bundle: true, platform: 'node', format: 'esm', target: 'node20',
  });
  await writeFile(join(stage, 'package.json'), JSON.stringify({
    name: '@agentwebfoot/expedition-backend', version, private: true, type: 'module',
    engines: { node: '>=20' }, exports: './index.mjs', files: ['index.mjs'],
  }, null, 2) + '\n');
  execFileSync(process.execPath, [process.env.npm_execpath, 'pack', '--ignore-scripts',
    '--pack-destination', output], { cwd: stage, stdio: 'inherit' });
} finally {
  await rm(stage, { recursive: true, force: true });
}
