import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {publicContent} from '../src/content-model.mjs';
const root = fileURLToPath(new URL('../dist/client/', import.meta.url));
assert.deepEqual(readdirSync(root).sort(), ['.nojekyll', 'THIRD-PARTY-NOTICES.txt', 'assets', 'index.html']);
const html = readFileSync(path.join(root, 'index.html'), 'utf8');
for (const [, url] of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
  assert.ok(url.startsWith('./assets/'), `Expected a relative asset path: ${url}`);
  assert.ok(existsSync(path.join(root, url)));
  const page = new URL('https://example.github.io/portfolio/');
  assert.ok(new URL(url, page).pathname.startsWith('/portfolio/assets/'));
}
for (const file of ['campus-main.png','campus-a.png','campus-b.png','form-preview.png','flow-preview.png']) assert.ok(existsSync(path.join(root,'assets',file)));
for (const file of readdirSync(path.join(root,'assets'))) {
  assert.ok(!file.endsWith('.map'), 'Source maps must stay out of the public package');
  if (file.endsWith('.css')) assert.ok(!readFileSync(path.join(root,'assets',file),'utf8').includes('/assets/notebook-gray.png'));
}
const javascript=readdirSync(path.join(root,'assets')).filter(f=>f.endsWith('.js')).map(f=>readFileSync(path.join(root,'assets',f),'utf8')).join('\n');
assert.ok(!javascript.includes('/__makelog/editor')&&!javascript.includes('__makelog/editor'),'Development write URLs must not ship');
const source=JSON.parse(readFileSync(new URL('../src/content/site.json',import.meta.url),'utf8'));
publicContent(source); // The same schema and contrast requirements apply to the public build.
for(const article of source.articles.filter(a=>a.status==='draft'))assert.ok(!javascript.includes(article.id),'Draft article IDs must not ship');
assert.ok(!existsSync(path.join(root,'.pages.yml'))&&!existsSync(path.join(root,'src')),'CMS/source configuration stays outside the static site');
console.log('Static package verified: relative paths, five approved illustrations, no design drafts or source maps.');
