import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { build } from 'esbuild';

const root = fileURLToPath(new URL('../', import.meta.url));
const types = { '.html': 'text/html', '.mjs': 'text/javascript', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.svg': 'image/svg+xml', '.wasm': 'application/wasm' };
const port = Number(process.env.PORT || 5173);
const atlasModule = await import('../HybridCampaign/server/atlas-preview-host.ts');
const { createAtlasPreviewHost } = atlasModule.default ?? atlasModule;
const hybridCampaign = await createAtlasPreviewHost(root);
const bundle = await build({
  entryPoints: [path.join(root, 'preview/app.jsx')], bundle: true, write: false,
  format: 'esm', jsx: 'automatic',
  loader: { '.ts': 'ts', '.tsx': 'tsx', '.css': 'text', '.json': 'json' },
  define: { 'import.meta.env.VITE_HOSTED_MODE': '"false"' },
  plugins: [{ name: 'local-auth', setup(builder) {
    builder.onResolve({ filter: /^\.\.\/\.\.\/utils\/auth$/ }, () => ({ path: path.join(root, 'preview/auth.mjs') }));
  } }],
});
const bridge = `<script>
  const mockFetch = parent.createPreviewFetch();
  const originalFetch = window.fetch.bind(window);
  window.fetch = (input, options = {}) => {
    const url = new URL(typeof input === 'string' ? input : input.url || input.href, document.baseURI);
    if (url.pathname.startsWith('/pyrrhic-war/') || url.pathname.startsWith('/expedition/')) return mockFetch(url.href, options);
    return originalFetch(input, options);
  };
</script>`;
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
    if (name === '/preview/app.bundle.js') {
      res.writeHead(200, { 'Content-Type': 'text/javascript', 'Cache-Control': 'no-store' }).end(bundle.outputFiles[0].text); return;
    }
    if (name === '/' || name.startsWith('/projects')) name = '/preview/index.html';
    name = name.replace(/^\/games\/(PyrrhicWar|Expedition)\//, '/$1/');
    const assetPrefix = '/hybrid-campaign/assets/';
    const target = name.startsWith(assetPrefix)
      ? path.resolve(root, 'HybridCampaign', 'public', name.slice(assetPrefix.length))
      : path.resolve(root, '.' + name);
    const relative = path.relative(root, target);
    const isHybridAsset = name.startsWith(assetPrefix) && !relative.startsWith('..') && !path.isAbsolute(relative) && relative.startsWith(`HybridCampaign${path.sep}public${path.sep}`);
    if (relative.startsWith('..') || path.isAbsolute(relative) ||
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
