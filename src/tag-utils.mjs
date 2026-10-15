import {validateContent,validateTags} from './content-model.mjs';

export function collectTags(items) {
  return [...new Set(items.flatMap(item=>item.tags||[]))].sort((a,b)=>a.localeCompare(b,'ja'));
}

export function tagMatches(item,selected='') {
  return !selected||(item.tags||[]).includes(selected);
}

export function renameContentTag(content,from,to) {
  const [oldName]=validateTags([from]),[newName]=validateTags([to]);
  const next=validateContent(content);
  const rename=item=>({...item,tags:[...new Set(item.tags.map(tag=>tag===oldName?newName:tag))]});
  next.articles=next.articles.map(rename);
  next.site.projects=Object.fromEntries(Object.entries(next.site.projects).map(([id,item])=>[id,rename(item)]));
  return validateContent(next);
}
