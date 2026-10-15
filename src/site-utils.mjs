const projectIds = ['atlas', 'form', 'flow'];
const validProject=id=>typeof id==='string'&&/^[a-z0-9][a-z0-9-]{0,63}$/.test(id)&&!['constructor','prototype'].includes(id);
const tabs = new Set(['overview', 'demo', 'process', 'tech', 'github', 'comments']);

// Keep the parent section visible in navigation while viewing its detail pages.
export function navigationCurrent(route, section) {
  if (route?.type === section) return 'page';
  if ((section === 'works' && route?.type === 'project') ||
      (section === 'journal' && route?.type === 'article')) return 'location';
  return undefined;
}

export function repositoryUrl(value) {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,38})\/[a-zA-Z0-9][a-zA-Z0-9._-]{0,99}$/.test(value)) return null;
  return `https://github.com/${value}`;
}

export function validGiscus(config) {
  return config?.enabled === true && !!repositoryUrl(config.repo) &&
    /^[A-Za-z0-9_=-]{1,100}$/.test(config.repoId || '') &&
    /^[A-Za-z0-9_=-]{1,100}$/.test(config.categoryId || '') &&
    typeof config.category === 'string' && config.category.trim().length > 0 && config.category.length <= 100;
}

export function readRoute(hash, allowedProjects=projectIds) {
  if (hash === '#editor') return {type:'editor'};
  const article = /^#article\/([a-z0-9][a-z0-9-]{0,63})$/.exec(hash);
  if (article) return {type:'article',id:article[1]};
  if (['#about','#journal','#works','#privacy','#guide','#contact'].includes(hash)) return { type: hash.slice(1) };
  const match = /^#project\/([a-z0-9][a-z0-9-]{0,63})\/([a-z]+)(?:\?from=([a-z0-9][a-z0-9-]{0,63}))?$/.exec(hash);
  return match && allowedProjects.includes(match[1]) && tabs.has(match[2])
    ? { type: 'project', project: match[1], tab: match[2], ...(match[3]?{from:match[3]}:{}) } : null;
}

export function routeHash(route) {
  if (!route) return '';
  if (route.type === 'editor') return '#editor';
  if (route.type === 'article') return /^[a-z0-9][a-z0-9-]{0,63}$/.test(route.id||'') ? `#article/${route.id}` : '';
  if (['about','journal','works','privacy','guide','contact'].includes(route.type)) return `#${route.type}`;
  return validProject(route.project) && tabs.has(route.tab) ? `#project/${route.project}/${route.tab}${typeof route.from==='string'&&/^[a-z0-9][a-z0-9-]{0,63}$/.test(route.from)?`?from=${route.from}`:''}` : '';
}

// Real static URLs. Old hash links remain readable for previously shared pages.
export function routePath(route,base='/') {
  if(!route)return base;
  if(route.type==='editor')return `${base}#editor`;
  if(['works','about','privacy','guide','contact'].includes(route.type))return `${base}${route.type}/`;
  if(route.type==='journal')return `${base}notes/`;
  if(route.type==='article'&&/^[a-z0-9][a-z0-9-]{0,63}$/.test(route.id||''))return `${base}notes/${route.id}/`;
  if(route.type==='project'&&validProject(route.project)&&tabs.has(route.tab))return `${base}works/${route.project}/${route.tab==='overview'?'':`${route.tab}/`}${typeof route.from==='string'&&/^[a-z0-9][a-z0-9-]{0,63}$/.test(route.from)?`?from=${route.from}`:''}`;
  return base;
}
export function readPage(pathname,search='',hash='',base='/',allowedProjects=projectIds) {
  if(hash&&hash!=='#'&&hash!=='#main') {
    const legacy=readRoute(hash,allowedProjects);
    if(legacy)return legacy;
  }
  if(!pathname.startsWith(base))return {type:'missing'};
  const path=pathname.slice(base.length).replace(/\/$/,'');
  if(!path||path==='index.html')return null;
  if(['works','about','privacy','guide','contact'].includes(path))return {type:path};
  if(path==='notes')return {type:'journal'};
  const article=/^notes\/([a-z0-9][a-z0-9-]{0,63})$/.exec(path);
  if(article)return {type:'article',id:article[1]};
  const project=/^works\/([a-z0-9][a-z0-9-]{0,63})(?:\/([a-z]+))?$/.exec(path);
  if(project&&allowedProjects.includes(project[1])&&tabs.has(project[2]||'overview')) {
    const from=/^\?from=([a-z0-9][a-z0-9-]{0,63})$/.exec(search);
    if(search&&!from)return {type:'missing'};
    return {type:'project',project:project[1],tab:project[2]||'overview',...(from?{from:from[1]}:{})};
  }
  return {type:'missing'};
}

// A saved CSV must keep a user-supplied filename as text in spreadsheet software.
export function csvCell(value) {
  const text = String(value);
  const safe = /^[\s\uFEFF]*[=+@-]/.test(text) || /^[\t\r\n]/.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
}
