import {normalizeProjectDownload} from './download-utils.mjs';

export const MAX_CONTENT_BYTES = 1_000_000;
export const PROJECT_IDS = ['atlas', 'form', 'flow'];
// Content can select only reviewed, bundled filenames; never a URL or filesystem path.
export const PROJECT_IMAGE_FILES = ['campus-main.png','campus-a.png','campus-b.png','form-preview.png','flow-preview.png','nest-preview.png'];
export const MAX_PROJECTS = 100;
export const PROJECT_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/;
export function projectEntries(site) {
  return [...Object.entries(site.projects),...(site.additionalProjects||[]).map(({id,...project})=>[id,project])];
}
export function recentProjects(site,limit=3) {
  return projectEntries(site).filter(([,p])=>p.status!=='draft').sort(([a,p],[b,q])=>
    (q.updatedAt||'').localeCompare(p.updatedAt||'')||(a<b?-1:a>b?1:0)).slice(0,limit);
}
export function httpsUrl(value) {
  if(typeof value!=='string'||value.length>2048||!/^https:\/\//.test(value)||/[\s\u0000-\u001f\u007f]/.test(value))return null;
  try{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password&&url.hostname?url.href:null;}catch{return null;}
}
function date(value,required=false) {
  if(value===undefined||value===''){if(required)fail('作品の更新日を入力してください。');return '';}
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)||Number.isNaN(Date.parse(value))||new Date(value).toISOString().slice(0,10)!==value)fail('作品の更新日を確認してください。');
  return value;
}
export const PAIR_FIELDS = ['heroTitle','heroDescription','studioBody','studioNote','footer','about'];
export const MAX_TAGS = 8;
export const MAX_TAG_LENGTH = 32;
export const MAX_TAG_CATALOG = 100;
export const TAG_UUID_PATTERN = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
export const PAGE_IDS = ['privacy','guide','contact'];

