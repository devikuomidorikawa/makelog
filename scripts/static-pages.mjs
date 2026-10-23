import {readFileSync,lstatSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {publicContent,projectEntries,PROJECT_IDS,validateMediaPath} from '../src/content-model.mjs';
import {renderArticleHtml,escapeHtml as escape} from '../src/article-render.mjs';
import {readContentSource} from './content-store.mjs';

const siteUrl='https://devikuomidorikawa.github.io/makelog/';
const builtinImages={atlas:'campus-main.png',form:'form-preview.png',flow:'flow-preview.png'};
export function articleImage(article,projects){return article.images?.[0]?.src||projects.get(article.project)?.image||builtinImages[article.project]||'brand-share.jpg';}
export function renderPageHtml(original,page,brand){
  const depth=page.path?page.path.split('/').length:0,prefix=depth?'../'.repeat(depth):'./',url=siteUrl+(page.path?page.path+'/':'');
  let html=original.replaceAll('./assets/',prefix+'assets/').replace('name="makelog-home" content="./"','name="makelog-home" content="'+prefix+'"');
  html=html.replace(/<title>.*?<\/title>/s,()=>'<title>'+escape(page.title)+' | '+escape(brand)+'</title>').replace(/<meta name="description" content="[^"]*"\s*\/>/,()=>'<meta name="description" content="'+escape(page.description)+'" />');
  html=html.replace('</head>',()=>'<link rel="icon" type="image/svg+xml" href="'+prefix+'assets/favicon.svg" />\n<link rel="canonical" href="'+url+'" />\n<meta property="og:type" content="'+(page.article?'article':'website')+'" />\n<meta property="og:title" content="'+escape(page.title)+' | '+escape(brand)+'" />\n<meta property="og:description" content="'+escape(page.description)+'" />\n<meta property="og:url" content="'+url+'" />\n<meta property="og:image" content="'+siteUrl+'assets/'+escape(page.image||'brand-share.jpg')+'" />\n<meta name="twitter:card" content="summary_large_image" />\n</head>');
  if(page.article){
    const article=page.article,images=(article.images||[]).map(image=>'<figure><img src="'+prefix+'assets/'+escape(image.src)+'" alt="'+escape(image.altJa)+'" loading="lazy" />'+(image.captionJa?'<figcaption>'+escape(image.captionJa)+'</figcaption>':'')+'</figure>').join('');
    const body='<div class="page-shell"><header class="site-header"><a class="wordmark" href="'+prefix+'">'+escape(brand)+'</a><nav aria-label="メインナビゲーション"><a href="'+prefix+'works/">作品一覧</a> · <a href="'+prefix+'notes/">制作ノート</a></nav></header><main id="main" class="detail-page editorial-dialog"><nav class="page-breadcrumb" aria-label="パンくず"><a href="'+prefix+'">ホーム</a> / <a href="'+prefix+'notes/">制作ノート</a> / <span aria-current="page">記事</span></nav><article class="full-article"><header><p><time datetime="'+article.date+'">'+article.date+'</time></p><h1>'+escape(article.titleJa)+'</h1><p class="article-summary">'+escape(article.summaryJa)+'</p></header><div class="article-images">'+images+'</div><div class="article-body">'+renderArticleHtml(article.bodyJa)+'</div></article></main></div>';
    html=html.replace('<div id="root"></div>',()=>'<div id="root">'+body+'</div>').replace(/<noscript>.*?<\/noscript>/s,'<noscript>この記事はJavaScriptなしでも読めます。検索や表示言語の切り替えにはJavaScriptを有効にしてください。</noscript>');
  }
  return html;
}
export function pageEntries(content){
  const data=publicContent(content),projects=new Map(projectEntries(data.site)),rows=[{path:'',title:data.site.heroTitle[0].replaceAll('\n',' '),description:data.site.heroDescription[0]},...[
    ['works','作品一覧'],['notes','制作ノート'],['about','ブランドについて']
  ].map(([path,title])=>({path,title,description:data.site.heroDescription[0]}))];
  for(const page of data.pages)rows.push({path:page.id,title:page.titleJa,description:page.bodyJa.replace(/^#+ /gm,'').split('\n').filter(Boolean).join(' ').slice(0,160)});
  for(const [id,p]of projects)for(const tab of (PROJECT_IDS.includes(id)?['','demo','process','tech','github','comments']:['','process']))rows.push({path:'works/'+id+(tab?'/'+tab:''),title:p.name+(tab==='demo'?' — デモ':tab==='process'?' — 制作記録':''),description:p.description[0],image:p.image||builtinImages[id]});
  for(const a of data.articles)rows.push({path:'notes/'+a.id,title:a.titleJa,description:a.summaryJa,article:a,image:articleImage(a,projects)});
  return rows;
}
export function articleAssets(content){
  const data=publicContent(content);
  return [...data.articles.map(article=>({fileName:'assets/articles/'+article.id+'.json',source:JSON.stringify(article)})),{fileName:'assets/search-index.json',source:JSON.stringify(data.articles.map(({id,titleJa,titleEn,summaryJa,summaryEn,bodyJa,bodyEn,tags,project,date,updatedAt})=>({id,titleJa,titleEn,summaryJa,summaryEn,bodyJa,bodyEn,tags,project,date,updatedAt})))}];
}
function validMagic(bytes,extension){
  if(extension==='png')return bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  if(extension==='jpg'||extension==='jpeg')return bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
  if(extension==='gif')return ['GIF87a','GIF89a'].includes(bytes.toString('ascii',0,6));
  if(extension==='webp')return bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP';
  if(extension==='avif')return bytes.toString('ascii',4,8)==='ftyp'&&['avif','avis'].includes(bytes.toString('ascii',8,12));
  return false;
}
export function referencedMedia(content,assetRoot=new URL('../public/assets/',import.meta.url)){
  const data=publicContent(content),references=[...projectEntries(data.site).map(([,p])=>p.image),...data.articles.flatMap(a=>(a.images||[]).map(image=>image.src))].filter(Boolean),root=fileURLToPath(assetRoot),assets=[];let total=0;
  for(const source of new Set(references)){
    validateMediaPath(source);if(!source.startsWith('media/'))continue;
    let current=path.resolve(root);const rootStat=lstatSync(current);if(rootStat.isSymbolicLink()||!rootStat.isDirectory())throw Error('公開画像フォルダーを確認してください。');
    const parts=source.split('/');
    for(let i=0;i<parts.length;i++){current=path.join(current,parts[i]);const stat=lstatSync(current);if(stat.isSymbolicLink()||(i<parts.length-1?!stat.isDirectory():!stat.isFile()||stat.nlink!==1||stat.size>8*1024*1024))throw Error('公開画像は通常のファイル、1枚8MB以内にしてください。');}
    const bytes=readFileSync(current);total+=bytes.length;
    if(bytes.length>8*1024*1024||total>50*1024*1024||!validMagic(bytes,source.split('.').at(-1).toLowerCase()))throw Error('公開画像の形式または容量を確認してください（画像合計50MB以内）。');
    assets.push({fileName:'assets/'+source,source:bytes});
  }
  return assets;
}
export function staticPages(){return {
  name:'makelog-static-pages',
  generateBundle:{order:'post',handler(options,bundle){
    const index=bundle['index.html'];if(!index||typeof index.source!=='string')throw Error('Static HTML entry is missing');
    const data=readContentSource(),rows=pageEntries(data),original=index.source;
    this.emitFile({type:'asset',fileName:'assets/favicon.svg',source:readFileSync(new URL('../public/assets/favicon.svg',import.meta.url))});
    this.emitFile({type:'asset',fileName:'assets/brand-share.jpg',source:readFileSync(new URL('../public/assets/brand-share.jpg',import.meta.url))});
    for(const asset of [...articleAssets(data),...referencedMedia(data)])this.emitFile({type:'asset',...asset});
    for(const page of rows){const html=renderPageHtml(original,page,data.site.brand);if(page.path)this.emitFile({type:'asset',fileName:page.path+'/index.html',source:html});else index.source=html;}
    const notFound=original.replaceAll('./assets/',new URL(siteUrl).pathname+'assets/').replace('name="makelog-home" content="./"','name="makelog-home" content="'+new URL(siteUrl).pathname+'"').replace(/<title>.*?<\/title>/s,'<title>ページが見つかりません | MAKELOG</title>').replace('</head>','<meta name="robots" content="noindex" /></head>');
    this.emitFile({type:'asset',fileName:'404.html',source:notFound});
    const canonicalRows=rows.filter(r=>!/(?:\/tech|\/github|\/comments)$/.test(r.path));
    this.emitFile({type:'asset',fileName:'sitemap.xml',source:'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+canonicalRows.map(r=>'<url><loc>'+siteUrl+(r.path?r.path+'/':'')+'</loc></url>').join('')+'</urlset>'});
    this.emitFile({type:'asset',fileName:'robots.txt',source:'User-agent: *\nAllow: /\nSitemap: '+siteUrl+'sitemap.xml\n'});
  }}
};}
