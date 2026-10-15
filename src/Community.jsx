import React, { useEffect, useRef, useState } from 'react';
import { GithubLogo, ArrowUpRight } from '@phosphor-icons/react';
import config from './site.config.json';
import { repositoryUrl, validGiscus } from './site-utils.mjs';

export function Repository({ project, lang }) {
  const url = repositoryUrl(config.repositories[project]);
  const ja = lang === 'ja';
  return <div className="github-panel">
    <GithubLogo size={52} weight="light" aria-hidden="true" />
    <p className="eyebrow">SOURCE & DEVELOPMENT</p>
    <h3>{ja ? 'コードにも、つながる作品に。' : 'A window into the code, too.'}</h3>
    <p>{url ? config.repositories[project] : ja ? '公開リポジトリの準備中です。' : 'The public repository is being prepared.'}</p>
    {url ? <a className="primary external-link" href={url} target="_blank" rel="noopener noreferrer">{ja ? 'GitHubでコードを見る' : 'View code on GitHub'}<ArrowUpRight size={20} /></a> : <div className="connection-state"><span className="status-dot" />{ja ? '公開準備中' : 'Preparing for release'}</div>}
    <div className="github-details">{[
      ['', 'README', ja ? '作品概要・起動方法・デモの制約' : 'Overview, setup, and demo limitations'],
      ['/releases', 'RELEASES', ja ? 'バージョンと更新内容' : 'Versions and release notes'],
      ['/issues', 'ISSUES', ja ? '改善点や技術的な対話' : 'Ideas and technical discussion'],
    ].map(([path, title, description]) => <p key={title}><strong>{url ? <a href={url + path} target="_blank" rel="noopener noreferrer">{title}<ArrowUpRight size={15} aria-hidden="true" /></a> : title}</strong><span>{description}</span></p>)}</div>
    <p className="support-note">{ja ? '公開されたソース・更新記録へ直接つながります。非公開コードは掲載していません。' : 'Explore public source code and updates. Private code is not included.'}</p>
  </div>;
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
