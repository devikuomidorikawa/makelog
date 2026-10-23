export const ARTICLES_PER_PAGE=12;
export const normalizeSearch=value=>String(value??'').normalize('NFKC').toLocaleLowerCase().replace(/\s+/g,' ').trim();
export function journalParams(search=''){
 const p=new URLSearchParams(search),page=Number(p.get('page'));
 return {q:(p.get('q')||'').slice(0,160),tag:(p.get('tag')||'').slice(0,100),project:(p.get('project')||'').slice(0,64),page:Number.isSafeInteger(page)&&page>0?Math.min(page,10000):1};
}
export function journalQuery(state={}){
 const p=new URLSearchParams();
 for(const name of ['q','tag','project'])if(state[name])p.set(name,String(state[name]).slice(0,name==='q'?160:name==='tag'?100:64));
 if(Number.isSafeInteger(Number(state.page))&&Number(state.page)>1)p.set('page',String(Math.min(Number(state.page),10000)));
 return p.size?`?${p}`:'';
}
// Only internal list state is retained: never accept an arbitrary return URL.
export function journalReturnContext(value){
 if(!value||typeof value!=='object'||!value.params||typeof value.params!=='object')return null;
 const params=journalParams(journalQuery(value.params));
 const scroll=Number.isFinite(value.scroll)?Math.max(0,Math.min(value.scroll,10000000)):0;
 const articleId=typeof value.articleId==='string'&&/^[a-z0-9][a-z0-9-]{0,63}$/.test(value.articleId)?value.articleId:'';
 return {params,scroll,articleId};
}
function searchText(value){return String(value||'').replace(/!\[([^\]]*)\]\([^)]*\)/g,'$1').replace(/\[([^\]]*)\]\([^)]*\)/g,'$1').replace(/^\s{0,3}(?:#{1,6}\s+|[-*+]\s+|```[^\n]*$)/gm,'').replace(/[*_`]/g,'').replace(/\s+/g,' ').trim();}
// Map normalized graphemes back to the original text, including full-width letters,
// ligatures and combining kana. Returned fragments are rendered as React text nodes.
function mappedText(text){
 const map=[],segments=new Intl.Segmenter(undefined,{granularity:'grapheme'}).segment(text);let normalized='';
 for(const {segment,index} of segments){const folded=segment.normalize('NFKC').toLocaleLowerCase();normalized+=folded;for(let n=0;n<folded.length;n++)map.push({start:index,end:index+segment.length});}
 return {normalized,map};
}
export function articleSearchExcerpt(article,query='',lang='ja',limit=150){
 const terms=normalizeSearch(query).split(' ').filter(Boolean),summary=searchText(article?.[lang==='en'?'summaryEn':'summaryJa']||article?.summaryJa);
 if(!terms.length)return [{text:summary,match:false}];
 const other=lang==='en'?'Ja':'En',preferred=lang==='en'?'En':'Ja';
 const candidates=[summary,searchText(article?.[`body${preferred}`]),searchText(article?.[`body${other}`])].filter(Boolean);
 const text=candidates.find(value=>terms.some(term=>normalizeSearch(value).includes(term)))||summary;
 const {normalized,map}=mappedText(text),ranges=[];
 for(const term of terms){let offset=0;while(offset<normalized.length){const at=normalized.indexOf(term,offset);if(at<0)break;ranges.push([map[at].start,map[at+term.length-1].end]);offset=at+term.length;}}
 ranges.sort((a,b)=>a[0]-b[0]);const merged=[];
 for(const range of ranges){const last=merged.at(-1);if(last&&range[0]<=last[1])last[1]=Math.max(last[1],range[1]);else merged.push([...range]);}
 const first=merged[0],start=first?Math.max(0,first[0]-40):0,end=Math.min(text.length,Math.max(start+limit,first?.[1]||0));
 const parts=[];let cursor=start;
 if(start)parts.push({text:'…',match:false});
 for(const [a,b]of merged){if(b<=start||a>=end)continue;if(a>cursor)parts.push({text:text.slice(cursor,a),match:false});parts.push({text:text.slice(Math.max(a,start),Math.min(b,end)),match:true});cursor=Math.min(b,end);}
 if(cursor<end)parts.push({text:text.slice(cursor,end),match:false});if(end<text.length)parts.push({text:'…',match:false});
 return parts;
}
export const byNewest=(a,b)=>String(b.date||'').localeCompare(String(a.date||''))||a.id.localeCompare(b.id);
export function searchArticles(articles,{q='',tag='',project=''}={},index=[],projects={}){
 const terms=normalizeSearch(q).split(' ').filter(Boolean),lookup=new Map(index.map(a=>[a.id,a]));
 return articles.filter(a=>a.status==='published'&&(!tag||a.tags?.includes(tag))&&(!project||a.project===project)).map(a=>{
  const full=lookup.get(a.id)||a,title=normalizeSearch(`${a.titleJa} ${a.titleEn||''}`),summary=normalizeSearch(`${a.summaryJa} ${a.summaryEn||''}`),context=normalizeSearch(`${projects[a.project]?.name||''} ${a.project||''} ${(a.tags||[]).join(' ')}`),body=normalizeSearch(`${full.bodyJa||''} ${full.bodyEn||''}`);
  const fields=[title,summary,context,body];
  if(!terms.every(term=>fields.some(field=>field.includes(term))))return null;
  const score=terms.reduce((sum,term)=>sum+(title.includes(term)?8:0)+(summary.includes(term)?4:0)+(context.includes(term)?2:0)+(body.includes(term)?1:0),0);
  return {article:a,score};
 }).filter(Boolean).sort((a,b)=>b.score-a.score||byNewest(a.article,b.article)).map(v=>v.article);
}
export function paginateArticles(articles,page=1,pageSize=ARTICLES_PER_PAGE){
 const pages=Math.max(1,Math.ceil(articles.length/pageSize)),current=Math.max(1,Math.min(pages,Number(page)||1));
 return {items:articles.slice((current-1)*pageSize,current*pageSize),page:current,pages,total:articles.length};
}
export function relatedArticles(article,articles,limit=3){
 return articles.filter(a=>a.status==='published'&&a.id!==article.id).map(a=>({article:a,same:!!article.project&&a.project===article.project,shared:(a.tags||[]).filter(t=>article.tags?.includes(t)).length})).filter(v=>v.same||v.shared).sort((a,b)=>Number(b.same)-Number(a.same)||b.shared-a.shared||byNewest(a.article,b.article)).slice(0,limit).map(v=>v.article);
}
