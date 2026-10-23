// Read-only public GitHub data. Authentication and every write stay in Pages CMS.
export const REPOSITORY='devikuomidorikawa/makelog';
export const CMS_ROOT=`https://app.pagescms.org/${REPOSITORY}/main`;
export const WORKFLOW_URL=`https://github.com/${REPOSITORY}/actions/workflows/pages.yml`;
const API=`https://api.github.com/repos/${REPOSITORY}`;
const validId=value=>typeof value==='string'&&/^[a-z0-9][a-z0-9-]{0,63}$/.test(value)&&!['constructor','prototype','__proto__'].includes(value);
const validSha=value=>typeof value==='string'&&/^[a-f0-9]{40}$/.test(value);
export function articleEditorUrl(id){if(!validId(id))throw Error('記事IDを確認してください。');return `${CMS_ROOT}/collection/articles/edit/${encodeURIComponent(`src/content/articles/${id}.json`)}`;}
export function editorMetadata(value,id){
 if(!value||value.id!==id||!validId(id)||!['draft','published'].includes(value.status))throw Error('記事の形式を確認できません。');
 const text=(key,max)=>typeof value[key]==='string'?value[key].slice(0,max):'';
 return {id,titleJa:text('titleJa',200),titleEn:text('titleEn',200),summaryJa:text('summaryJa',1000),status:value.status,project:text('project',64),date:text('date',10),updatedAt:text('updatedAt',10)||text('date',10),translationStatus:['missing','needs-update','current'].includes(value.translationStatus)?value.translationStatus:'missing'};
}
export function filterEditorArticles(articles,{query='',status='',project='',translation=''}={}){
 const terms=String(query).normalize('NFKC').toLowerCase().trim().split(/\s+/).filter(Boolean);
 return articles.filter(a=>(!status||a.status===status)&&(!project||a.project===project)&&(!translation||a.translationStatus===translation)&&terms.every(term=>`${a.titleJa} ${a.titleEn||''} ${a.summaryJa||''} ${a.id} ${a.project||''}`.normalize('NFKC').toLowerCase().includes(term))).sort((a,b)=>(b.updatedAt||b.date||'').localeCompare(a.updatedAt||a.date||'')||a.id.localeCompare(b.id));
}
async function readJson(url,limit,signal){
 const response=await fetch(url,{signal,credentials:'omit',redirect:'error',cache:'no-store',referrerPolicy:'no-referrer'});
 if(!response.ok)throw Error(response.status===403||response.status===429?'GitHubの読み込み上限に達しました。時間をおいて再度お試しください。':'GitHubから読み込めませんでした。CMSは下のリンクから開けます。');
 if(Number(response.headers.get('content-length'))>limit)throw Error('データが大きすぎます。CMSで確認してください。');
 const reader=response.body.getReader(),chunks=[];let bytes=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>limit)throw Error('データが大きすぎます。CMSで確認してください。');chunks.push(value);}}finally{await reader.cancel();reader.releaseLock();}
 const buffer=new Uint8Array(bytes);let offset=0;for(const chunk of chunks){buffer.set(chunk,offset);offset+=chunk.length;}
 return {data:JSON.parse(new TextDecoder().decode(buffer)),bytes};
}
async function currentSha(signal){const {data}=await readJson(`${API}/git/ref/heads/main`,16384,signal);if(!validSha(data.object?.sha))throw Error('保存元を確認できません。');return data.object.sha;}
export async function loadEditorArticles({signal,onProgress=()=>{}}={}){
 const sha=await currentSha(signal);
 const {data:files}=await readJson(`${API}/contents/src/content/articles?ref=${sha}`,2097152,signal);
 if(!Array.isArray(files)||files.length>1000)throw Error('記事一覧の形式を確認できません。');
 const entries=files.filter(f=>f.type==='file'&&typeof f.name==='string'&&f.name.endsWith('.json'));
 if(entries.some(f=>!validId(f.name.slice(0,-5))||f.size>262144)||entries.reduce((n,f)=>n+(f.size||0),0)>20971520)throw Error('記事データの上限を超えています。');
 const rows=[];let cursor=0,bytes=0,finished=0;onProgress(0,entries.length);
 // A local child signal stops sibling reads on failure, without cancelling the caller.
 const controller=new AbortController(),abort=()=>controller.abort();signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)controller.abort();
 try{await Promise.all(Array.from({length:Math.min(4,entries.length)},async()=>{while(cursor<entries.length){const file=entries[cursor++],id=file.name.slice(0,-5);const result=await readJson(`https://raw.githubusercontent.com/${REPOSITORY}/${sha}/src/content/articles/${id}.json`,262144,controller.signal);bytes+=result.bytes;if(bytes>20971520)throw Error('記事データの上限を超えています。');rows.push(editorMetadata(result.data,id));onProgress(++finished,entries.length);}}));return {articles:rows,sha};}
 catch(error){controller.abort();throw error;}finally{signal?.removeEventListener('abort',abort);}
}
export function deploymentState(sha,run){
 if(!validSha(sha))return 'unknown';
 if(!run||run.head_sha!==sha)return 'waiting';
 if(run.status!=='completed')return 'running';
 return run.conclusion==='success'?'published':'failed';
}
export async function checkDeployment(signal){
 const sha=await currentSha(signal),{data}=await readJson(`${API}/actions/workflows/pages.yml/runs?branch=main&per_page=5`,262144,signal);
 const run=Array.isArray(data.workflow_runs)?data.workflow_runs.find(r=>r.head_sha===sha):null;
 return {state:deploymentState(sha,run),sha,checkedAt:new Date().toLocaleTimeString('ja-JP',{hour:'2-digit',minute:'2-digit'})};
}
