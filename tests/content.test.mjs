import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdtemp,rm,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import {validateContent,validateTags,validateTagCatalog,publicContent,contrast,resolveContentTags,recentProjects,projectEntries,httpsUrl} from '../src/content-model.mjs';
import {collectTags,tagMatches,renameContentTag,collectTagOptions,addTagAssignment} from '../src/tag-utils.mjs';
import {allowedLocalRequest,atomicSave,revision} from '../scripts/content-plugin.mjs';
import {readRoute,routeHash} from '../src/site-utils.mjs';
import {readContentSnapshot} from '../scripts/content-store.mjs';
const original=JSON.parse(await readFile(new URL('../src/content/site.json',import.meta.url),'utf8'));
// Keep these pure-model regression cases on legacy IDs; the catalog-store
// suite exercises the real UUID-backed files and their migration separately.
const snapshot=readContentSnapshot(),legacyIds=new Map(snapshot.files.map(entry=>[entry.row.id,entry.row.legacyId||entry.row.name]));
for(const item of [...Object.values(original.site.projects),...(original.site.additionalProjects||[]),...original.articles])item.tags=item.tags.map(id=>legacyIds.get(id)||id);
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
  const raw=renameContentTag(data,'React','UI/UX'),result=resolveContentTags(raw);assert.deepEqual(raw.site.projects.atlas.tags,['React','UI/UX']);assert.deepEqual(result.site.projects.atlas.tags,['UI/UX']);assert.deepEqual(result.articles[0].tags,['UI/UX']);assert.deepEqual(result.articles[1].tags,['UI/UX']);assert.equal(result.articles[1].status,'draft');assert.deepEqual(data.site.projects.atlas.tags,['React','UI/UX']);assert.throws(()=>renameContentTag(data,'React','bad\nname'));
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
  assert.equal(config.content.length,2);assert.equal(config.content[0].path,'src/content/site.json');
  const fields=config.content[0].fields;assert.ok(fields.find(f=>f.name==='articles').fields.find(f=>f.name==='bodyEn'));
  const tags=fields.find(f=>f.name==='articles').fields.find(f=>f.name==='tags');assert.equal(tags.type,'reference');assert.equal(tags.options.max,8);assert.equal(tags.options.collection,'tags');
  for(const project of fields.find(f=>f.name==='site').fields.find(f=>f.name==='projects').fields){const tag=project.fields.find(f=>f.name==='tags');assert.equal(tag.type,'reference');assert.equal(tag.options.max,8);}
  assert.deepEqual(fields.find(f=>f.name==='site').fields.find(f=>f.name==='colors').fields.map(f=>f.name),Object.keys(original.site.colors));
});

test('online catalog renames every stable reference and omits unused/draft metadata from publishing',()=>{
  const data=copy();data.tagCatalog=[{id:'React',name:'React UI'},{id:'unused',name:'UNUSED-SENTINEL'},{id:'draft-tag',name:'DRAFT-CATALOG-SENTINEL'}];
  data.articles.push({...data.articles[0],id:'draft-catalog-only',status:'draft',tags:['draft-tag']});
  const published=publicContent(data);assert.ok(published.site.projects.atlas.tags.includes('React UI'));assert.ok(published.articles[0].tags.includes('React UI'));assert.ok(!JSON.stringify(published).includes('SENTINEL'));assert.equal(published.tagCatalog,undefined);assert.equal(data.site.projects.atlas.tags[0],'React');
  const raw=validateContent(data);assert.equal(raw.tagCatalog[0].id,'React');assert.equal(raw.articles.at(-1).status,'draft');
});

test('online merges resolve chains, aggregate filters, deduplicate assignments and preserve references',()=>{
  const data=copy();data.tagCatalog=[{id:'React',name:'React',mergeInto:'UI/UX'},{id:'UI/UX',name:'UI/UX',mergeInto:'Data'},{id:'Data',name:'Research'}];
  const published=publicContent(data);assert.deepEqual(published.site.projects.atlas.tags,['Research']);assert.deepEqual(published.site.projects.flow.tags,['Research','Forms']);assert.equal(Object.values(published.site.projects).filter(item=>tagMatches(item,'Research')).length,2);assert.deepEqual(data.site.projects.atlas.tags,['React','UI/UX','Data']);
  assert.ok(!collectTags(published.articles).includes('React'));
});

