import {readFileSync,readdirSync,lstatSync} from 'node:fs';
import {writeFile,rename,unlink} from 'node:fs/promises';
import {createHash,randomBytes} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {validateContent,validateTags,validateTagCatalog,TAG_UUID_PATTERN,MAX_TAG_CATALOG,MAX_CONTENT_BYTES} from '../src/content-model.mjs';

export const CONTENT_FILE=new URL('../src/content/site.json',import.meta.url);
export const CATALOG_DIRECTORY=new URL('../src/content/tags/',import.meta.url);
const MAX_TAG_FILE_BYTES=4096;
const unsafe=()=>{throw Error('タグ管理ファイルの形式・保存先を確認してください。');};
function safeStat(target,directory=false){
  // POSIX follows a directory symlink when lstat receives a trailing slash.
  // Remove that separator lexically, without resolving filesystem links.
  const stat=lstatSync(directory?resolve(fileURLToPath(target)):target);
  if(stat.isSymbolicLink()||(directory?!stat.isDirectory():!stat.isFile()||stat.nlink!==1))unsafe();
  return stat;
}
function readBounded(file,max){
  if(safeStat(file).size>max)throw Error('編集データのサイズ上限を超えています。');
  const raw=readFileSync(file,'utf8');
  if(Buffer.byteLength(raw)>max)throw Error('編集データのサイズ上限を超えています。');
  return raw;
}
function decodeRow(raw,filename){
  const entry=JSON.parse(raw);
  if(!entry||typeof entry!=='object'||Array.isArray(entry)||Object.keys(entry).some(key=>!['id','name','mergeInto','legacyId'].includes(key))||typeof entry.id!=='string'||!TAG_UUID_PATTERN.test(entry.id)||filename!==entry.id+'.json')unsafe();
  const row={id:entry.id,name:entry.name,mergeInto:entry.mergeInto??''};
  if(entry.legacyId!==undefined&&entry.legacyId!=='')row.legacyId=validateTags([entry.legacyId])[0];
  return row;
}
function combine(site,rows){
  const aliases=new Map(),ids=new Set(rows.map(row=>row.id));
  for(const row of rows)if(row.legacyId){if(aliases.has(row.legacyId))throw Error('旧タグIDが重複しています。');aliases.set(row.legacyId,row.id);}
  // The external collection is canonical. A previous CMS draft may still carry
  // its old inline catalog: it must never overwrite a newer online tag rename.
  const data=structuredClone(site);
  data.tagCatalog=validateTagCatalog(rows.map(({legacyId,...row})=>row));
  for(const item of [...Object.values(data.site?.projects||{}),...(data.site?.additionalProjects||[]),...(data.articles||[])]){
    if(item.tags===undefined)continue;
    if(!Array.isArray(item.tags))throw Error('タグは配列で指定してください。');
    item.tags=item.tags.map(ref=>aliases.get(ref)??ref);
    if(item.tags.some(ref=>typeof ref==='string'&&TAG_UUID_PATTERN.test(ref)&&!ids.has(ref)))throw Error('参照中のタグが見つかりません。削除せず統合先を選択してください。');
  }
  return validateContent(data);
}
export function readContentSnapshot(file=CONTENT_FILE,directory=CATALOG_DIRECTORY){
  // Only fixed application roots (or explicit trusted test roots) are accepted;
  // no HTTP input is used to select these paths.
  safeStat(new URL('./',file),true);safeStat(directory,true);
  const siteRaw=readBounded(file,MAX_CONTENT_BYTES),names=readdirSync(directory).sort();
  if(names.length>MAX_TAG_CATALOG)throw Error('タグ管理は100件以内にしてください。');
  const files=names.map(name=>{
    if(!/^[a-f0-9-]{36}\.json$/.test(name))unsafe();
    const url=new URL(name,directory),raw=readBounded(url,MAX_TAG_FILE_BYTES);
    return {url,name,raw,row:decodeRow(raw,name)};
  });
  const total=Buffer.byteLength(siteRaw)+files.reduce((sum,entry)=>sum+Buffer.byteLength(entry.raw),0);
  if(total>MAX_CONTENT_BYTES)throw Error('編集データは1MB以内にしてください。');
  const content=combine(JSON.parse(siteRaw),files.map(entry=>entry.row));
  const revision=createHash('sha256').update(JSON.stringify([siteRaw,files.map(({name,raw})=>[name,raw])])).digest('hex');
  return {content,revision,siteRaw,files};
}
export const readContentSource=(file=CONTENT_FILE,directory=CATALOG_DIRECTORY)=>readContentSnapshot(file,directory).content;

export async function saveContentSource(expected,value,file=CONTENT_FILE,directory=CATALOG_DIRECTORY){
  const before=readContentSnapshot(file,directory);
  const conflict=()=>{const error=Error('記事またはタグが別の画面で変更されています。最新版を読み込んでから保存してください。');error.status=409;throw error;};
  if(before.revision!==expected)conflict();
  const data=validateContent(value),existing=new Map(before.files.map(entry=>[entry.row.id,entry]));
  const catalog=data.tagCatalog||[];
  if([...existing.keys()].some(id=>!catalog.some(row=>row.id===id)))throw Error('既存タグは削除せず、統合先を選択してください。');
  const rows=catalog.map(row=>{
    if(!TAG_UUID_PATTERN.test(row.id))throw Error('新しいタグIDは自動生成されたUUIDを使用してください。');
    return {...row,mergeInto:row.mergeInto||'',...(existing.get(row.id)?.row.legacyId?{legacyId:existing.get(row.id).row.legacyId}:{})};
  });
  const normalized=combine(data,rows),{tagCatalog,...site}=normalized;
  const changes=rows.map(row=>({url:new URL(row.id+'.json',directory),next:JSON.stringify(row,null,2)+'\n',previous:existing.get(row.id)?.raw}));
  changes.push({url:file,next:JSON.stringify(site,null,2)+'\n',previous:before.siteRaw});
  if(changes.reduce((sum,entry)=>sum+Buffer.byteLength(entry.next),0)>MAX_CONTENT_BYTES)throw Error('編集データは1MB以内にしてください。');
  const changed=changes.filter(entry=>entry.next!==entry.previous),staged=[],committed=[];
  try{
    for(const entry of changed){
      const temporary=new URL(`.save-${randomBytes(12).toString('hex')}.tmp`,new URL('./',file));
      await writeFile(temporary,entry.next,{flag:'wx',mode:0o600});staged.push({...entry,temporary});
    }
    if(readContentSnapshot(file,directory).revision!==expected)conflict();
    for(const entry of staged){await rename(entry.temporary,entry.url);committed.push(entry);}
  }catch(error){
    // Recover ordinary write failures. Trusted local editors are serialized by
    // the dev middleware; revision checks also cover externally edited tags.
    for(const entry of committed.reverse()){
      if(entry.previous===undefined)await unlink(entry.url);
      else{
        const rollback=new URL(`.save-${randomBytes(12).toString('hex')}.tmp`,new URL('./',entry.url));
        await writeFile(rollback,entry.previous,{flag:'wx',mode:0o600});await rename(rollback,entry.url);
      }
    }
    throw error;
  }finally{for(const entry of staged)await unlink(entry.temporary).catch(()=>{});}
  const saved=readContentSnapshot(file,directory);
  return {content:saved.content,revision:saved.revision};
}
