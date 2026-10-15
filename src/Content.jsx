import React,{createContext,useContext,useEffect,useState} from 'react';
import initial from 'virtual:makelog-content';
import {validateContent} from './content-model.mjs';
import {resolveContentTags} from './tag-utils.mjs';

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
  return <ContentContext.Provider value={{content:resolveContentTags(content),source:content,saved,preview,apply,commit,reset}}>{children}</ContentContext.Provider>;
}

// Plain Markdown subset. Everything remains React text; HTML and links never execute.
function Inline({text}){return text.split(/(\*\*[^*]+\*\*)/g).map((part,n)=>part.startsWith('**')&&part.endsWith('**')?<strong key={n}>{part.slice(2,-2)}</strong>:<React.Fragment key={n}>{part}</React.Fragment>);}
export function ArticleBody({text}){
  const blocks=text.replace(/\r\n?/g,'\n').replace(/^(#{1,3} .+)$/gm,'\n\n$1\n\n').split(/\n\s*\n/).map(v=>v.trim()).filter(Boolean);
  return <div className="article-body">{blocks.map((block,n)=>{
    if(/^#{1,3} /.test(block)){const content=block.replace(/^#{1,3} /,'');return block.startsWith('# ')?<h2 key={n}><Inline text={content}/></h2>:<h3 key={n}><Inline text={content}/></h3>;}
    if(block.split('\n').every(line=>line.startsWith('- ')))return <ul key={n}>{block.split('\n').map((line,k)=><li key={k}><Inline text={line.slice(2)}/></li>)}</ul>;
    return <p key={n}><Inline text={block}/></p>;
  })}</div>;
}
