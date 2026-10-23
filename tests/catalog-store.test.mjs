import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,writeFile,rm,unlink,symlink,link} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import {readContentSnapshot,readContentSource,saveContentSource} from '../scripts/content-store.mjs';
import {publicContent,validateTags,validateTagIds,validateContent,validateMediaPath,MAX_ARTICLES,MAX_CONTENT_BYTES} from '../src/content-model.mjs';
import {addTagAssignment} from '../src/tag-utils.mjs';

const source=readContentSnapshot();
async function fixture(run){
  const root=await mkdtemp(path.join(tmpdir(),'makelog-catalog-'));
  const file=pathToFileURL(path.join(root,'site.json')),directory=pathToFileURL(path.join(root,'tags')+path.sep);
  try{
    await mkdir(directory);await writeFile(file,JSON.stringify(source.content));
    for(const entry of source.files)await writeFile(new URL(entry.name,directory),entry.raw);
    await run({file,directory});
  }finally{await rm(root,{recursive:true,force:true});}
}
test('external tags resolve migrated references to the same public labels, never UUID labels',()=>{
  for(const name of ['React','UI/UX','Data','JavaScript','Automation','Forms'])assert.ok(source.files.some(entry=>entry.row.legacyId===name));
  const content=publicContent(source.content);
  assert.deepEqual(content.site.projects.atlas.tags,['React','UI/UX','Data']);
  assert.ok(!JSON.stringify(content).includes('legacyId'));
  for(const entry of source.files)assert.ok(!JSON.stringify(content).includes(entry.row.id));
  assert.throws(()=>validateTags([source.files[0].row.id]));
  assert.doesNotThrow(()=>validateTagIds([source.files[0].row.id]));
});
test('legacy CMS draft references normalize without overriding canonical tag names',async()=>fixture(async({file,directory})=>{
  const data=structuredClone(source.content),react=source.files.find(entry=>entry.row.legacyId==='React');
  data.tagCatalog=[{id:'React',name:'STALE-NAME'}];
  data.site.projects.atlas.tags=['React','UI/UX','Data'];
  await writeFile(file,JSON.stringify(data));
  await writeFile(new URL(react.name,directory),JSON.stringify({...react.row,name:'React UI'}));
  const loaded=readContentSource(file,directory);
  assert.equal(loaded.site.projects.atlas.tags[0],react.row.id);
  assert.deepEqual(publicContent(loaded).site.projects.atlas.tags,['React UI','UI/UX','Data']);
}));
test('catalog edits participate in stale-write prevention and local saves preserve aliases',async()=>fixture(async({file,directory})=>{
  let before=readContentSnapshot(file,directory);
  const react=source.files.find(entry=>entry.row.legacyId==='React');
  await writeFile(new URL(react.name,directory),JSON.stringify({...react.row,name:'React online'}));
  await assert.rejects(()=>saveContentSource(before.revision,before.content,file,directory),error=>error.status===409);
  before=readContentSnapshot(file,directory);const update=structuredClone(before.content);
  update.tagCatalog.find(row=>row.id===react.row.id).name='React local';
  const added=addTagAssignment(update,[],'New tag');
  update.tagCatalog=added.tagCatalog;update.articles[0].tags=added.tags;
  const saved=await saveContentSource(before.revision,update,file,directory);
  assert.equal(saved.revision,readContentSnapshot(file,directory).revision);
  assert.equal(JSON.parse(await readFile(new URL(react.name,directory),'utf8')).legacyId,'React');
  assert.equal(JSON.parse(await readFile(file,'utf8')).tagCatalog,undefined);
  assert.ok(publicContent(saved.content).articles[0].tags.includes('New tag'));
}));
test('reference-backed name selection merges labels and rejects missing or deleted destinations',async()=>fixture(async({file,directory})=>{
  const before=readContentSnapshot(file,directory),update=structuredClone(before.content);
  const react=update.tagCatalog.find(row=>row.name==='React'),ux=update.tagCatalog.find(row=>row.name==='UI/UX');
  react.mergeInto=ux.id;
  const saved=await saveContentSource(before.revision,update,file,directory);
  assert.deepEqual(publicContent(saved.content).site.projects.atlas.tags,['UI/UX','Data']);
  const removed=structuredClone(saved.content);removed.tagCatalog=removed.tagCatalog.filter(row=>row.id!==react.id);
  await assert.rejects(()=>saveContentSource(saved.revision,removed,file,directory),/削除せず/);
  await unlink(new URL(react.id+'.json',directory));
  assert.throws(()=>readContentSource(file,directory),/参照中/);
}));
test('CMS clearing an optional destination is accepted but filenames, unknown fields and oversized rows fail closed',async()=>fixture(async({file,directory})=>{
  const entry=source.files[0],url=new URL(entry.name,directory);
  await writeFile(url,JSON.stringify({...entry.row,mergeInto:null}));assert.doesNotThrow(()=>readContentSource(file,directory));
  await writeFile(url,JSON.stringify({...entry.row,unknown:'blocked'}));assert.throws(()=>readContentSource(file,directory));
  await writeFile(url,' '.repeat(4097));assert.throws(()=>readContentSource(file,directory));
  await writeFile(url,entry.raw);await writeFile(new URL('bad.json',directory),'{}');assert.throws(()=>readContentSource(file,directory));
}));
test('catalog reads reject hard-linked rows and linked collection directories',async t=>fixture(async({file,directory})=>{
  const entry=source.files[0],url=new URL(entry.name,directory),outside=new URL('../linked-row.json',directory);
  await unlink(url);await writeFile(outside,entry.raw);
  try{await link(outside,url);}catch(error){if(['EPERM','ENOTSUP'].includes(error.code)){t.skip('OS does not permit hard links in this test environment');return;}throw error;}
  assert.throws(()=>readContentSource(file,directory));
  await unlink(url);await writeFile(url,entry.raw);
  const linked=new URL('../linked-tags/',directory);
  // POSIX symlink creation requires a destination without a trailing slash.
  try{await symlink(directory,new URL('../linked-tags',directory),process.platform==='win32'?'junction':'dir');}catch(error){if(['EPERM','ENOTSUP'].includes(error.code)){t.diagnostic('OS does not permit directory links; hard-link check passed');return;}throw error;}
  assert.throws(()=>readContentSource(file,linked));
}));

