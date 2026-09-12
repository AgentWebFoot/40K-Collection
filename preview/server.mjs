import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { build } from 'esbuild';

const root = fileURLToPath(new URL('../', import.meta.url));
const types = { '.html': 'text/html', '.mjs': 'text/javascript', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif' };
const port = Number(process.env.PORT || 5173);
const bundle = await build({
  entryPoints: [path.join(root, 'preview/app.jsx')], bundle: true, write: false,
  format: 'esm', jsx: 'automatic',
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
    if (name === '/preview/app.bundle.js') {
      res.writeHead(200, { 'Content-Type': 'text/javascript', 'Cache-Control': 'no-store' }).end(bundle.outputFiles[0].text); return;
    }
    if (name === '/' || name.startsWith('/projects')) name = '/preview/index.html';
    name = name.replace(/^\/games\/(PyrrhicWar|Expedition)\//, '/$1/');
    const target = path.resolve(root, '.' + name);
    const relative = path.relative(root, target);
    if (relative.startsWith('..') || path.isAbsolute(relative) ||
        !/^(preview|PyrrhicWar|Expedition)[\\/]/.test(relative) || !types[path.extname(target).toLowerCase()]) {
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