function fail(message) { throw new Error(message); }
function object(value, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(k=>!keys.includes(k))) fail('内容の形式が正しくありません。');
}
function text(value, max, required=false) {
  if (typeof value !== 'string' || value.length>max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value) || (required&&!value.trim())) fail(`文字数・入力内容を確認してください（上限${max}文字）。`);
  return value;
}
function pair(value,max) {
  if (!Array.isArray(value)||value.length!==2) fail('日本語と英語の2項目が必要です。');
  return value.map(v=>text(v,max));
}
function list(value,max=12) {
  if (!Array.isArray(value)||!value.length||value.length>max) fail('項目数を確認してください。');
  return value.map(v=>text(v,160,true));
}
export function validateTags(value=[]) {
  if (!Array.isArray(value)||value.length>MAX_TAGS) fail(`タグは${MAX_TAGS}件以内にしてください。`);
  const tags=value.map(v=>{
    if(typeof v!=='string'||/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/.test(v)) fail('タグは改行・制御文字のない短い名前にしてください。');
    const tag=v.trim();
    if(!tag||tag.length>MAX_TAG_LENGTH) fail(`タグ名は1〜${MAX_TAG_LENGTH}文字にしてください。`);
    return tag;
  });
  if(new Set(tags).size!==tags.length) fail('同じタグを重複して追加しないでください。');
  return tags;
}
export function validateTagCatalog(value=[]) {
  if(!Array.isArray(value)||value.length>MAX_TAG_CATALOG) fail('タグ管理は100件以内にしてください。');
  const ids=new Set();
  const catalog=value.map(entry=>{
    object(entry,['id','name','mergeInto']);
    const [id]=validateTagIds([entry.id]),[name]=validateTags([entry.name]);
    if(ids.has(id)) fail('タグIDが重複しています。');
    ids.add(id);
    const mergeInto=entry.mergeInto===''||entry.mergeInto===undefined?'':validateTagIds([entry.mergeInto])[0];
    return mergeInto?{id,name,mergeInto}:{id,name};
  });
  const byId=new Map(catalog.map(entry=>[entry.id,entry]));
  const names=new Set();
  for(const entry of catalog){
    if(!entry.mergeInto){if(names.has(entry.name)) fail('同じ表示名のタグは「統合先ID」でまとめてください。');names.add(entry.name);}
    let current=entry,visited=new Set();
    while(current.mergeInto){
      if(visited.has(current.id)) fail('タグの統合先が循環しています。');
      visited.add(current.id);current=byId.get(current.mergeInto);
      if(!current) fail('タグの統合先IDが見つかりません。');
    }
  }
  return catalog;
}
// Authoring references may be immutable UUIDs; reader-visible labels remain 1–32 characters.
export function validateTagIds(value=[]) {
  if(!Array.isArray(value)||value.length>MAX_TAGS) fail(`タグは${MAX_TAGS}件以内にしてください。`);
  const ids=value.map(id=>typeof id==='string'&&TAG_UUID_PATTERN.test(id)?id:validateTags([id])[0]);
  if(new Set(ids).size!==ids.length)fail('同じタグを重複して追加しないでください。');
  return ids;
}
export function resolveTagId(tag,catalog=[]) {
  const byId=new Map(catalog.map(entry=>[entry.id,entry]));
  let current=byId.get(tag),visited=new Set();
  while(current?.mergeInto){
    if(visited.has(current.id)) fail('タグの統合先が循環しています。');
    visited.add(current.id);current=byId.get(current.mergeInto);
    if(!current) fail('タグの統合先IDが見つかりません。');
  }
  return current?.id??tag;
}
export function resolveTagName(tag,catalog=[]) {
  const id=resolveTagId(tag,catalog);
  return catalog.find(entry=>entry.id===id)?.name??tag;
}
export function resolveContentTags(value) {
  const content=validateContent(value),catalog=content.tagCatalog||[];
  const resolve=item=>({...item,tags:validateTags([...new Set(item.tags.map(tag=>resolveTagName(tag,catalog)))])});
  content.site.projects=Object.fromEntries(Object.entries(content.site.projects).map(([id,item])=>[id,resolve(item)]));
  content.site.additionalProjects=(content.site.additionalProjects||[]).map(resolve);
  content.articles=content.articles.map(resolve);
  // The catalog is authoring metadata; unused and draft-only names never enter the public bundle.
  delete content.tagCatalog;
  return content;
}
export function contrast(a,b) {
  const light = color => {
    const values=color.slice(1).match(/../g).map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);
    return values[0]*.2126+values[1]*.7152+values[2]*.0722;
  };
  const x=light(a),y=light(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);
}
export function validateContent(value) {
  if (new TextEncoder().encode(JSON.stringify(value)).length>MAX_CONTENT_BYTES) fail('編集データは1MB以内にしてください。');
  object(value,['version','site','articles','tagCatalog','pages']);
  if(value.version!==1) fail('対応していない編集データの版です。');
  const s=value.site;object(s,['brand','tagline',...PAIR_FIELDS,'colors','projects','additionalProjects']);
  const site={brand:text(s.brand,60,true),tagline:text(s.tagline,100,true)};
  for(const field of PAIR_FIELDS){
    const value=field==='studioNote'&&(s[field]==null||(Array.isArray(s[field])&&s[field].length===0))?['','']:s[field];
    site[field]=pair(value,field==='heroTitle'?200:3000);
  }
  object(s.colors,['canvas','surface','stone','ink','accent']);
  site.colors={};
  for(const key of ['canvas','surface','stone','ink','accent']) {
    if(!/^#[a-fA-F0-9]{6}$/.test(s.colors[key]||'')) fail('色は6桁のカラーコードで指定してください。');
    site.colors[key]=s.colors[key].toLowerCase();
  }
  for(const bg of ['canvas','surface','stone']) for(const fg of ['ink','accent']) {
    if(contrast(site.colors[bg],site.colors[fg])<4.5) fail('文字と背景のコントラストが不足しています。背景を薄く、文字を濃くしてください。');
  }
  if(contrast('#ffffff',site.colors.accent)<4.5) fail('ボタンの色をもう少し濃くしてください。');
  object(s.projects,PROJECT_IDS);site.projects={};
  const project=p=>({name:text(p.name,60,true),category:pair(p.category,160),title:pair(p.title,200),short:pair(p.short,200),description:pair(p.description,3000),tech:list(p.tech),flow:list(p.flow,6),tags:validateTagIds(p.tags),updatedAt:date(p.updatedAt)});
  const projectFields=['name','category','title','short','description','tech','flow','tags','updatedAt'];
  for(const id of PROJECT_IDS) {const p=s.projects[id];object(p,projectFields);site.projects[id]=project(p);}
  const extra=s.additionalProjects??[];
  if(!Array.isArray(extra)||extra.length>MAX_PROJECTS-PROJECT_IDS.length)fail('作品は合計100件以内にしてください。');
  const projectIds=new Set(PROJECT_IDS);
  site.additionalProjects=extra.map(p=>{
    object(p,[...projectFields,'id','status','demoUrl','repository','image','download']);
    if(typeof p.id!=='string'||!PROJECT_ID_PATTERN.test(p.id)||projectIds.has(p.id)||['__proto__','constructor','prototype'].includes(p.id))fail('作品IDは重複のない半角英数字・ハイフンにしてください。');
    projectIds.add(p.id);
    const status=p.status??'published';if(!['draft','published'].includes(status))fail('作品の表示状態を確認してください。');
    const result={id:p.id,...project(p),updatedAt:date(p.updatedAt,true),status};
    if(p.image!==undefined&&p.image!==''){if(typeof p.image!=='string'||!PROJECT_IMAGE_FILES.includes(p.image))fail('作品画像は登録済みの公開用画像から選んでください。');result.image=p.image;}
    if(p.demoUrl!==undefined&&p.demoUrl!==''){if(!httpsUrl(p.demoUrl))fail('デモURLは認証情報を含まないhttpsのURLにしてください。');result.demoUrl=p.demoUrl;}
    if(p.repository!==undefined&&p.repository!==''){if(typeof p.repository!=='string'||!(/^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,38})\/[a-zA-Z0-9][a-zA-Z0-9._-]{0,99}$/).test(p.repository))fail('GitHubはowner/repository形式で指定してください。');result.repository=p.repository;}
    const download=normalizeProjectDownload(p.download,result.repository);
    if(download)result.download=download;
    return result;
  });
  const draftProjects=new Set(site.additionalProjects.filter(p=>p.status==='draft').map(p=>p.id));
  if(!Array.isArray(value.articles)||value.articles.length>200) fail('記事は200件以内にしてください。');
  const ids=new Set();
  const articles=value.articles.map(a=>{
    object(a,['id','project','date','status','titleJa','titleEn','summaryJa','summaryEn','bodyJa','bodyEn','tags']);
    if(typeof a.id!=='string'||!/^[a-z0-9][a-z0-9-]{0,63}$/.test(a.id)||ids.has(a.id)) fail('記事IDは重複のない半角英数字・ハイフンにしてください。');
    ids.add(a.id);
    const project=a.project??'';
    if((project!==''&&!projectIds.has(project))||!['draft','published'].includes(a.status)||(a.status==='published'&&draftProjects.has(project))) fail('記事の分類・状態を確認してください。公開記事に下書きの作品は指定できません。');
    if(!/^\d{4}-\d{2}-\d{2}$/.test(a.date||'')||Number.isNaN(Date.parse(a.date))||new Date(a.date).toISOString().slice(0,10)!==a.date) fail('記事の日付を確認してください。');
    return {id:a.id,project,date:a.date,status:a.status,titleJa:text(a.titleJa??'',200,a.status==='published'),titleEn:text(a.titleEn??'',200),summaryJa:text(a.summaryJa??'',1000),summaryEn:text(a.summaryEn??'',1000),bodyJa:text(a.bodyJa??'',20000,a.status==='published'),bodyEn:text(a.bodyEn??'',20000),tags:validateTagIds(a.tags)};
  });
  const content={version:1,site,articles,pages:[]};
  if(value.tagCatalog!==undefined)content.tagCatalog=validateTagCatalog(value.tagCatalog);
  if(value.pages!==undefined){
    if(!Array.isArray(value.pages)||value.pages.length>PAGE_IDS.length)fail('案内ページは3件以内にしてください。');
    const pageIds=new Set();
    content.pages=value.pages.map(page=>{
      object(page,['id','titleJa','titleEn','bodyJa','bodyEn']);
      if(!PAGE_IDS.includes(page.id)||pageIds.has(page.id))fail('案内ページのIDはprivacy・guide・contactから重複なく選んでください。');
      pageIds.add(page.id);
      return {id:page.id,titleJa:text(page.titleJa,200,true),titleEn:text(page.titleEn??'',200),bodyJa:text(page.bodyJa,10000,true),bodyEn:text(page.bodyEn??'',10000)};
    });
  }
  return content;
}
export function publicContent(value) {
  const content=validateContent(value);
  content.articles=content.articles.filter(a=>a.status==='published');
  content.site.additionalProjects=content.site.additionalProjects.filter(p=>p.status==='published');
  return resolveContentTags(content);
}
export function localized(value,lang) { return value[lang==='en'?1:0]||value[0]||value[1]||''; }
export function articleCopy(article,key,lang) { return article[`${key}${lang==='en'?'En':'Ja'}`]||article[`${key}Ja`]||article[`${key}En`]||''; }
