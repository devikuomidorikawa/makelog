import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {publicContent,PROJECT_IMAGE_FILES} from '../src/content-model.mjs';
import {pageEntries} from './static-pages.mjs';
import {readContentSource} from './content-store.mjs';
const root = fileURLToPath(new URL('../dist/client/', import.meta.url));
assert.deepEqual(readdirSync(root).sort(), ['.nojekyll','404.html','THIRD-PARTY-NOTICES.txt','about','assets','contact','guide','index.html','notes','privacy','robots.txt','sitemap.xml','works']);
const html = readFileSync(path.join(root, 'index.html'), 'utf8');
for (const [, url] of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
  if(url.startsWith('https://'))continue;
  assert.ok(url.startsWith('./assets/'), `Expected a relative asset path: ${url}`);
  assert.ok(existsSync(path.join(root, url)));
  const page = new URL('https://example.github.io/portfolio/');
  assert.ok(new URL(url, page).pathname.startsWith('/portfolio/assets/'));
}
assert.deepEqual(readdirSync(path.join(root,'assets')).filter(file=>file.endsWith('.png')).sort(),[...PROJECT_IMAGE_FILES].sort(),'Only approved PNGs may ship');
for (const file of readdirSync(path.join(root,'assets'))) {
  assert.ok(!file.endsWith('.map'), 'Source maps must stay out of the public package');
  if (file.endsWith('.css')) assert.ok(!readFileSync(path.join(root,'assets',file),'utf8').includes('/assets/notebook-gray.png'));
}
const javascript=readdirSync(path.join(root,'assets')).filter(f=>f.endsWith('.js')).map(f=>readFileSync(path.join(root,'assets',f),'utf8')).join('\n');
assert.ok(!javascript.includes('/__makelog/editor')&&!javascript.includes('__makelog/editor'),'Development write URLs must not ship');
const source=readContentSource();
for(const entry of pageEntries(source)){
  const folder=path.join(root,entry.path),file=path.join(folder,'index.html');
  assert.ok(existsSync(file),`Missing static page: ${entry.path}`);
  const pageHtml=readFileSync(file,'utf8');
  for(const [,asset]of pageHtml.matchAll(/(?:src|href)="([^"\s]*assets\/[^"\s]+)"/g)){
    assert.ok(existsSync(path.resolve(folder,asset)),`Broken nested asset: ${entry.path} ${asset}`);
    assert.ok(new URL(asset,new URL(`${entry.path?entry.path+'/':''}`, 'https://example.github.io/portfolio/')).pathname.startsWith('/portfolio/assets/'));
  }
  assert.ok(pageHtml.includes('rel="canonical"')&&pageHtml.includes('og:title'),`Missing metadata: ${entry.path}`);
}
publicContent(source); // The same schema and contrast requirements apply to the public build.
for(const article of source.articles.filter(a=>a.status==='draft'))assert.ok(!javascript.includes(article.id),'Draft article IDs must not ship');
assert.ok(!existsSync(path.join(root,'.pages.yml'))&&!existsSync(path.join(root,'src')),'CMS/source configuration stays outside the static site');
console.log('Static package verified: real pages, nested assets, metadata, approved public images, no drafts or write endpoints.');
