export const MAX_CONTENT_BYTES = 1_000_000;
export const PROJECT_IDS = ['atlas', 'form', 'flow'];
export const PAIR_FIELDS = ['heroTitle','heroDescription','studioBody','studioNote','footer','about'];
export const MAX_TAGS = 8;
export const MAX_TAG_LENGTH = 32;

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
export function contrast(a,b) {
  const light = color => {
    const values=color.slice(1).match(/../g).map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);
    return values[0]*.2126+values[1]*.7152+values[2]*.0722;
  };
  const x=light(a),y=light(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);
}
export function validateContent(value) {
  if (new TextEncoder().encode(JSON.stringify(value)).length>MAX_CONTENT_BYTES) fail('編集データは1MB以内にしてください。');
  object(value,['version','site','articles']);
  if(value.version!==1) fail('対応していない編集データの版です。');
  const s=value.site;object(s,['brand','tagline',...PAIR_FIELDS,'colors','projects']);
  const site={brand:text(s.brand,60,true),tagline:text(s.tagline,100,true)};
  for(const field of PAIR_FIELDS) site[field]=pair(s[field],field==='heroTitle'?200:3000);
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
  for(const id of PROJECT_IDS) {
    const p=s.projects[id];object(p,['name','category','title','short','description','tech','flow','tags']);
    site.projects[id]={name:text(p.name,60,true),category:pair(p.category,160),title:pair(p.title,200),short:pair(p.short,200),description:pair(p.description,3000),tech:list(p.tech),flow:list(p.flow,6),tags:validateTags(p.tags)};
  }
  if(!Array.isArray(value.articles)||value.articles.length>200) fail('記事は200件以内にしてください。');
  const ids=new Set();
  const articles=value.articles.map(a=>{
    object(a,['id','project','date','status','titleJa','titleEn','summaryJa','summaryEn','bodyJa','bodyEn','tags']);
    if(typeof a.id!=='string'||!/^[a-z0-9][a-z0-9-]{0,63}$/.test(a.id)||ids.has(a.id)) fail('記事IDは重複のない半角英数字・ハイフンにしてください。');
    ids.add(a.id);
    const project=a.project??'';
    if(!['',...PROJECT_IDS].includes(project)||!['draft','published'].includes(a.status)) fail('記事の分類・状態を確認してください。');
    if(!/^\d{4}-\d{2}-\d{2}$/.test(a.date||'')||Number.isNaN(Date.parse(a.date))||new Date(a.date).toISOString().slice(0,10)!==a.date) fail('記事の日付を確認してください。');
    return {id:a.id,project,date:a.date,status:a.status,titleJa:text(a.titleJa??'',200,a.status==='published'),titleEn:text(a.titleEn??'',200),summaryJa:text(a.summaryJa??'',1000),summaryEn:text(a.summaryEn??'',1000),bodyJa:text(a.bodyJa??'',20000,a.status==='published'),bodyEn:text(a.bodyEn??'',20000),tags:validateTags(a.tags)};
  });
  return {version:1,site,articles};
}
export function publicContent(value) {
  const content=validateContent(value);
  content.articles=content.articles.filter(a=>a.status==='published');
  return content;
}
export function localized(value,lang) { return value[lang==='en'?1:0]||value[0]||value[1]||''; }
export function articleCopy(article,key,lang) { return article[`${key}${lang==='en'?'En':'Ja'}`]||article[`${key}Ja`]||article[`${key}En`]||''; }
