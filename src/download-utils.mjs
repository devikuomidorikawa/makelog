// Release links are data, never arbitrary external URLs or filesystem paths.
export const DOWNLOAD_PAIR_LIMITS = {label:200,requirements:300,notice:500,instructions:1500};
const fields=['tag','file',...Object.keys(DOWNLOAD_PAIR_LIMITS)];
const repositoryPattern=/^[a-zA-Z0-9][a-zA-Z0-9-]{0,38}\/[a-zA-Z0-9][a-zA-Z0-9._-]{0,99}$/;
const plainObject=value=>value&&typeof value==='object'&&!Array.isArray(value)&&[Object.prototype,null].includes(Object.getPrototypeOf(value));
const blank=value=>value===''||value===undefined||(Array.isArray(value)&&value.length===2&&value.every(item=>item===''));
const fail=()=>{throw new Error('ダウンロード設定を確認してください。GitHub、タグ、ZIP名と日英の案内をすべて入力してください。');};

export function normalizeProjectDownload(value,repository) {
  if(value===undefined)return undefined;
  if(!plainObject(value)||Object.keys(value).some(key=>!fields.includes(key)))fail();
  // Both CMS and the local studio may serialize an untouched optional form.
  if(Object.values(value).every(blank))return undefined;
  if(typeof repository!=='string'||!repositoryPattern.test(repository))fail();
  if(typeof value.tag!=='string'||!(/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/).test(value.tag)||['.','..'].includes(value.tag))fail();
  if(typeof value.file!=='string'||!(/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,159}$/).test(value.file)||!(/\.zip$/i).test(value.file)||value.file.includes('..'))fail();
  const result={tag:value.tag,file:value.file};
  for(const [key,max] of Object.entries(DOWNLOAD_PAIR_LIMITS)){
    const pair=value[key];
    if(!Array.isArray(pair)||pair.length!==2||pair.some(text=>typeof text!=='string'||!text.trim()||text.length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/.test(text)))fail();
    result[key]=[...pair];
  }
  return result;
}

export function projectDownload(project) {
  try {
    if(!plainObject(project))return null;
    const download=normalizeProjectDownload(project.download,project.repository);
    if(!download)return null;
    const base=`https://github.com/${project.repository}`;
    return {
      url:`${base}/releases/download/${download.tag}/${download.file}`,
      releaseUrl:`${base}/releases/tag/${download.tag}`,
      licenseUrl:`${base}/blob/main/LICENSE.txt`,
      privacyUrl:`${base}/blob/main/PRIVACY.txt`
    };
  } catch {return null;}
}