test('catalog rejects ambiguous IDs, missing merge targets, cycles and unsafe labels',()=>{
  for(const catalog of [null,{},[{id:'x',name:'A'},{id:'x',name:'B'}],[{id:'x',name:'A',mergeInto:'absent'}],[{id:'x',name:'A',mergeInto:'x'}],[{id:'x',name:'A',mergeInto:'y'},{id:'y',name:'B',mergeInto:'x'}],[{id:'x',name:'same'},{id:'y',name:'same'}],[{id:'x',name:'bad\nname'}],[{id:4,name:'Bad ID'}],[{id:'x',name:'A',mergeInto:null}],[{id:'x',name:'x',surprise:true}],Array.from({length:101},(_,i)=>({id:String(i),name:String(i)}))])assert.throws(()=>validateTagCatalog(catalog));
  assert.deepEqual(validateTagCatalog([{id:' React ',name:' React UI ',mergeInto:''}]),[{id:'React',name:'React UI'}]);
});

test('local rename and merge use the same online catalog without rewriting article references',()=>{
  const data=copy();data.tagCatalog=[{id:'React',name:'React'}];const renamed=renameContentTag(data,'React','React UI');assert.equal(renamed.tagCatalog[0].id,'React');assert.equal(renamed.tagCatalog[0].name,'React UI');assert.deepEqual(renamed.site.projects.atlas.tags,data.site.projects.atlas.tags);
  const merged=renameContentTag(renamed,'React UI','UI/UX');assert.equal(merged.tagCatalog.find(tag=>tag.id==='React').mergeInto,'UI/UX');assert.deepEqual(resolveContentTags(merged).site.projects.atlas.tags,['UI/UX','Data']);assert.ok(collectTagOptions(merged).some(tag=>tag.id==='UI/UX'&&tag.name==='UI/UX'));assert.throws(()=>renameContentTag(merged,'missing','new'));
});

test('local assignment selects stable IDs by display name and safely handles renamed ID collisions',()=>{
  const data=copy();data.tagCatalog=[{id:'React',name:'React UI'}];let added=addTagAssignment(data,[],'React UI');assert.deepEqual(added.tags,['React']);assert.throws(()=>addTagAssignment(data,['React'],'React UI'));
  added=addTagAssignment(data,[],'React');assert.notEqual(added.tags[0],'React');assert.equal(added.tagCatalog.find(tag=>tag.id===added.tags[0]).name,'React');assert.deepEqual(data.tagCatalog,[{id:'React',name:'React UI'}]);
});

test('informational pages accept only fixed unique routes and bounded bilingual plain text',()=>{
  const data=copy();data.pages=[{id:'privacy',titleJa:'プライバシー',bodyJa:'説明'}];let result=publicContent(data);assert.equal(result.pages[0].bodyEn,'');assert.equal(result.pages[0].id,'privacy');
  for(const pages of [[{id:'other',titleJa:'説明',bodyJa:'本文'}],[...data.pages,...data.pages],[{id:'privacy',titleJa:'',bodyJa:'説明'}],[{id:'privacy',titleJa:'説明',bodyJa:'x'.repeat(10001)}]])assert.throws(()=>validateContent({...data,pages}));
});

test('CMS online management exposes catalog rename/merge and bounded informational pages',async()=>{
  const config=JSON.parse(await readFile(new URL('../.pages.yml',import.meta.url),'utf8')),fields=config.content[0].fields;
  assert.equal(fields.some(field=>field.name==='tagCatalog'),false);
  const catalog=config.content.find(entry=>entry.name==='tags');assert.equal(catalog.type,'collection');assert.equal(catalog.path,'src/content/tags');assert.equal(catalog.operations.delete,false);assert.equal(catalog.operations.rename,false);
  const id=catalog.fields.find(field=>field.name==='id');assert.equal(id.type,'uuid');assert.equal(id.readonly,true);assert.equal(id.hidden,true);assert.equal(id.options.generate,false);
  const merge=catalog.fields.find(field=>field.name==='mergeInto');assert.equal(merge.type,'reference');assert.equal(merge.options.collection,'tags');assert.equal(merge.options.value,'{fields.id}');assert.equal(merge.options.label,'{fields.name}');
  const assignments=[];const visit=rows=>rows.forEach(field=>{if(field.name==='tags')assignments.push(field);if(field.fields)visit(field.fields);});visit(fields);assert.equal(assignments.length,5);for(const field of assignments){assert.equal(field.type,'reference');assert.equal(field.options.multiple,true);assert.equal(field.options.max,8);assert.equal(field.options.label,'{fields.name}');}
  const pages=fields.find(field=>field.name==='pages');assert.equal(pages.list.max,3);assert.equal(pages.fields.find(field=>field.name==='bodyJa').options.maxlength,10000);assert.deepEqual(pages.fields.find(field=>field.name==='id').options.values.map(option=>option.name),['privacy','guide','contact']);
});

