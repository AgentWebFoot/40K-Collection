import http from 'node:http';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { context } from 'esbuild';
import { expeditionDataDirectory, initializeExpeditionData, openExpeditionStorage } from './expedition-storage.mjs';
import { createPreviewService } from './service.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const compendiumStyles = createRequire(import.meta.url).resolve('compendium/styles.css');
const types = { '.html': 'text/html', '.mjs': 'text/javascript', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.svg': 'image/svg+xml', '.wasm': 'application/wasm' };
const port = Number(process.env.PORT || 5173);
initializeExpeditionData();
const appBuild = await context({
  entryPoints: [path.join(root, 'preview/app.jsx')], bundle: true, write: false,
  format: 'esm', jsx: 'automatic',
  loader: { '.ts': 'ts', '.tsx': 'tsx', '.css': 'text', '.json': 'json' },
  define: { 'import.meta.env.VITE_HOSTED_MODE': '"false"' },
  plugins: [{ name: 'local-auth', setup(builder) {
    builder.onResolve({ filter: /^\.\.\/\.\.\/utils\/auth$/ }, () => ({ path: path.join(root, 'preview/auth.mjs') }));
  } }],
});
await appBuild.rebuild();
if (process.argv.includes('--build')) {
  await appBuild.dispose();
  console.log(`Preview build verified. Expedition saves use ${expeditionDataDirectory}.`);
}

const bridge = `<script>
  const mockFetch = parent.createPreviewFetch();
  const originalFetch = window.fetch.bind(window);
  window.fetch = (input, options = {}) => {
    const url = new URL(typeof input === 'string' ? input : input.url || input.href, document.baseURI);
    if (url.pathname.startsWith('/pyrrhic-war/') || url.pathname.startsWith('/expedition/')) return mockFetch(url.href, options);
    return originalFetch(input, options);
  };
</script>`;
if (!process.argv.includes('--build')) {
  const atlasModule = await import('../HybridCampaign/server/atlas-preview-host.ts');
  const { createAtlasPreviewHost } = atlasModule.default ?? atlasModule;
  const hybridCampaign = await createAtlasPreviewHost(root);
  serve(createPreviewService(openExpeditionStorage()), hybridCampaign);
}

async function readRequest(req) {
  const chunks = [];
  let length = 0;
  for await (const chunk of req) {
    length += chunk.length;
    if (length > 24 * 1024 * 1024) throw new Error('Preview request is too large.');
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function serve(previewRequest, hybridCampaign) {
  http.createServer(async (req, res) => {
  try {
    let name = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (name.startsWith('/hybrid-campaign/api/')) {
      // Await the TypeScript campaign host. Node's HTTP server does not await
      // an async request listener on its own; doing it here guarantees every
      // API request either writes its JSON response or receives a useful
      // JSON failure instead of an empty body.
      try {
        await hybridCampaign.handle(req, res);
        if (!res.writableEnded) {
          res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
          res.end(JSON.stringify({ error: 'The Hybrid Campaign preview did not complete this request.' }));
        }
      } catch (error) {
        if (!res.writableEnded) {
          res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
          res.end(JSON.stringify({ error: error instanceof Error ? error.message : 'The Hybrid Campaign preview failed to process this request.' }));
        }
      }
      return;
    }
    if (name === '/preview/api' && req.method === 'POST') {
      const host = req.headers.host;
      const allowedHosts = [`127.0.0.1:${port}`, `localhost:${port}`];
      if (!allowedHosts.includes(host) || (req.headers.origin && req.headers.origin !== `http://${host}`)
        || !req.headers['content-type']?.startsWith('application/json')) {
        res.writeHead(403).end();
        return;
      }
      try {
        const { status, ...result } = await previewRequest(await readRequest(req));
        res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }).end(JSON.stringify(result));
      } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json' }).end(JSON.stringify({ payload: { message: error.message } }));
      }
      return;
    }
    // The bundled reader resolves its shadow-root stylesheet beside the bundle.
    if (name === '/preview/styles.css') {
      const stylesheet = await readFile(compendiumStyles);
      res.writeHead(200, { 'Content-Type': 'text/css', 'Cache-Control': 'no-store' }).end(stylesheet);
      return;
    }
    if (name === '/preview/app.bundle.js') {
      try {
        const bundle = await appBuild.rebuild();
        res.writeHead(200, { 'Content-Type': 'text/javascript', 'Cache-Control': 'no-store' }).end(bundle.outputFiles[0].text);
      } catch (error) {
        console.error('Unable to rebuild the preview:', error);
        res.writeHead(500, { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' }).end('Unable to rebuild the preview. See the server console.');
      }
      return;
    }
    if (name === '/games/PyrrhicWar/PyrrhicWarCompendium.html' || name === '/PyrrhicWar/PyrrhicWarCompendium.html') {
      res.writeHead(302, { Location: '/projects/PyrrhicWarCompendium' }).end();
      return;
    }
    if (name === '/' || name.startsWith('/projects')) name = '/preview/index.html';
    name = name.replace(/^\/games\/(PyrrhicWar|Expedition)\//, '/$1/');
    const assetPrefix = '/hybrid-campaign/assets/';
    const target = name.startsWith(assetPrefix)
      ? path.resolve(root, 'HybridCampaign', 'public', name.slice(assetPrefix.length))
      : path.resolve(root, '.' + name);
    const relative = path.relative(root, target);
    const isHybridAsset = name.startsWith(assetPrefix) && relative.startsWith(`HybridCampaign${path.sep}public${path.sep}`);
    const fromData = path.relative(expeditionDataDirectory, target);
    if (relative.startsWith('..') || path.isAbsolute(relative) ||
        (!fromData.startsWith('..') && !path.isAbsolute(fromData)) ||
        !(isHybridAsset || /^(preview|PyrrhicWar|Expedition)[\\/]/.test(relative)) || !types[path.extname(target).toLowerCase()]) {
      res.writeHead(404).end(); return;
    }
    let data = await readFile(target);
    if (/^\/(PyrrhicWar|Expedition)\//.test(name) && name.endsWith('.html')) data = data.toString().replace(/<head>/i, `<head>${bridge}`);
    res.writeHead(200, { 'Content-Type': types[path.extname(target).toLowerCase()], 'Cache-Control': 'no-store' });
    res.end(data);
  } catch {
    res.writeHead(404).end('File not found');
  }
  }).listen(port, '127.0.0.1', () => console.log(`Collection preview: http://127.0.0.1:${port}`));
}
