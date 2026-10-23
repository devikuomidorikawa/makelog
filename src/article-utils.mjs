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
