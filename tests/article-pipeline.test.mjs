import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync,symlinkSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {parseArticle,parseInline,renderArticleHtml,articleHeadings,safeArticleLink} from '../src/article-render.mjs';
import {pageEntries,renderPageHtml,articleAssets,referencedMedia} from '../scripts/static-pages.mjs';
import {readerMetadata} from '../scripts/content-plugin.mjs';
import {readContentSource} from '../scripts/content-store.mjs';
const fixture=()=>structuredClone(readContentSource());
test('shared Markdown grammar treats HTML as text and permits only safe HTTPS links',()=>{
  const text='## Heading\n\n<script>alert(1)</script> **safe** `code` [ok](https://example.com/path) [bad](javascript:alert)\n\n```js\n## not heading\n<script>bad</script>\n```\n\n- first\n- second';
  const html=renderArticleHtml(text);
  assert.ok(!html.includes('<script>'));assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(html.includes('<strong>safe</strong>'));assert.ok(html.includes('<code>code</code>'));
  assert.ok(html.includes('href="https://example.com/path"'));assert.ok(!html.includes('href="javascript:'));
  assert.deepEqual(articleHeadings(text),[{id:'section-1',text:'Heading',level:2}]);
  assert.deepEqual(parseArticle(text).map(b=>b.type),['heading','paragraph','code','list']);
  for(const value of ['http://example.com','javascript:alert(1)','https://user:pass@example.com','https://example.com/\n','//example.com'])assert.equal(safeArticleLink(value),null);
  assert.equal(parseInline('[bad](https://a:b@example.com)')[0].type,'text');
  assert.deepEqual(parseArticle('# \n## \n### ').map(b=>b.text),['# ','## ','### ']);
});
test('article static HTML has readable body, safe title, correct NEST image and nested paths',()=>{
  const data=fixture(),article=data.articles.find(a=>a.id==='nest-build-note');article.titleJa='<script>title</script>';article.bodyJa='## 見出し\n\n本文 **強調** <img src=x onerror=alert(1)>';
  const page=pageEntries(data).find(p=>p.path==='notes/nest-build-note');
  const original='<html><head><title>x</title><meta name="description" content="x" /><meta name="makelog-home" content="./"></head><body><div id="root"></div><script src="./assets/main.js"></script></body></html>';
  const html=renderPageHtml(original,page,data.site.brand);
  assert.ok(html.includes('<h2 id="section-1">見出し</h2>'));assert.ok(html.includes('本文 <strong>強調</strong>'));
  assert.ok(!html.includes('<img src=x'));assert.ok(html.includes('&lt;script&gt;title&lt;/script&gt;'));
  assert.ok(html.includes('https://devikuomidorikawa.github.io/makelog/assets/nest-preview.png'));
  assert.ok(html.includes('../../assets/main.js'));assert.ok(html.includes('href="../../notes/"'));
});
test('200 full articles publish separately, searchable, without bodies or drafts in reader metadata',()=>{
  const data=fixture(),template=data.articles[0],body='日本語の記事本文。'.repeat(500);
  data.articles=Array.from({length:200},(_,i)=>({...template,id:'scale-'+i,titleJa:'記事 '+i,bodyJa:body+' UNIQUE-BODY-'+i,bodyEn:'English body '+i,status:'published'}));
  data.articles.push({...template,id:'private-draft',titleJa:'PRIVATE-DRAFT-SENTINEL',bodyJa:'PRIVATE-DRAFT-SENTINEL',status:'draft'});
  const assets=articleAssets(data),metadata=readerMetadata(data),rows=pageEntries(data);
  assert.equal(assets.length,201);assert.equal(metadata.articles.length,200);assert.equal(rows.filter(r=>r.article).length,200);
  assert.ok(!JSON.stringify(metadata).includes('UNIQUE-BODY'));assert.ok(!JSON.stringify(metadata).includes('PRIVATE-DRAFT-SENTINEL'));
  assert.ok(!JSON.stringify(assets).includes('PRIVATE-DRAFT-SENTINEL'));
  const search=JSON.parse(assets.find(a=>a.fileName==='assets/search-index.json').source);assert.equal(search.length,200);assert.equal(search[199].bodyJa,body+' UNIQUE-BODY-199');
  assert.equal(JSON.parse(assets[137].source).id,'scale-137');
  assert.ok(Buffer.byteLength(JSON.stringify(metadata))<Buffer.byteLength(JSON.stringify(data))/10);
});
test('only referenced public raster media ships and extension/magic mismatch fails',()=>{
  const directory=mkdtempSync(path.join(tmpdir(),'makelog-media-')),root=pathToFileURL(directory+path.sep),data=fixture();
  try{
    mkdirSync(path.join(directory,'media'));
    const png=Buffer.from([137,80,78,71,13,10,26,10,0,0,0,0]);writeFileSync(path.join(directory,'media','demo.png'),png);writeFileSync(path.join(directory,'media','private.png'),png);
    data.articles[0].images=[{src:'media/demo.png',altJa:'画面',altEn:'Screen',captionJa:'',captionEn:''}];
    assert.deepEqual(referencedMedia(data,root).map(a=>a.fileName),['assets/media/demo.png']);
    writeFileSync(path.join(directory,'media','demo.png'),'<svg onload="alert(1)"></svg>');assert.throws(()=>referencedMedia(data,root));
    data.articles[0].status='draft';assert.equal(referencedMedia(data,root).length,0);
  }finally{rmSync(directory,{recursive:true,force:true});}
});
test('media filesystem links are refused when supported by the host',t=>{
  const directory=mkdtempSync(path.join(tmpdir(),'makelog-media-link-')),root=pathToFileURL(directory+path.sep),data=fixture();
  try{mkdirSync(path.join(directory,'media'));writeFileSync(path.join(directory,'source.png'),Buffer.from([137,80,78,71,13,10,26,10]));try{symlinkSync(path.join(directory,'source.png'),path.join(directory,'media','linked.png'));}catch(error){if(['EPERM','EACCES'].includes(error.code)){t.skip('Host does not permit symlink creation');return;}throw error;}
    data.articles[0].images=[{src:'media/linked.png',altJa:'画面',altEn:'',captionJa:'',captionEn:''}];assert.throws(()=>referencedMedia(data,root));
  }finally{rmSync(directory,{recursive:true,force:true});}
});
