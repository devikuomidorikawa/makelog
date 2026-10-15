import { readFile, writeFile, rename, unlink, lstat } from 'node:fs/promises';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { validateContent, publicContent, MAX_CONTENT_BYTES } from '../src/content-model.mjs';

const moduleId='virtual:makelog-content', resolvedId='\0'+moduleId;
export const revision = text => createHash('sha256').update(text).digest('hex');
export function allowedLocalRequest(request,port,write=false,token='') {
  const expected=`127.0.0.1:${port}`;
  if(request.headers.host!==expected||!['127.0.0.1','::ffff:127.0.0.1'].includes(request.socket.remoteAddress)) return false;
  const origin=request.headers.origin;
  if(origin&&origin!==`http://${expected}`) return false;
  if(write) {
    const provided=request.headers['x-makelog-token'];
    if(origin!==`http://${expected}`||request.headers['content-type']!=='application/json'||typeof provided!=='string'||!/^[a-f0-9]{64}$/.test(provided)||provided.length!==token.length||!token) return false;
    return timingSafeEqual(Buffer.from(provided),Buffer.from(token));
  }
  return true;
}
export async function atomicSave(file,expected,content) {
  // Only this fixed content file can be changed; user input never becomes a path.
  const folder=new URL('./',file);
  for(const target of [folder,file]) {
    const stat=await lstat(target);
    if(stat.isSymbolicLink()||(!stat.isFile()&&!stat.isDirectory())||stat.nlink>1&&stat.isFile()) throw new Error('編集ファイルの保存先を確認してください。');
  }
  const before=await readFile(file,'utf8');
  if(revision(before)!==expected) {const error=new Error('別の画面で変更されています。最新版を読み込んでから保存してください。');error.status=409;throw error;}
  const data=validateContent(content), next=JSON.stringify(data,null,2)+'\n';
  const temporary=new URL(`.save-${randomBytes(12).toString('hex')}.tmp`,folder);
  try {await writeFile(temporary,next,{flag:'wx',mode:0o600});await rename(temporary,file);}
  finally {await unlink(temporary).catch(()=>{});}
  return {content:data,revision:revision(next)};
}
export function contentPlugin() {
  const file=new URL('../src/content/site.json',import.meta.url);
  let development=false;
  return {
    name:'makelog-editable-content',
    configResolved(config){development=config.command==='serve';},
    resolveId(id){return id===moduleId?resolvedId:null;},
    async load(id){
      if(id!==resolvedId) return;
      this.addWatchFile(fileURLToPath(file));
      const data=JSON.parse(await readFile(file,'utf8'));
      return `export default ${JSON.stringify(development?validateContent(data):publicContent(data))};`;
    },
    configureServer(server){
      const token=randomBytes(32).toString('hex');let queue=Promise.resolve();
      // Vite development only. A production static site has no write endpoint.
      server.middlewares.use(async(req,res,next)=>{
        if(req.url!=='/__makelog/editor') return next();
        const port=server.httpServer?.address()?.port;
        const send=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json;charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data));};
        if(!allowedLocalRequest(req,port,req.method==='POST',token)) return send(403,{error:'この端末の編集画面から操作してください。'});
        try {
          if(req.method==='GET') {const raw=await readFile(file,'utf8');return send(200,{token,revision:revision(raw),content:validateContent(JSON.parse(raw))});}
          if(req.method!=='POST') return send(405,{error:'対応していない操作です。'});
          let size=0;const chunks=[];
          for await(const chunk of req){size+=chunk.length;if(size>MAX_CONTENT_BYTES+1024)return send(413,{error:'編集データは1MB以内にしてください。'});chunks.push(chunk);}
          const payload=JSON.parse(Buffer.concat(chunks).toString('utf8'));
          if(!payload||typeof payload.revision!=='string'||!/^\w{64}$/.test(payload.revision)) return send(400,{error:'保存元を確認してください。'});
          const operation=queue.then(()=>atomicSave(file,payload.revision,payload.content));
          queue=operation.catch(()=>{});const saved=await operation;
          // Source is intentionally not watched by HMR: saving must preserve editor state.
          return send(200,saved);
        }catch(error){send(error.status||400,{error:error.code?'保存できませんでした。書き込み先を確認してください。':error.message||'入力内容を確認してください。'});}
      });
    },
    handleHotUpdate(ctx){
      if(ctx.file.replaceAll('\\','/')===fileURLToPath(file).replaceAll('\\','/')) {
        const module=ctx.server.moduleGraph.getModuleById(resolvedId);
        if(module) ctx.server.moduleGraph.invalidateModule(module);
        return []; // The save response updates the current page; reload reads saved content.
      }
    },
  };
}
