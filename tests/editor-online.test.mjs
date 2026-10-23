import test from 'node:test';
import assert from 'node:assert/strict';
import {articleEditorUrl,editorMetadata,filterEditorArticles,deploymentState,loadEditorArticles} from '../src/editor-online.mjs';

test('CMS links only use fixed repository and bounded IDs',()=>{
 assert.equal(articleEditorUrl('nest-build-note'),'https://app.pagescms.org/devikuomidorikawa/makelog/main/collection/articles/edit/src%2Fcontent%2Farticles%2Fnest-build-note.json');
 for(const id of ['../x','a/b','x?ref=else','__proto__','constructor','https://other.test', 'x'.repeat(65)])assert.throws(()=>articleEditorUrl(id));
});
test('remote metadata strips bodies, HTML stays inert data and IDs must match',()=>{
 const data=editorMetadata({id:'draft-a',titleJa:'<img onerror=x>',status:'draft',bodyJa:'private body',token:'secret',date:'2026-10-01'},'draft-a');
 assert.equal(data.titleJa,'<img onerror=x>');assert.equal(data.bodyJa,undefined);assert.equal(data.token,undefined);
 assert.throws(()=>editorMetadata({id:'other',status:'published'},'draft-a'));
});
test('200 item editing list filters drafts, full width words and translation; orders by update',()=>{
 const items=Array.from({length:200},(_,i)=>({id:`note-${i}`,titleJa:`NEST 検証 ${i}`,status:i%2?'draft':'published',project:'nest',updatedAt:i===199?'2026-10-23':'2026-10-01',translationStatus:'needs-update'}));
 const rows=filterEditorArticles(items,{query:'ＮＥＳＴ 検証',status:'draft',translation:'needs-update',project:'nest'});
 assert.equal(rows.length,100);assert.equal(rows[0].id,'note-199');assert.equal(filterEditorArticles(items,{query:'missing'}).length,0);
});
test('deployment success must match latest saved main SHA',()=>{
 const sha='a'.repeat(40);
 assert.equal(deploymentState(sha,{head_sha:'b'.repeat(40),status:'completed',conclusion:'success'}),'waiting');
 assert.equal(deploymentState(sha,{head_sha:sha,status:'in_progress'}),'running');
 assert.equal(deploymentState(sha,{head_sha:sha,status:'completed',conclusion:'failure'}),'failed');
 assert.equal(deploymentState(sha,{head_sha:sha,status:'completed',conclusion:'success'}),'published');
});
test('source loading pins every read to one commit, omits credentials and rejects hostile names',async()=>{
 const original=globalThis.fetch,sha='c'.repeat(40),urls=[];
 try{
 globalThis.fetch=async(url,options)=>{urls.push(url);assert.equal(options.credentials,'omit');assert.equal(options.redirect,'error');return new Response(JSON.stringify(url.includes('/git/ref/')?{object:{sha}}:url.includes('/contents/')?[{type:'file',name:'new-draft.json',size:120}]:{id:'new-draft',status:'draft',titleJa:'新しい下書き',bodyJa:'not retained'}));};
 const result=await loadEditorArticles();assert.equal(result.articles[0].titleJa,'新しい下書き');assert.equal(result.articles[0].bodyJa,undefined);assert.ok(urls[1].endsWith(`?ref=${sha}`));assert.ok(urls[2].includes(`/${sha}/src/content/articles/`));
 globalThis.fetch=async url=>new Response(JSON.stringify(url.includes('/git/ref/')?{object:{sha}}:[{type:'file',name:'../evil.json',size:100}]));
 await assert.rejects(loadEditorArticles());
 }finally{globalThis.fetch=original;}
});
