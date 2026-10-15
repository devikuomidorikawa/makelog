const projects = new Set(['atlas', 'form', 'flow']);
const tabs = new Set(['overview', 'demo', 'process', 'tech', 'github', 'comments']);

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

export function readRoute(hash) {
  if (hash === '#editor') return {type:'editor'};
  const article = /^#article\/([a-z0-9][a-z0-9-]{0,63})$/.exec(hash);
  if (article) return {type:'article',id:article[1]};
  if (hash === '#about' || hash === '#journal') return { type: hash.slice(1) };
  const match = /^#project\/([a-z]+)\/([a-z]+)(?:\?from=([a-z0-9][a-z0-9-]{0,63}))?$/.exec(hash);
  return match && projects.has(match[1]) && tabs.has(match[2])
    ? { type: 'project', project: match[1], tab: match[2], ...(match[3]?{from:match[3]}:{}) } : null;
}

export function routeHash(route) {
  if (!route) return '';
  if (route.type === 'editor') return '#editor';
  if (route.type === 'article') return /^[a-z0-9][a-z0-9-]{0,63}$/.test(route.id||'') ? `#article/${route.id}` : '';
  if (route.type === 'about' || route.type === 'journal') return `#${route.type}`;
  return projects.has(route.project) && tabs.has(route.tab) ? `#project/${route.project}/${route.tab}${typeof route.from==='string'&&/^[a-z0-9][a-z0-9-]{0,63}$/.test(route.from)?`?from=${route.from}`:''}` : '';
}

// A saved CSV must keep a user-supplied filename as text in spreadsheet software.
export function csvCell(value) {
  const text = String(value);
  const safe = /^[\s\uFEFF]*[=+@-]/.test(text) || /^[\t\r\n]/.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
}
