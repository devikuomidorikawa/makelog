import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdtemp,rm,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import {validateContent,publicContent,contrast} from '../src/content-model.mjs';
import {allowedLocalRequest,atomicSave,revision} from '../scripts/content-plugin.mjs';
import {readRoute,routeHash} from '../src/site-utils.mjs';
const original=JSON.parse(await readFile(new URL('../src/content/site.json',import.meta.url),'utf8'));
const copy=()=>structuredClone(original);

test('publishing never embeds draft titles or bodies in the public content',()=>{
  const data=copy();data.articles.push({...data.articles[0],id:'draft-only',status:'draft',bodyJa:'PRIVATE-DRAFT-SENTINEL',titleJa:'DRAFT-TITLE-SENTINEL'});
  const result=publicContent(data);assert.ok(!JSON.stringify(result).includes('SENTINEL'));assert.equal(data.articles.at(-1).status,'draft');
});
test('content rejects duplicate IDs, invalid dates, excess fields and CSS injection',()=>{
  let data=copy();data.articles.push({...data.articles[0]});assert.throws(()=>validateContent(data));
  data=copy();data.articles[0].date='2026-02-31';assert.throws(()=>validateContent(data));
  data=copy();data.site.colors.ink='red;url(https://invalid.example)';assert.throws(()=>validateContent(data));
  data=copy();data.site.authToken='not-allowed';assert.throws(()=>validateContent(data));
  data=copy();data.articles[0].bodyJa='x'.repeat(20001);assert.throws(()=>validateContent(data));
});
test('article IDs cannot use numeric, boolean or array coercion',()=>{
  for(const id of [123,true,['valid-note']]){const data=copy();data.articles[0].id=id;assert.throws(()=>validateContent(data));}
});
test('published articles require a Japanese title and body; unsafe contrast is refused',()=>{
  const data=copy();data.articles[0].bodyJa='';assert.throws(()=>validateContent(data));data.articles[0].status='draft';assert.doesNotThrow(()=>validateContent(data));
  data.site.colors.ink=data.site.colors.canvas;assert.throws(()=>validateContent(data));assert.ok(contrast('#25113b','#f7f4ee')>4.5);
});
test('CMS articles can leave optional English, summary and project fields empty',()=>{
  const data=copy();data.articles=[{id:'cms-note',date:'2026-10-14',status:'published',titleJa:'制作の記録',bodyJa:'記事本文'}];
  const result=validateContent(data).articles[0];assert.equal(result.project,'');assert.equal(result.titleEn,'');assert.equal(result.summaryJa,'');assert.equal(result.bodyEn,'');
});
test('editor writes require exact loopback host, origin, content type and session token',()=>{
  const token='a'.repeat(64),request={headers:{host:'127.0.0.1:4173',origin:'http://127.0.0.1:4173','content-type':'application/json','x-makelog-token':token},socket:{remoteAddress:'127.0.0.1'}};
  assert.equal(allowedLocalRequest(request,4173,true,token),true);
  for(const patch of [{host:'evil.example:4173'},{origin:'https://evil.example'},{origin:undefined},{'x-makelog-token':'b'.repeat(64)},{'x-makelog-token':'é'.repeat(64)},{'content-type':'text/plain'}])assert.equal(allowedLocalRequest({...request,headers:{...request.headers,...patch}},4173,true,token),false);
  assert.equal(allowedLocalRequest({...request,socket:{remoteAddress:'192.0.2.1'}},4173,true,token),false);
});
test('atomic content saving preserves valid updates and refuses stale overwrites',async()=>{
  const folder=await mkdtemp(path.join(tmpdir(),'makelog-edit-')),file=pathToFileURL(path.join(folder,'site.json')),raw=JSON.stringify(original)+'\n';
  try{
    await writeFile(file,raw);const updated=copy();updated.site.brand='MAKELOG TEST';const saved=await atomicSave(file,revision(raw),updated);
    assert.equal(JSON.parse(await readFile(file,'utf8')).site.brand,'MAKELOG TEST');assert.equal(saved.revision,revision(await readFile(file,'utf8')));
    await assert.rejects(()=>atomicSave(file,revision(raw),original),e=>e.status===409);assert.equal(JSON.parse(await readFile(file,'utf8')).site.brand,'MAKELOG TEST');
  }finally{await rm(folder,{recursive:true,force:true});}
});
test('article share routes reject encoded paths, traversal and executable fragments',()=>{
  assert.deepEqual(readRoute('#article/atlas-build-note'),{type:'article',id:'atlas-build-note'});assert.equal(routeHash({type:'editor'}),'#editor');
  for(const value of ['#article/../secret','#article/%2e%2e','#article/<script>','#article/a/b'])assert.equal(readRoute(value),null);
});
test('Pages CMS edits the same fixed file and bilingual schema as the local studio',async()=>{
  const config=JSON.parse(await readFile(new URL('../.pages.yml',import.meta.url),'utf8'));
  assert.equal(config.content.length,1);assert.equal(config.content[0].path,'src/content/site.json');
  const fields=config.content[0].fields;assert.ok(fields.find(f=>f.name==='articles').fields.find(f=>f.name==='bodyEn'));
  assert.deepEqual(fields.find(f=>f.name==='site').fields.find(f=>f.name==='colors').fields.map(f=>f.name),Object.keys(original.site.colors));
});
