import test from 'node:test';
import assert from 'node:assert/strict';
import { repositoryUrl, validGiscus, readRoute, routeHash, readPage, routePath, csvCell, navigationCurrent } from '../src/site-utils.mjs';
import {renderPageHtml,pageEntries} from '../scripts/static-pages.mjs';
import {readContentSource} from '../scripts/content-store.mjs';

test('only GitHub owner/repository identifiers can become outbound links', () => {
  assert.equal(repositoryUrl('sample-user/portfolio'), 'https://github.com/sample-user/portfolio');
  for (const value of ['', 'javascript:alert(1)', '//evil.test/x', 'user/repo/issues', 'user/repo?x=1', '../repo']) assert.equal(repositoryUrl(value), null);
});
test('public comments require an explicit complete configuration', () => {
  const c = {enabled:true, repo:'sample-user/comments', repoId:'R_sample', category:'Announcements', categoryId:'DIC_sample'};
  assert.equal(validGiscus(c), true);
  for (const bad of [{...c,enabled:false},{...c,repo:'https://evil.test'},{...c,repoId:''},{...c,categoryId:'<bad>'},{...c,category:''}]) assert.equal(validGiscus(bad), false);
});
test('shared project URLs survive reload with a fixed allowlist', () => {
  const overview = {type:'project',project:'atlas',tab:'overview'};
  assert.deepEqual(readRoute(routeHash(overview)), overview);
  const route = {type:'project',project:'atlas',tab:'comments'};
  assert.deepEqual(readRoute(routeHash(route)), route);
  assert.deepEqual(readRoute('#journal'), {type:'journal'});
  for (const bad of ['#project/unknown/demo','#project/atlas/<script>','#project/atlas/demo/extra']) assert.equal(readRoute(bad), null);
  assert.deepEqual(readRoute('#works'),{type:'works'});
});

test('real static pages round-trip within a GitHub project base, including reload and legacy links',()=>{
  const base='/makelog/';
  for(const route of [null,{type:'works'},{type:'journal'},{type:'about'},{type:'privacy'},{type:'guide'},{type:'contact'},{type:'article',id:'atlas-build-note'},{type:'project',project:'atlas',tab:'overview'},{type:'project',project:'form',tab:'demo',from:'form-build-note'}]){
    const url=new URL(routePath(route,base),'https://example.github.io');
    assert.deepEqual(readPage(url.pathname,url.search,'',base),route);
  }
  assert.deepEqual(readPage('/makelog/','','#article/atlas-build-note',base),{type:'article',id:'atlas-build-note'});
  assert.deepEqual(readPage('/makelog/','','#works',base),{type:'works'});
  for(const path of ['/outside/notes/','/makelog/notes/../secret/','/makelog/works/unknown/','/makelog/works/atlas/%3Cscript%3E/','/makelog/notes/a/extra/'])assert.deepEqual(readPage(path,'','',base),{type:'missing'});
  assert.deepEqual(readPage('/makelog/works/atlas/demo/','?from=../private','',base),{type:'missing'});
  assert.equal(routePath({type:'article',id:'../../secret'},base),base);
});

test('article-to-demo return context round-trips without accepting injected paths', () => {
  const route={type:'project',project:'atlas',tab:'demo',from:'atlas-build-note'};
  assert.deepEqual(readRoute(routeHash(route)),route);
  for(const hash of ['#project/atlas/demo?from=../secret','#project/atlas/demo?from=%3Cscript%3E','#project/atlas/demo?from=a&next=editor','#project/atlas/demo?next=editor'])assert.equal(readRoute(hash),null);
  assert.equal(routeHash({...route,from:'javascript:alert(1)'}),'#project/atlas/demo');
});

test('navigation distinguishes the exact page from its parent section after direct and legacy navigation', () => {
  const base='/makelog/';
  const current=route=>['works','journal','about'].map(section=>navigationCurrent(route,section));
  assert.deepEqual(current(readPage('/makelog/works/','','',base)),['page',undefined,undefined]);
  for(const url of ['/makelog/works/atlas/','/makelog/works/form/demo/','/makelog/works/flow/process/'])
    assert.deepEqual(current(readPage(url,'','',base)),['location',undefined,undefined]);
  assert.deepEqual(current(readPage('/makelog/notes/atlas-build-note/','','',base)),[undefined,'location',undefined]);
  assert.deepEqual(current(readPage('/makelog/','','#article/atlas-build-note',base)),[undefined,'location',undefined]);
  assert.deepEqual(current(readPage('/makelog/notes/','','',base)),[undefined,'page',undefined]);
  assert.deepEqual(current(readPage('/makelog/about/','','',base)),[undefined,undefined,'page']);
  for(const route of [null,{type:'privacy'},{type:'missing'}])
    assert.deepEqual(current(route),[undefined,undefined,undefined]);
});
test('CSV filenames are quoted and formula prefixes remain text', () => {
  assert.equal(csvCell('sample-A.pdf'), '"sample-A.pdf"');
  assert.equal(csvCell('=1+1.pdf'), '"\'=1+1.pdf"');
  assert.equal(csvCell('  @SUM(1).pdf'), '"\'  @SUM(1).pdf"');
  assert.equal(csvCell('a,"b".pdf'), '"a,""b"".pdf"');
});

test('static metadata escapes HTML and treats replacement tokens as literal text',()=>{
  const source='<html><head><title>Old</title><meta name="description" content="Old" /><meta name="makelog-home" content="./" /><script src="./assets/app.js"></script></head><body><div id="root"></div></body></html>';
  const text='$& $` $\' <script> " &';
  const html=renderPageHtml(source,{path:'notes/sample',title:text,description:text},'MAKELOG');
  assert.ok(html.includes('<title>$&amp; $` $&#39; &lt;script&gt; &quot; &amp; | MAKELOG</title>'));
  assert.equal((html.match(/<div id="root">/g)||[]).length,1);
  assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('src="../../assets/app.js"'));
  assert.ok(html.includes('content="../../"'));
});

test('new app routes require known validated IDs and do not synthesize sample demo pages',()=>{
  const data=readContentSource();
  data.site.additionalProjects=[{id:'my-app-2',...structuredClone(data.site.projects.form),status:'published'},{id:'hidden-app',...structuredClone(data.site.projects.form),status:'draft'}];
  const entries=pageEntries(data).map(p=>p.path);
  assert.ok(entries.includes('works/my-app-2'));assert.ok(entries.includes('works/my-app-2/process'));
  assert.ok(!entries.some(p=>p.startsWith('works/hidden-app')));assert.ok(!entries.includes('works/my-app-2/demo'));
  const route={type:'project',project:'my-app-2',tab:'overview'},base='/makelog/';
  assert.equal(routePath(route,base),'/makelog/works/my-app-2/');
  assert.deepEqual(readPage(routePath(route,base),'','',base,['atlas','form','flow','my-app-2']),route);
  assert.deepEqual(readRoute(routeHash(route),['my-app-2']),route);
  assert.deepEqual(readPage('/makelog/works/my-app-2/','','',base),{type:'missing'});
  for(const id of ['../secret','constructor','x'.repeat(65)])assert.equal(routePath({...route,project:id},base),base);
});