async function collectionFixture(run){
  const root=await mkdtemp(path.join(tmpdir(),'makelog-collections-'));
  const file=pathToFileURL(path.join(root,'site.json')),directory=pathToFileURL(path.join(root,'tags')+path.sep);
  try{
    await writeFile(file,source.siteRaw);
    for(const [folder,entries] of [['tags',source.files],['articles',source.articleFiles],['projects',source.projectFiles]]){
      const destination=new URL(folder+'/',file);await mkdir(destination);
      for(const entry of entries)await writeFile(new URL(entry.name,destination),entry.raw);
    }
    await run({file,directory,articles:new URL('articles/',file),projects:new URL('projects/',file)});
  }finally{await rm(root,{recursive:true,force:true});}
}

test('200 bilingual articles above 2MB validate and round-trip through split read/save without changing existing IDs',async()=>collectionFixture(async({file,directory,articles})=>{
  const before=readContentSnapshot(file,directory),update=structuredClone(before.content),originalIds=update.articles.map(a=>a.id);
  for(let i=update.articles.length;i<200;i++)update.articles.push({...structuredClone(update.articles[0]),id:`scale-fixture-${String(i).padStart(3,'0')}`,titleJa:`動作検証記事 ${i}`,bodyJa:'あ'.repeat(4000),bodyEn:'Example content. '.repeat(125)});
  const bytes=Buffer.byteLength(JSON.stringify(update));assert.ok(bytes>2_000_000);assert.ok(bytes<MAX_CONTENT_BYTES);
  assert.equal(validateContent(update).articles.length,200);
  const started=performance.now(),saved=await saveContentSource(before.revision,update,file,directory);
  assert.equal(saved.content.articles.length,200);assert.equal(readContentSnapshot(file,directory).articleFiles.length,200);
  for(const id of originalIds)assert.ok(saved.content.articles.some(a=>a.id===id));
  const raw=JSON.parse(await readFile(file,'utf8'));assert.equal(raw.articles,undefined);assert.equal(raw.site.projects,undefined);assert.equal(raw.site.additionalProjects,undefined);
  const changed=structuredClone(saved.content);changed.articles.find(a=>a.id==='scale-fixture-199').bodyJa='追加変更を保存';
  const untouched=await readFile(new URL('scale-fixture-198.json',articles),'utf8');
  await saveContentSource(saved.revision,changed,file,directory);
  assert.equal(await readFile(new URL('scale-fixture-198.json',articles),'utf8'),untouched);
  console.log(`200 article storage round-trip: ${bytes} bytes, ${Math.round(performance.now()-started)}ms`);
}));

