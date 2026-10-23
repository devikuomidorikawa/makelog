import React,{createContext,useContext,useEffect,useState} from 'react';
import initial from 'virtual:makelog-content';
import {validateContent,validateMediaPath} from './content-model.mjs';
import {resolveContentTags} from './tag-utils.mjs';
import {parseArticle,parseInline} from './article-render.mjs';
export {articleHeadings} from './article-render.mjs';

const ContentContext=createContext(null);
export const useContent=()=>useContext(ContentContext);
export function ContentProvider({children}){
  const [content,setContent]=useState(initial),[saved,setSaved]=useState(initial),[preview,setPreview]=useState(false);
  useEffect(()=>{
    const colors=content.site.colors,element=document.documentElement;
    for(const [key,value]of Object.entries(colors))element.style.setProperty(`--${key}`,value);
    element.style.setProperty('--button',`linear-gradient(110deg,${colors.ink},${colors.accent})`);
    element.style.setProperty('--muted',colors.ink);
    return()=>{for(const key of [...Object.keys(colors),'button','muted'])element.style.removeProperty(`--${key}`);};
  },[content.site.colors]);
  const apply=value=>{setContent(validateContent(value));setPreview(true);};
  const commit=value=>{const next=validateContent(value);setContent(next);setSaved(next);setPreview(false);};
  const reset=()=>{setContent(saved);setPreview(false);};
  const readable=import.meta.env.DEV||preview?resolveContentTags(content):content;
  return <ContentContext.Provider value={{content:readable,source:content,saved,preview,apply,commit,reset}}>{children}</ContentContext.Provider>;
}

function baseUrl(){return import.meta.env.DEV?new URL('/',window.location.href):new URL(document.querySelector('meta[name=makelog-home]')?.getAttribute('content')||'./',window.location.href);}
const articleCache=new Map();
export function useArticle(metadata){
  const [state,setState]=useState({id:null,article:null,loading:false,error:false});
  const id=metadata?.id,complete=typeof metadata?.bodyJa==='string';
  useEffect(()=>{
    if(!id||complete)return;
    if(!/^[a-z0-9][a-z0-9-]{0,63}$/.test(id)){setState({id,article:null,loading:false,error:true});return;}
    const cached=articleCache.get(id);if(cached){setState({id,article:cached,loading:false,error:false});return;}
    const controller=new AbortController();let active=true;setState({id,article:null,loading:true,error:false});
    (async()=>{try{
      const response=await fetch(new URL(`assets/articles/${id}.json`,baseUrl()),{signal:controller.signal,credentials:'omit'});
      if(!response.ok)throw Error('article unavailable');
      if(Number(response.headers.get('content-length'))>262144)throw Error('article too large');
      const raw=await response.text();if(new TextEncoder().encode(raw).length>262144)throw Error('article too large');
      const data=JSON.parse(raw);
      if(data.id!==id||data.status!=='published'||typeof data.bodyJa!=='string'||data.bodyJa.length>20000||typeof data.bodyEn!=='string'||data.bodyEn.length>20000)throw Error('article invalid');
      const body={bodyJa:data.bodyJa,bodyEn:data.bodyEn};
      if(active){articleCache.set(id,body);if(articleCache.size>12)articleCache.delete(articleCache.keys().next().value);setState({id,article:body,loading:false,error:false});}
    }catch(error){if(active&&error.name!=='AbortError')setState({id,article:null,loading:false,error:true});}})();
    return()=>{active=false;controller.abort();};
  },[id,complete]);
  if(!metadata)return {article:null,loading:false,error:false};
  if(complete)return {article:metadata,loading:false,error:false};
  const current=state.id===id?state:null;
  return {article:{...metadata,...current?.article},loading:!current||current.loading,error:!!current?.error};
}
function Inline({text}){return parseInline(text).map((part,n)=>part.type==='text'?<React.Fragment key={n}>{part.text}</React.Fragment>:part.type==='link'?<a key={n} href={part.href} target="_blank" rel="noopener noreferrer">{part.text}</a>:React.createElement(part.type,{key:n},part.text));}
export function ArticleImages({images=[],lang='ja'}){return images.length>0?<div className="article-images">{images.map((image,n)=>{let source;try{source=validateMediaPath(image.src);}catch{return null;}const alt=image[lang==='en'?'altEn':'altJa']||image.altJa,caption=image[lang==='en'?'captionEn':'captionJa']||image.captionJa;return <figure key={n}><img src={new URL(`assets/${source}`,baseUrl()).href} alt={alt} loading="lazy" decoding="async"/>{caption&&<figcaption>{caption}</figcaption>}</figure>;})}</div>:null;}
export function ArticleBody({text='',headingIcons=[],images=[],lang='ja'}){
  const blocks=parseArticle(text);
  let headingIndex=0;
  return <div className="article-body">{blocks.map((block,n)=>{
    if(block.type==='heading'){const Heading=`h${block.level}`,Icon=headingIcons.length?headingIcons[headingIndex++%headingIcons.length]:null;return <Heading key={n} id={block.id} className={Icon?'article-icon-heading':undefined}>{Icon&&<Icon size={23} weight="light" aria-hidden="true"/>}<span><Inline text={block.text}/></span></Heading>;}
    if(block.type==='list')return <ul key={n}>{block.items.map((line,k)=><li key={k}><Inline text={line}/></li>)}</ul>;
    if(block.type==='code')return <pre key={n}><code>{block.text}</code></pre>;
    return <p key={n}><Inline text={block.text}/></p>;
  })}<ArticleImages images={images} lang={lang}/></div>;
}

