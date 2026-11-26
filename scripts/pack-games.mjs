import { execFileSync } from 'node:child_process';
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const require = createRequire(import.meta.url);
const root = fileURLToPath(new URL('../', import.meta.url));
const output = join(root, 'dist', 'game-packages');
const projects = {
  expedition: {
    directory: 'Expedition',
    files: ['ExpeditionMap.html', 'ExpeditionMap.gif', 'point-rewards.js'],
  },
  'pyrrhic-war': {
    directory: 'PyrrhicWar',
    files: ['40kCrusadeBoard.html', 'PyrrhicWarMap.png'],
  },
};
const [target = 'all', version = '0.1.0'] = process.argv.slice(2);
const names = target === 'all' ? Object.keys(projects) : [target];
if (names.some(name => !Object.hasOwn(projects, name)) || !/^\d+\.\d+\.\d+(?:-[\w.-]+)?$/.test(version)) {
  throw new Error('Choose all, expedition, or pyrrhic-war and supply a version such as 0.1.0.');
}

const readerScript = require.resolve('compendium/browser');
const readerStyles = require.resolve('compendium/styles.css');
const defaultStyleUrl = 'new URL("./styles.css", import.meta.url)';

await mkdir(output, { recursive: true });
for (const name of names) {
  const { directory, files } = projects[name];
  const stage = await mkdtemp(join(tmpdir(), '40k-game-package-'));
  try {
    const assets = join(stage, 'assets');
    await mkdir(assets);
    await Promise.all([
      ...files.map(file => copyFile(join(root, directory, file), join(assets, file))),
      ...['compendium-theme.css', 'compendium-page.css'].map(file =>
        copyFile(join(root, 'preview', file), join(assets, file))),
      copyFile(readerStyles, join(assets, 'compendium-reader.css')),
      copyFile(join(root, 'packages', 'install-assets.mjs'), join(stage, 'install-assets.mjs')),
    ]);
    await build({
      entryPoints: [join(root, 'packages', `${name}.jsx`)],
      outfile: join(stage, 'index.mjs'),
      platform: 'browser',
      format: 'esm',
      jsx: 'automatic',
      bundle: true,
      external: ['react', 'react-dom', 'react-router-dom'],
      plugins: [{
        name: 'game-host',
        setup(builder) {
          builder.onResolve({ filter: /^\.\.\/\.\.\/utils\/auth$/ }, () => ({
            path: join(root, 'packages', 'host.mjs'),
          }));
          builder.onLoad({ filter: /[\\/]compendium[\\/]src[\\/]browser[\\/]index\.js$/ }, async ({ path }) => {
            if (path !== readerScript) return;
            const source = await readFile(path, 'utf8');
            if (!source.includes(defaultStyleUrl)) {
              throw new Error('Update the packaged Compendium stylesheet URL for this Compendium version.');
            }
            return { contents: source.replace(defaultStyleUrl,
              `new URL("/games/${directory}/compendium-reader.css", document.baseURI)`) };
          });
        },
      }],
    });
    const manifest = {
      name: `@agentwebfoot/${name}`,
      version,
      private: true,
      type: 'module',
      gameDirectory: directory,
      exports: { '.': './index.mjs', './install-assets': './install-assets.mjs' },
      bin: { [`${name}-assets`]: './install-assets.mjs' },
      files: ['index.mjs', 'install-assets.mjs', 'assets'],
      peerDependencies: { react: '^18.0.0', 'react-dom': '^18.0.0', 'react-router-dom': '^6.30.0 || ^7.0.0' },
    };
    await writeFile(join(stage, 'package.json'), `${JSON.stringify(manifest, null, 2)}\n`);
    execFileSync(process.execPath, [process.env.npm_execpath, 'pack', '--ignore-scripts',
      '--pack-destination', output], { cwd: stage, stdio: 'inherit' });
  } finally {
    await rm(stage, { recursive: true, force: true });
  }
}