test('CMS may omit the unused studio note without weakening other bilingual fields',async()=>{
  for(const note of [undefined,null,[],['','']]){
    const data=copy();if(note===undefined)delete data.site.studioNote;else data.site.studioNote=note;
    assert.deepEqual(validateContent(data).site.studioNote,['','']);
  }
  for(const note of [['one'],'wrong',false,{}]){const data=copy();data.site.studioNote=note;assert.throws(()=>validateContent(data));}
  for(const title of [undefined,null,[],['one']]){const data=copy();data.site.heroTitle=title;assert.throws(()=>validateContent(data));}
  const config=JSON.parse(await readFile(new URL('../.pages.yml',import.meta.url),'utf8'));
  const note=config.content[0].fields.find(field=>field.name==='site').fields.find(field=>field.name==='studioNote');
  assert.equal(note.hidden,true);assert.equal(note.list.min,0);assert.equal(note.list.max,2);
});

const extra=(id,updatedAt='2026-10-15',status='published')=>({id,...structuredClone(original.site.projects.form),updatedAt,status});
test('recent works include at most three public projects in newest update order with deterministic ties',()=>{
  const data=copy();data.site.additionalProjects=[extra('my-app'),extra('z-app'),extra('a-draft','2026-10-16','draft')];
  const before=JSON.stringify(data);
  assert.deepEqual(recentProjects(data.site).map(([id])=>id),['my-app','z-app','atlas']);
  assert.equal(JSON.stringify(data),before);
  data.site.projects.atlas.updatedAt='2026-10-17';assert.deepEqual(recentProjects(data.site).map(([id])=>id),['atlas','my-app','z-app']);
  for(const p of Object.values(data.site.projects))delete p.updatedAt;
  const normalized=validateContent(data);assert.equal(normalized.site.projects.atlas.updatedAt,'');
  assert.deepEqual(recentProjects(normalized.site).map(([id])=>id),['my-app','z-app','atlas']);
  assert.equal(recentProjects({projects:{one:{updatedAt:'2026-10-14'}}}).length,1);
});

test('additional apps publish without draft metadata and articles cannot link publicly to draft apps',()=>{
  const data=copy();data.site.additionalProjects=[extra('my-app'),{...extra('hidden-app','2026-10-16','draft'),name:'DRAFT-APP-SENTINEL',tags:['DRAFT-APP-TAG-SENTINEL']}];
  data.articles.push({...data.articles[0],id:'my-app-note',project:'my-app'});
  let published=publicContent(data);assert.ok(!JSON.stringify(published).includes('SENTINEL'));
  assert.equal(projectEntries(published.site).length,4);assert.equal(published.site.additionalProjects[0].id,'my-app');
  data.articles.at(-1).project='hidden-app';assert.throws(()=>validateContent(data));
  data.articles.at(-1).status='draft';assert.doesNotThrow(()=>validateContent(data));
});

test('additional app IDs, dates, counts and external links are bounded and validated',()=>{
  for(const patch of [{id:'atlas'},{id:'constructor'},{id:'../secret'},{id:'x'.repeat(65)},{id:['coerced']},{updatedAt:'2026-02-31'},{updatedAt:''},{status:'hidden'},{demoUrl:'javascript:alert(1)'},{demoUrl:'https://user:pass@example.com/'},{demoUrl:'https://example.com/\n'},{repository:'https://github.com/a/b'},{repository:'a/b/extra'}]){
    const data=copy();data.site.additionalProjects=[{...extra('my-app'),...patch}];assert.throws(()=>validateContent(data),JSON.stringify(patch));
  }
  const data=copy();data.site.additionalProjects=[extra('my-app'),extra('my-app')];assert.throws(()=>validateContent(data));
  data.site.additionalProjects=Array.from({length:98},(_,i)=>extra(`app-${i}`));assert.throws(()=>validateContent(data));
  data.site.additionalProjects=[{...extra('my-app'),demoUrl:'https://example.com/demo?mode=trial',repository:'devikuomidorikawa/makelog'}];assert.doesNotThrow(()=>validateContent(data));
  assert.equal(httpsUrl('https://example.com/app'),'https://example.com/app');assert.equal(httpsUrl('http://example.com'),null);
});

test('CMS exposes date fields and addable apps using the same bounded schema',async()=>{
  const config=JSON.parse(await readFile(new URL('../.pages.yml',import.meta.url),'utf8'));
  const site=config.content[0].fields.find(f=>f.name==='site'),extra=site.fields.find(f=>f.name==='additionalProjects');
  assert.equal(extra.list.max,97);assert.ok(extra.fields.find(f=>f.name==='updatedAt').required);assert.equal(extra.fields.find(f=>f.name==='status').default,'draft');
  for(const p of site.fields.find(f=>f.name==='projects').fields)assert.ok(p.fields.find(f=>f.name==='updatedAt'));
});
