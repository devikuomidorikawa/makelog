import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdtemp,rm,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import {validateContent,validateTags,publicContent,contrast} from '../src/content-model.mjs';
import {collectTags,tagMatches,renameContentTag} from '../src/tag-utils.mjs';
import {allowedLocalRequest,atomicSave,revision} from '../scripts/content-plugin.mjs';
import {readRoute,routeHash} from '../src/site-utils.mjs';
const original=JSON.parse(await readFile(new URL('../src/content/site.json',import.meta.url),'utf8'));
const copy=()=>structuredClone(original);

test('publishing never embeds draft titles or bodies in the public content',()=>{
  const data=copy();data.articles.push({...data.articles[0],id:'draft-only',status:'draft',bodyJa:'PRIVATE-DRAFT-SENTINEL',titleJa:'DRAFT-TITLE-SENTINEL',tags:['DRAFT-TAG-SENTINEL']});
  const result=publicContent(data);assert.ok(!JSON.stringify(result).includes('SENTINEL'));assert.equal(data.articles.at(-1).status,'draft');
});

test('old content with no tags stays valid and normalizes tags without mutating its source',()=>{
  const data=copy();for(const p of Object.values(data.site.projects))delete p.tags;for(const a of data.articles)delete a.tags;
  const result=validateContent(data);assert.deepEqual(result.site.projects.atlas.tags,[]);assert.deepEqual(result.articles[0].tags,[]);assert.equal(data.articles[0].tags,undefined);
  assert.deepEqual(validateTags([' UI/UX ','日本語']),['UI/UX','日本語']);
});

test('tags reject invalid types, controls, duplicate names and oversized lists or names',()=>{
  for(const tags of [null,'React',[1],[''],['a',' a '],['line\nwrap'],['tab\tname'],['bidi\u202ename'],['x'.repeat(33)],Array.from({length:9},(_,n)=>String(n))])assert.throws(()=>validateTags(tags));
  const data=copy();data.site.projects.form.tags=['Automation',' Automation'];assert.throws(()=>validateContent(data));
  data.site.projects.form.tags=[];data.articles[0].tags={name:'React'};assert.throws(()=>validateContent(data));
});

test('tag filters match exact assignments, including untagged items and empty filters',()=>{
  const items=[{tags:['React','UI/UX']},{tags:['Automation']},{tags:['React']},{}];
  assert.deepEqual(collectTags(items),['Automation','React','UI/UX']);
  assert.equal(items.filter(item=>tagMatches(item,'React')).length,2);assert.equal(items.filter(item=>tagMatches(item,'react')).length,0);assert.equal(items.filter(item=>tagMatches(item,'')).length,4);
});

test('renaming a tag updates projects and drafts while merging existing assignments',()=>{
  const data=copy();data.site.projects.atlas.tags=['React','UI/UX'];data.articles[0].tags=['React'];data.articles[1].status='draft';data.articles[1].tags=['React','UI/UX'];
  const result=renameContentTag(data,'React','UI/UX');assert.deepEqual(result.site.projects.atlas.tags,['UI/UX']);assert.deepEqual(result.articles[0].tags,['UI/UX']);assert.deepEqual(result.articles[1].tags,['UI/UX']);assert.equal(result.articles[1].status,'draft');assert.deepEqual(data.site.projects.atlas.tags,['React','UI/UX']);assert.throws(()=>renameContentTag(data,'React','bad\nname'));
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
  const tags=fields.find(f=>f.name==='articles').fields.find(f=>f.name==='tags');assert.equal(tags.type,'string');assert.equal(tags.list.max,8);assert.equal(tags.options.maxlength,32);
  for(const project of fields.find(f=>f.name==='site').fields.find(f=>f.name==='projects').fields){const tag=project.fields.find(f=>f.name==='tags');assert.equal(tag.type,'string');assert.equal(tag.list.max,8);}
  assert.deepEqual(fields.find(f=>f.name==='site').fields.find(f=>f.name==='colors').fields.map(f=>f.name),Object.keys(original.site.colors));
});
