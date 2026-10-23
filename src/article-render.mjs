// One deliberately small Markdown grammar for server HTML and React readers.
// Raw HTML is text. Links accept credential-free HTTPS only.
export const escapeHtml=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function safeArticleLink(value){
  if(typeof value!=='string'||value.length>2048||!/^https:\/\//.test(value)||/[\s\u0000-\u001f\u007f]/.test(value))return null;
  try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&u.hostname?u.href:null;}catch{return null;}
}
export function parseInline(text){
  const result=[],pattern=/(\*\*[^*\n]+\*\*|`[^`\n]+`|\[[^\]\n]+\]\([^\s)]+\))/g;let start=0;
  for(const match of text.matchAll(pattern)){
    if(match.index>start)result.push({type:'text',text:text.slice(start,match.index)});
    const raw=match[0];
    if(raw.startsWith('**'))result.push({type:'strong',text:raw.slice(2,-2)});
    else if(raw.startsWith('`'))result.push({type:'code',text:raw.slice(1,-1)});
    else{const end=raw.indexOf(']('),href=safeArticleLink(raw.slice(end+2,-1));result.push(href?{type:'link',text:raw.slice(1,end),href}:{type:'text',text:raw});}
    start=match.index+raw.length;
  }
  if(start<text.length)result.push({type:'text',text:text.slice(start)});
  return result;
}
export function parseArticle(text=''){
  const lines=String(text).replace(/\r\n?/g,'\n').split('\n'),blocks=[];let i=0,heading=0;
  while(i<lines.length){
    if(!lines[i].trim()){i++;continue;}
    if(/^```/.test(lines[i])){const language=lines[i].slice(3).trim();const code=[];i++;while(i<lines.length&&!/^```\s*$/.test(lines[i]))code.push(lines[i++]);if(i<lines.length)i++;blocks.push({type:'code',text:code.join('\n'),language:/^[a-z0-9_-]{1,24}$/i.test(language)?language:''});continue;}
    const h=/^(#{1,3})\s+(.+)$/.exec(lines[i]);
    if(h){blocks.push({type:'heading',level:h[1].length===3?3:2,id:`section-${++heading}`,text:h[2]});i++;continue;}
    if(/^- /.test(lines[i])){const items=[];while(i<lines.length&&/^- /.test(lines[i]))items.push(lines[i++].slice(2));blocks.push({type:'list',items});continue;}
    const paragraph=[];while(i<lines.length&&lines[i].trim()&&!/^(?:#{1,3}\s|```|- )/.test(lines[i]))paragraph.push(lines[i++]);if(!paragraph.length)paragraph.push(lines[i++]);blocks.push({type:'paragraph',text:paragraph.join('\n')});
  }
  return blocks;
}
export const articleHeadings=text=>parseArticle(text).filter(b=>b.type==='heading').map(({id,text,level})=>({id,text,level}));
const inlineHtml=text=>parseInline(text).map(p=>p.type==='text'?escapeHtml(p.text):p.type==='link'?`<a href="${escapeHtml(p.href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(p.text)}</a>`:`<${p.type}>${escapeHtml(p.text)}</${p.type}>`).join('');
export function renderArticleHtml(text){return parseArticle(text).map(b=>b.type==='heading'?`<h${b.level} id="${b.id}">${inlineHtml(b.text)}</h${b.level}>`:b.type==='list'?`<ul>${b.items.map(item=>`<li>${inlineHtml(item)}</li>`).join('')}</ul>`:b.type==='code'?`<pre><code>${escapeHtml(b.text)}</code></pre>`:`<p>${inlineHtml(b.text)}</p>`).join('\n');}
