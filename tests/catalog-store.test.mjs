import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,writeFile,rm,unlink,symlink,link} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import {readContentSnapshot,readContentSource,saveContentSource} from '../scripts/content-store.mjs';
import {publicContent,validateTags,validateTagIds} from '../src/content-model.mjs';
import {addTagAssignment} from '../src/tag-utils.mjs';

const source=readContentSnapshot();
async function fixture(run){
  const root=await mkdtemp(path.join(tmpdir(),'makelog-catalog-'));
  const file=pathToFileURL(path.join(root,'site.json')),directory=pathToFileURL(path.join(root,'tags')+path.sep);
  try{
    await mkdir(directory);await writeFile(file,source.siteRaw);
    for(const entry of source.files)await writeFile(new URL(entry.name,directory),entry.raw);
    await run({file,directory});
  }finally{await rm(root,{recursive:true,force:true});}
}
test('external tags resolve migrated references to the same public labels, never UUID labels',()=>{
  assert.equal(source.files.length,6);
  const content=publicContent(source.content);
  assert.deepEqual(content.site.projects.atlas.tags,['React','UI/UX','Data']);
  assert.ok(!JSON.stringify(content).includes('legacyId'));
  assert.ok(!JSON.stringify(content).includes(source.files[0].row.id));
  assert.throws(()=>validateTags([source.files[0].row.id]));
  assert.doesNotThrow(()=>validateTagIds([source.files[0].row.id]));
});
test('legacy CMS draft references normalize without overriding canonical tag names',async()=>fixture(async({file,directory})=>{
  const data=JSON.parse(source.siteRaw),react=source.files.find(entry=>entry.row.legacyId==='React');
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
