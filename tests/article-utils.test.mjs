import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeSearch,journalParams,journalQuery,journalReturnContext,articleSearchExcerpt,searchArticles,paginateArticles,relatedArticles} from '../src/article-utils.mjs';
const notes=Array.from({length:200},(_,n)=>({id:`note-${String(n).padStart(3,'0')}`,status:'published',date:`2026-10-${String(1+n%23).padStart(2,'0')}`,titleJa:`制作記録 ${n}`,titleEn:`Build note ${n}`,summaryJa:'設計の記録',summaryEn:'Design notes',project:n%2?'nest':'atlas',tags:n%3?['UI/UX']:['Automation'],bodyJa:n===199?'専用語 フォルダーを整理する':'実装の内容',bodyEn:''}));
test('searches a 200-article corpus including body, excludes drafts and ranks title first',()=>{
 const corpus=[...notes,{...notes[0],id:'draft',status:'draft',titleJa:'専用語'}];
 assert.deepEqual(searchArticles(corpus,{q:'専用語'},notes).map(a=>a.id),['note-199']);
 const candidates=[{...notes[0],id:'title',titleJa:'整理'}, {...notes[1],id:'body',bodyJa:'整理'}];
 assert.deepEqual(searchArticles(candidates,{q:'整理'}).map(a=>a.id),['title','body']);
 assert.equal(searchArticles(corpus,{q:'ＮＥＳＴ'},notes,{nest:{name:'NEST'}}).length,100);
 assert.equal(normalizeSearch(' ＮＥＳＴ  UI '),'nest ui');
});
test('combines all query words, project and exact tag filters',()=>{
 assert.deepEqual(searchArticles(notes,{q:'フォルダー 整理',tag:'UI/UX',project:'nest'},notes).map(a=>a.id),['note-199']);
 assert.equal(searchArticles(notes,{q:'フォルダー 整理',project:'atlas'},notes).length,0);
 assert.equal(searchArticles(notes,{tag:'not-a-tag'}).length,0);
});
test('paginates 200 articles in 17 pages without omissions or duplicates',()=>{
 const found=[];
 for(let page=1;page<=17;page++){const r=paginateArticles(notes,page);assert.equal(r.pages,17);assert.ok(r.items.length<=12);found.push(...r.items.map(a=>a.id));}
 assert.deepEqual(found,notes.map(a=>a.id));
 assert.equal(paginateArticles(notes,999).page,17);
 assert.equal(paginateArticles([],0).page,1);
 assert.deepEqual(paginateArticles([],1).items,[]);
});
test('query, tag, project and page roundtrip safely in bookmark URL',()=>{
 const state={q:'色 & 保存?',tag:'UI/UX',project:'nest',page:12};
 assert.deepEqual(journalParams(journalQuery(state)),state);
 assert.equal(journalParams('?page=-1').page,1);
 assert.equal(journalParams('?page=Infinity').page,1);
 assert.equal(journalParams('?page=1.5').page,1);
 assert.equal(journalParams('?q='+ 'a'.repeat(500)).q.length,160);
 assert.equal(journalQuery({page:1}),'');
});
test('related articles require shared project or tag and prioritise same project',()=>{
 const original={...notes[0],id:'source',project:'nest',tags:['Folders']};
 const related=relatedArticles(original,[original,{...notes[1],id:'tag',project:'atlas',tags:['Folders']},{...notes[2],id:'project',project:'nest',tags:[]},{...notes[3],id:'irrelevant',project:'atlas',tags:[]},{...notes[4],id:'draft',status:'draft',project:'nest'}]);
 assert.deepEqual(related.map(a=>a.id),['project','tag']);
});
test('return context preserves list filters and scroll without accepting an external URL',()=>{
 const value={params:{q:'色 & 保存?',tag:'UI/UX',project:'nest',page:12,href:'https://evil.invalid'},scroll:527.5,articleId:'nest-build-note',url:'https://evil.invalid'};
 assert.deepEqual(journalReturnContext(value),{params:{q:'色 & 保存?',tag:'UI/UX',project:'nest',page:12},scroll:527.5,articleId:'nest-build-note'});
 assert.equal(journalReturnContext(null),null);
 assert.equal(journalReturnContext({url:'https://evil.invalid'}),null);
 assert.deepEqual(journalReturnContext({params:{page:-3},scroll:Infinity,articleId:'bad"] selector'}),{params:{q:'',tag:'',project:'',page:1},scroll:0,articleId:''});
});
test('excerpt reveals body-only matches, bounds surrounding copy and leaves unqueried summaries intact',()=>{
 const article={summaryJa:'通常の概要です。',bodyJa:'前置き。'.repeat(150)+'ショートカットを視覚的に分ける。'+'後半。'.repeat(150)};
 assert.deepEqual(articleSearchExcerpt(article),[{text:article.summaryJa,match:false}]);
 const parts=articleSearchExcerpt(article,'ショートカット');
 assert.deepEqual(parts.filter(p=>p.match).map(p=>p.text),['ショートカット']);
 assert.ok(parts.map(p=>p.text).join('').length<=152);
 assert.ok(parts[0].text.startsWith('…'));assert.ok(parts.at(-1).text.endsWith('…'));
});
test('excerpt highlights NFKC matches against original graphemes and overlapping words',()=>{
 const article={summaryJa:'ＮＥＳＴでｶﾞｲﾄﾞとガイドを管理。ﬃ の例。',bodyJa:''};
 assert.deepEqual(articleSearchExcerpt(article,'nest ガイド ffi').filter(p=>p.match).map(p=>p.text),['ＮＥＳＴ','ｶﾞｲﾄﾞ','ガイド','ﬃ']);
 assert.deepEqual(articleSearchExcerpt({summaryJa:'NEST testing'},'test testing').filter(p=>p.match).map(p=>p.text),['testing']);
});
test('excerpt returns only literal text fragments for hostile HTML and queries',()=>{
 const parts=articleSearchExcerpt({summaryJa:'<img src=x onerror=alert(1)> & <script>evil</script>'},'<script>');
 assert.deepEqual(parts.filter(p=>p.match),[{text:'<script>',match:true}]);
 assert.ok(parts.every(p=>Object.keys(p).sort().join(',')==='match,text'&&typeof p.text==='string'));
 assert.equal(parts.map(p=>p.text).join(''),'<img src=x onerror=alert(1)> & <script>evil</script>');
 assert.ok(articleSearchExcerpt({summaryJa:'概要',bodyEn:'Folder organization'},'organization','ja').some(p=>p.match&&p.text==='organization'));
});
