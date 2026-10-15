import {validateContent,validateTags,validateTagIds,validateTagCatalog,resolveContentTags,resolveTagName,resolveTagId} from './content-model.mjs';

export function collectTags(items) {
  return [...new Set(items.flatMap(item=>item.tags||[]))].sort((a,b)=>a.localeCompare(b,'ja'));
}

export function tagMatches(item,selected='') {
  return !selected||(item.tags||[]).includes(selected);
}

export function renameContentTag(content,from,to) {
  const [oldName]=validateTags([from]),[newName]=validateTags([to]);
  const next=validateContent(content);
  const items=[...Object.values(next.site.projects),...(next.site.additionalProjects||[]),...next.articles];
  const catalog=next.tagCatalog||[];
  const refs=[...new Set(items.flatMap(item=>item.tags))];
  const sources=refs.filter(tag=>resolveTagName(tag,catalog)===oldName);
  const registered=catalog.find(entry=>!entry.mergeInto&&entry.name===oldName);
  if(registered&&!sources.includes(registered.id))sources.push(registered.id);
  if(!sources.length)throw Error('変更するタグが見つかりません。');
  if(oldName===newName)return next;
  let target=catalog.find(entry=>!entry.mergeInto&&entry.name===newName)?.id||refs.find(tag=>resolveTagName(tag,catalog)===newName);
  const roots=[...new Set(sources.map(tag=>resolveTagId(tag,catalog)))];
  for(const id of roots)if(!catalog.some(entry=>entry.id===id))catalog.push({id,name:oldName});
  if(target){
    target=resolveTagId(target,catalog);
    if(!catalog.some(entry=>entry.id===target))catalog.push({id:target,name:newName});
    for(const id of roots)catalog.find(entry=>entry.id===id).mergeInto=target;
  }else{
    target=roots[0];catalog.find(entry=>entry.id===target).name=newName;
    for(const id of roots.slice(1))catalog.find(entry=>entry.id===id).mergeInto=target;
  }
  next.tagCatalog=catalog;
  return validateContent(next);
}

export function collectTagOptions(content) {
  const catalog=content.tagCatalog||[],items=[...Object.values(content.site.projects),...(content.site.additionalProjects||[]),...content.articles];
  const refs=[...catalog.filter(entry=>!entry.mergeInto).map(entry=>entry.id),...items.flatMap(item=>item.tags||[])];
  const options=new Map();
  for(const ref of refs){const id=resolveTagId(ref,catalog),name=resolveTagName(ref,catalog);if(!options.has(name))options.set(name,{id,name});}
  return [...options.values()].sort((a,b)=>a.name.localeCompare(b.name,'ja'));
}

export function addTagAssignment(content,tags,name) {
  const [label]=validateTags([name]),catalog=validateTagCatalog(content.tagCatalog||[]),next={...content,...(content.tagCatalog?{tagCatalog:catalog}:{})};
  const match=collectTagOptions(next).find(option=>option.name===label);
  let id=match?.id;
  if(!match){
    id=globalThis.crypto.randomUUID();catalog.push({id,name:label});next.tagCatalog=catalog;
  }
  if(tags.some(tag=>resolveTagName(tag,catalog)===label))throw Error('同じタグを重複して追加しないでください。');
  if(next.tagCatalog)next.tagCatalog=validateTagCatalog(next.tagCatalog);
  return {tags:validateTagIds([...tags,id]),tagCatalog:next.tagCatalog};
}

export {resolveContentTags,resolveTagName,resolveTagId};
