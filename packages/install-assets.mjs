#!/usr/bin/env node
import { copyFile, mkdir, readdir, readFile, realpath } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const assets = new URL('./assets/', import.meta.url);
const { gameDirectory } = JSON.parse(await readFile(new URL('./package.json', import.meta.url), 'utf8'));

export async function installAssets(publicDirectory) {
  const destination = resolve(publicDirectory, 'games', gameDirectory);
  await mkdir(destination, { recursive: true });
  for (const name of await readdir(assets)) {
    await copyFile(new URL(name, assets), resolve(destination, name));
  }
  return destination;
}

if (process.argv[1] && await realpath(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const destination = await installAssets(process.argv[2] ?? 'public');
  console.log(`Installed ${gameDirectory} assets in ${destination}.`);
}
