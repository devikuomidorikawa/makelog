import test from 'node:test';
import assert from 'node:assert/strict';
import { repositoryUrl, validGiscus, readRoute, routeHash, csvCell } from '../src/site-utils.mjs';

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
  for (const bad of ['#project/unknown/demo','#project/atlas/<script>','#project/atlas/demo/extra','#works']) assert.equal(readRoute(bad), null);
});
test('CSV filenames are quoted and formula prefixes remain text', () => {
  assert.equal(csvCell('sample-A.pdf'), '"sample-A.pdf"');
  assert.equal(csvCell('=1+1.pdf'), '"\'=1+1.pdf"');
  assert.equal(csvCell('  @SUM(1).pdf'), '"\'  @SUM(1).pdf"');
  assert.equal(csvCell('a,"b".pdf'), '"a,""b"".pdf"');
});
