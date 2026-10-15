import {readFileSync} from 'node:fs';
import {publicContent} from '../src/content-model.mjs';
import {readContentSource} from './content-store.mjs';

const siteUrl='https://devikuomidorikawa.github.io/makelog/';
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function renderPageHtml(original,page,brand){
  const depth=page.path?page.path.split('/').length:0,prefix=depth?'../'.repeat(depth):'./',url=siteUrl+(page.path?`${page.path}/`:'');
  let html=original.replaceAll('./assets/',`${prefix}assets/`).replace('name="makelog-home" content="./"',`name="makelog-home" content="${prefix}"`);
  html=html.replace(/<title>.*?<\/title>/s,()=>`<title>${escape(page.title)} | ${escape(brand)}</title>`).replace(/<meta name="description" content="[^"]*"\s*\/>/,()=>`<meta name="description" content="${escape(page.description)}" />`);
  return html.replace('</head>',()=>`<link rel="icon" type="image/svg+xml" href="${prefix}assets/favicon.svg" />\n<link rel="canonical" href="${url}" />\n<meta property="og:type" content="${page.path.startsWith('notes/')?'article':'website'}" />\n<meta property="og:title" content="${escape(page.title)} | ${escape(brand)}" />\n<meta property="og:description" content="${escape(page.description)}" />\n<meta property="og:url" content="${url}" />\n<meta property="og:image" content="${siteUrl}assets/campus-main.png" />\n<meta name="twitter:card" content="summary_large_image" />\n</head>`);
}
export function pageEntries(content){
  const data=publicContent(content),rows=[{path:'',title:data.site.heroTitle[0].replaceAll('\n',' '),description:data.site.heroDescription[0]},...[
    ['works','作品一覧'],['notes','制作ノート'],['about','ブランドについて']
  ].map(([path,title])=>({path,title,description:data.site.heroDescription[0]}))];
  for(const page of data.pages)rows.push({path:page.id,title:page.titleJa,description:page.bodyJa.replace(/^#+ /gm,'').split('\n').filter(Boolean).join(' ').slice(0,160)});
  for(const [id,p]of Object.entries(data.site.projects))for(const tab of ['','demo','process','tech','github','comments'])rows.push({path:`works/${id}${tab?`/${tab}`:''}`,title:`${p.name}${tab==='demo'?' — デモ':tab==='process'?' — 制作記録':''}`,description:p.description[0]});
  for(const a of data.articles)rows.push({path:`notes/${a.id}`,title:a.titleJa,description:a.summaryJa});
  return rows;
}
export function staticPages(){return {
  name:'makelog-static-pages',
  generateBundle:{order:'post',handler(options,bundle){
    const index=bundle['index.html'];if(!index||typeof index.source!=='string')throw Error('Static HTML entry is missing');
    const data=readContentSource();
    const rows=pageEntries(data),original=index.source;
    this.emitFile({type:'asset',fileName:'assets/favicon.svg',source:readFileSync(new URL('../public/assets/favicon.svg',import.meta.url))});
    for(const page of rows){
      const html=renderPageHtml(original,page,data.site.brand);
      if(page.path)this.emitFile({type:'asset',fileName:`${page.path}/index.html`,source:html});else index.source=html;
    }
    const notFound=original.replaceAll('./assets/',`${new URL(siteUrl).pathname}assets/`).replace('name="makelog-home" content="./"',`name="makelog-home" content="${new URL(siteUrl).pathname}"`).replace(/<title>.*?<\/title>/s,'<title>ページが見つかりません | MAKELOG</title>').replace('</head>','<meta name="robots" content="noindex" /></head>');
    this.emitFile({type:'asset',fileName:'404.html',source:notFound});
    const canonicalRows=rows.filter(r=>!/(?:\/tech|\/github|\/comments)$/.test(r.path));
    this.emitFile({type:'asset',fileName:'sitemap.xml',source:`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${canonicalRows.map(r=>`<url><loc>${siteUrl}${r.path?`${r.path}/`:''}</loc></url>`).join('')}</urlset>`});
    this.emitFile({type:'asset',fileName:'robots.txt',source:`User-agent: *\nAllow: /\nSitemap: ${siteUrl}sitemap.xml\n`});
  }}
};}
