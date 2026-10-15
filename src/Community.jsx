import React, { useEffect, useRef, useState } from 'react';
import { GithubLogo, ArrowUpRight } from '@phosphor-icons/react';
import config from './site.config.json';
import { repositoryUrl, validGiscus } from './site-utils.mjs';

export const publicCommentsEnabled = validGiscus(config.giscus);

export function Repository({ project, lang }) {
  const url = repositoryUrl(config.repositories[project]);
  const ja = lang === 'ja';
  return url ? <div className="source-note"><GithubLogo size={20} aria-hidden="true"/><a className="text-link" href={url} target="_blank" rel="noopener noreferrer">{ja ? '作品のコードを見る' : 'View project source'}<ArrowUpRight size={18} aria-hidden="true"/></a></div> : <p className="source-note"><GithubLogo size={19} aria-hidden="true"/>{ja ? 'サンプル作品です。作品単体の公開コードはありません。' : 'Sample project. No separate public repository.'}</p>;

}

export function Community({ project, lang, children }) {
  return validGiscus(config.giscus) ? <Giscus key={`${project}:${lang}`} project={project} lang={lang} /> : children;
}

function Giscus({ project, lang }) {
  const container = useRef(null);
  const [failed, setFailed] = useState(false);
  const ja = lang === 'ja';
  useEffect(() => {
    const host = container.current;
    const script = document.createElement('script');
    const data = {
      repo: config.giscus.repo, 'repo-id': config.giscus.repoId,
      category: config.giscus.category, 'category-id': config.giscus.categoryId,
      mapping: 'specific', term: `makelog-project-${project}`, strict: '1',
      'reactions-enabled': '1', 'emit-metadata': '0', 'input-position': 'top',
      theme: 'light', lang: ja ? 'ja' : 'en', loading: 'lazy',
    };
    script.src = 'https://giscus.app/client.js';
    script.crossOrigin = 'anonymous';
    script.async = true;
    for (const [key, value] of Object.entries(data)) script.setAttribute(`data-${key}`, value);
    script.onerror = () => setFailed(true);
    host.appendChild(script);
    return () => { script.onerror = null; host.replaceChildren(); };
  }, [project, ja]);
  return <section className="community">
    <div className="demo-intro"><h3>{ja ? '作品から、会話をはじめる。' : 'Start a conversation around the work.'}</h3>
      <p>{ja ? 'コメントとリアクションはGitHub Discussionsに公開・保存されます。投稿にはGitHubへのログインが必要です。' : 'Comments and reactions are public and saved in GitHub Discussions. Sign in with GitHub to contribute.'}</p></div>
    <p className="support-note">{ja ? 'この欄はgiscus.appとGitHubに接続します。個人情報や非公開の内容は書き込まないでください。' : 'This section connects to giscus.app and GitHub. Keep personal or private information out of comments.'}</p>
    <div ref={container} className="giscus-host" />
    {failed && <p role="status">{ja ? 'コメントを読み込めませんでした。GitHubで確認できます。' : 'Comments could not load. You can open the discussion on GitHub.'}</p>}
    <a className="text-link external-link" href={`${repositoryUrl(config.giscus.repo)}/discussions`} target="_blank" rel="noopener noreferrer">{ja ? 'GitHubで会話をひらく' : 'Open discussions on GitHub'}<ArrowUpRight size={18} /></a>
  </section>;
}