test('split article and project edits participate in conflict detection and deletes preserve unrelated files',async()=>collectionFixture(async({file,directory,articles,projects})=>{
  let before=readContentSnapshot(file,directory);
  const target=new URL(before.articleFiles[0].name,articles),article=JSON.parse(await readFile(target,'utf8'));
  await writeFile(target,JSON.stringify({...article,titleJa:'オンライン編集'}));
  await assert.rejects(()=>saveContentSource(before.revision,before.content,file,directory),error=>error.status===409);
  before=readContentSnapshot(file,directory);
  const projectUrl=new URL('atlas.json',projects),project=JSON.parse(await readFile(projectUrl,'utf8'));
  await writeFile(projectUrl,JSON.stringify({...project,name:'Atlas online'}));
  await assert.rejects(()=>saveContentSource(before.revision,before.content,file,directory),error=>error.status===409);
  before=readContentSnapshot(file,directory);const changed=structuredClone(before.content);changed.articles=changed.articles.filter(a=>a.id!==article.id);
  const saved=await saveContentSource(before.revision,changed,file,directory);
  assert.equal(saved.content.articles.length,before.content.articles.length-1);
  await assert.rejects(()=>readFile(target),{code:'ENOENT'});
  assert.equal(saved.content.site.projects.atlas.name,'Atlas online');
}));

test('collections reject mismatched filenames, unexpected paths, oversized rows and mixed storage',async()=>collectionFixture(async({file,directory,articles})=>{
  const entry=source.articleFiles[0],target=new URL(entry.name,articles);
  await writeFile(target,JSON.stringify({...entry.row,id:'different'}));assert.throws(()=>readContentSnapshot(file,directory));
  await writeFile(target,' '.repeat(262145));assert.throws(()=>readContentSnapshot(file,directory));
  await writeFile(target,entry.raw);await mkdir(new URL('unexpected',articles));assert.throws(()=>readContentSnapshot(file,directory));
  await rm(new URL('unexpected',articles),{recursive:true});
  await writeFile(file,JSON.stringify({...JSON.parse(source.siteRaw),articles:[]}));assert.throws(()=>readContentSnapshot(file,directory),/混在/);
}));

test('article metadata validates bounded media, dates and translation states while preserving optional legacy defaults',()=>{
  const data=structuredClone(source.content),article=data.articles[0];
  delete article.updatedAt;delete article.translationStatus;delete article.images;
  let normalized=validateContent(data).articles[0];assert.equal(normalized.updatedAt,article.date);assert.equal(normalized.translationStatus,'current');assert.deepEqual(normalized.images,[]);
  article.bodyEn='';assert.equal(validateContent(data).articles[0].translationStatus,'missing');
  article.translationStatus='needs-update';article.images=[{src:'media/nest/screen-01.webp',altJa:'画面',captionJa:'ダミーデータ'}];
  normalized=validateContent(data).articles[0];assert.equal(normalized.images[0].altEn,'');assert.equal(normalized.translationStatus,'needs-update');
  for(const value of ['nest-preview.png','media/photo.jpg','media/nest/screen_01.png'])assert.equal(validateMediaPath(value),value);
  for(const value of ['../a.png','media/../a.png','media/a..png','media/a.svg','media//a.png','media/%2e%2e/a.png','media/a.png?token=secret','https://example.com/a.png','/media/a.png','media\\a.png','media/a.png#x',null,{},'unknown.png'])assert.throws(()=>validateMediaPath(value));
  for(const patch of [{updatedAt:'2026-02-31'},{translationStatus:'automatic'},{images:[{src:'media/a.png',altJa:''}]},{images:Array(9).fill({src:'media/a.png',altJa:'画像'})}])assert.throws(()=>validateContent({...data,articles:[{...article,...patch}]}));
  assert.throws(()=>validateContent({...data,articles:Array.from({length:MAX_ARTICLES+1},(_,i)=>({...article,id:`item-${i}`}))}));
  assert.throws(()=>validateContent({...data,site:{...data.site,featuredProject:'unknown'}}));
});

test('article collection rejects hard-linked files and linked directories',async t=>collectionFixture(async({file,directory,articles})=>{
  const entry=source.articleFiles[0],url=new URL(entry.name,articles),outside=new URL('outside-article.json',file);
  await unlink(url);await writeFile(outside,entry.raw);
  try{await link(outside,url);}catch(error){if(['EPERM','ENOTSUP'].includes(error.code)){t.skip('OS does not permit hard links in this test environment');return;}throw error;}
  assert.throws(()=>readContentSnapshot(file,directory));
}));
