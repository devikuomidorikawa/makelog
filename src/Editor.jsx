import React,{useEffect,useRef,useState} from 'react';
import {ArrowLeft,ArrowUpRight,CaretDown,CheckCircle,CloudArrowUp,DownloadSimple,Eye,FileText,FloppyDisk,GithubLogo,NotePencil,Palette,Plus,Stack,TextB,TextH,UploadSimple,WarningCircle} from '@phosphor-icons/react';
import {useContent,ArticleBody} from './Content.jsx';
import {articleCopy,localized,validateContent,MAX_CONTENT_BYTES,PAIR_FIELDS,PROJECT_IDS} from './content-model.mjs';

const legacyDraftKey=`makelog-editor-draft-v1:${window.location.pathname}`;
const draftKey=`makelog-editor-draft-v2:${import.meta.env.DEV?'local':'browser'}:${window.location.pathname}`;
const viewTabs=['articles','site','projects','appearance','publish'];
const MAX_DRAFT_BYTES=MAX_CONTENT_BYTES+4096;
const clone=value=>structuredClone(value);
function readDraft(fallback){
  try {let raw=localStorage.getItem(draftKey);if(!raw){const legacy=localStorage.getItem(legacyDraftKey);if(legacy&&legacy.length<=MAX_DRAFT_BYTES&&new TextEncoder().encode(legacy).length<=MAX_DRAFT_BYTES){const old=JSON.parse(legacy);const native=typeof old.revision==='string'&&/^[a-f0-9]{64}$/.test(old.revision);if(native===import.meta.env.DEV)raw=legacy;}}
    if(raw&&raw.length<=MAX_DRAFT_BYTES&&new TextEncoder().encode(raw).length<=MAX_DRAFT_BYTES){const data=JSON.parse(raw),content=validateContent(data.content);const revision=typeof data.revision==='string'&&/^[a-f0-9]{64}$/.test(data.revision)?data.revision:'';const view={tab:viewTabs.includes(data.view?.tab)?data.view.tab:'articles',language:data.view?.language==='en'?'en':'ja',selected:content.articles.some(a=>a.id===data.view?.selected)?data.view.selected:content.articles[0]?.id||''};return {content,revision,view,restored:true};}}catch{}
  return {content:clone(fallback),revision:'',view:{},restored:false};
}
function Field({label,value,onChange,multiline=false,limit=3000,...props}){
  const Component=multiline?'textarea':'input';
  return <label className="editor-field"><span>{label}</span><Component value={value} onChange={e=>onChange(e.target.value)} maxLength={limit} {...props}/></label>;
}

export function Editor(props){
  if(window.self!==window.top) return <main className="editor-shell editor-frame-warning"><WarningCircle size={32}/><h1>編集画面を新しいタブで開いてください</h1><p>安全に編集するため、別のページに埋め込まれた画面では保存できません。</p><a className="primary" href={`${window.location.origin}${window.location.pathname}${window.location.search}#editor`} target="_blank" rel="noopener noreferrer">編集画面を開く<ArrowUpRight size={18}/></a></main>;
  return <EditorWorkspace {...props}/>;
}
function EditorWorkspace({onClose,onPreview}){
  const {saved,apply,commit}=useContent();
  const [initial]=useState(()=>readDraft(saved));
  const [data,setData]=useState(initial.content),[baseRevision,setBaseRevision]=useState(initial.revision),[session,setSession]=useState(null),[tab,setTab]=useState(initial.view.tab||'articles'),[selected,setSelected]=useState(initial.view.selected||initial.content.articles[0]?.id||''),[language,setLanguage]=useState(initial.view.language||'ja'),[query,setQuery]=useState(''),[message,setMessage]=useState(initial.restored?'このブラウザーの下書きを復元しました。':''),[error,setError]=useState(''),[saving,setSaving]=useState(false),[savedAt,setSavedAt]=useState('');
  const [loading,setLoading]=useState(import.meta.env.DEV);
  const busy=saving||loading;
  const bodyRef=useRef(null),inputRef=useRef(null),hydrated=useRef(false);
  useEffect(()=>{
    let active=true;
    if(import.meta.env.DEV) fetch(`${import.meta.env.BASE_URL}__makelog/editor`,{cache:'no-store'}).then(r=>{if(!r.ok)throw Error();return r.json();}).then(result=>{
      if(!active)return;setSession(result);if(!initial.restored)setBaseRevision(result.revision);else if(!initial.revision)setError('この下書きの保存元を確認できません。編集データを保管し、元ファイルの最新版を読み込んでください。');
      if(!initial.restored)setData(result.content);hydrated.current=true;setLoading(false);
    }).catch(()=>{if(active){setMessage('このブラウザーに下書きを保存できます。');hydrated.current=true;setLoading(false);}});
    else hydrated.current=true;
    return()=>{active=false;};
  },[]);
  useEffect(()=>{
    const timer=setTimeout(()=>{
      if(!hydrated.current)return;
      try {localStorage.setItem(draftKey,JSON.stringify({content:data,revision:baseRevision,view:{tab,selected,language}}));setSavedAt(new Date().toLocaleTimeString('ja-JP',{hour:'2-digit',minute:'2-digit'}));}
      catch{setError('ブラウザーに下書きを保存できません。編集データをダウンロードして保管してください。');}
    },400);return()=>clearTimeout(timer);
  },[data,baseRevision,session,tab,selected,language]);
  const article=data.articles.find(a=>a.id===selected);
  const isDirty=JSON.stringify(data)!==JSON.stringify(session?.content||saved);
  const updateArticle=(key,value)=>{setError('');setData(v=>({...v,articles:v.articles.map(a=>a.id===selected?{...a,[key]:value}:a)}));};
  const updateSite=(key,value)=>{setError('');setData(v=>({...v,site:{...v.site,[key]:value}}));};
  const updatePair=(key,value)=>updateSite(key,data.site[key].map((v,n)=>n===(language==='en'?1:0)?value:v));
  const addArticle=()=>{
    if(data.articles.length>=200){setError('記事は200件以内にしてください。');return;}
    const id=`note-${crypto.randomUUID().slice(0,12)}`,date=new Date().toISOString().slice(0,10);
    const next={id,date,project:'',status:'draft',titleJa:'無題の制作ノート',titleEn:'',summaryJa:'',summaryEn:'',bodyJa:'',bodyEn:''};
    setData(v=>({...v,articles:[next,...v.articles]}));setSelected(id);setTab('articles');setQuery('');setMessage('新しい下書きを追加しました。');
  };
  const persistDraft=()=>{try{localStorage.setItem(draftKey,JSON.stringify({content:data,revision:baseRevision,view:{tab,selected,language}}));return true;}catch{setError('下書きを保存できません。編集データをダウンロードして保管してください。');return false;}};
  const exit=()=>{if(!busy&&persistDraft())onClose();};
  const preview=()=>{if(busy)return;try{apply(data);if(!persistDraft())return;setError('');onPreview();}catch(e){setError(e.message);}};
  const save=async()=>{
    if(busy)return;setError('');setMessage('');let content;
    if(import.meta.env.DEV&&session&&!baseRevision){setError('保存元が不明な下書きです。編集データをダウンロードして保管し、元ファイルの最新版を読み込んでください。');return;}
    try{content=validateContent(data);}catch(e){setError(e.message);return;}
    setSaving(true);
    try{
      if(import.meta.env.DEV&&session){
        const response=await fetch(`${import.meta.env.BASE_URL}__makelog/editor`,{method:'POST',headers:{'Content-Type':'application/json','X-Makelog-Token':session.token},body:JSON.stringify({revision:baseRevision,content})});
        const result=await response.json();if(!response.ok)throw Error(result.error||'保存できませんでした。');
        setBaseRevision(result.revision);setSession(v=>({...v,...result}));setData(result.content);commit(result.content);
        try{localStorage.setItem(draftKey,JSON.stringify({content:result.content,revision:result.revision,view:{tab,selected,language}}));}catch{}
        setMessage('この端末のサイトファイルに保存しました。インターネット上への公開は行っていません。');
      }else{
        localStorage.setItem(draftKey,JSON.stringify({content,revision:baseRevision,view:{tab,selected,language}}));setMessage('このブラウザーに下書きを保存しました。公開サイトの更新にはPages CMSを使用してください。');
      }
    }catch(e){setError(e.message||'保存できませんでした。');}finally{setSaving(false);}
  };
  const loadLatest=async()=>{
    if(busy||!import.meta.env.DEV||!session)return;setError('');setSaving(true);
    try{const response=await fetch(`${import.meta.env.BASE_URL}__makelog/editor`,{cache:'no-store'});if(!response.ok)throw Error('最新版を取得できませんでした。');const result=await response.json();setSession(result);setBaseRevision(result.revision);setData(result.content);setSelected(result.content.articles[0]?.id||'');commit(result.content);setMessage('この端末の最新版を読み込みました。');}catch(e){setError(e.message);}finally{setSaving(false);}
  };
  const download=()=>{
    try{const content=validateContent(data),url=URL.createObjectURL(new Blob([JSON.stringify(content,null,2)+'\n'],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='site.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);setMessage('編集データをダウンロードしました。');setError('');}catch(e){setError(e.message);}
  };
  const importFile=async file=>{
    if(!file||busy)return;setSaving(true);
    try{if(file.size>MAX_CONTENT_BYTES)throw Error('編集データは1MB以内にしてください。');const next=validateContent(JSON.parse(await file.text()));setData(next);setSelected(next.articles[0]?.id||'');setMessage('編集データを読み込みました。内容を確認してから保存してください。');setError('');}catch(e){setError(e instanceof SyntaxError?'JSON形式の編集データを選んでください。':e.message);}finally{if(inputRef.current)inputRef.current.value='';setSaving(false);}
  };
  const insert=mark=>{const field=bodyRef.current;if(!field||!article)return;const key=language==='en'?'bodyEn':'bodyJa';const start=field.selectionStart,end=field.selectionEnd;const next=article[key].slice(0,start)+mark+(article[key].slice(start,end)||'テキスト')+(mark==='**'?'**':'')+article[key].slice(end);if(next.length<=20000){updateArticle(key,next);field.focus();}};
  const tabs=[['articles',FileText,'記事'],['site',NotePencil,'サイトの文章'],['projects',Stack,'作品'],['appearance',Palette,'配色'],['publish',CloudArrowUp,'保存・公開']];
  const suffix=language==='en'?'En':'Ja';
  return <div className="editor-shell">
    <header className="editor-header"><a href="#" onClick={e=>{e.preventDefault();exit();}} className="wordmark">{data.site.brand}<span>EDITORIAL STUDIO</span></a><div className="editor-header-note"><span className="eyebrow">編集スタジオ</span><small>{session?(isDirty?'この端末に未保存の変更':'この端末で編集中'):'このブラウザーの下書き'}</small></div><div className="editor-header-actions"><button className="text-link" onClick={preview} disabled={busy}><Eye size={18}/>サイトで確認</button><button className="primary" onClick={save} disabled={busy}><FloppyDisk size={18}/>{loading?'読み込み中…':saving?'保存中…':session?'この端末に保存':'下書きを保存'}</button></div></header>
    <div className="editor-frame"><aside className="editor-sidebar" inert={busy?true:undefined}><p className="eyebrow">WORKSPACE</p><nav aria-label="編集メニュー">{tabs.map(([id,Icon,label])=><button key={id} aria-current={tab===id?'page':undefined} className={tab===id?'active':''} onClick={()=>setTab(id)}><Icon size={20}/>{label}{id==='articles'&&<span>{data.articles.length}</span>}</button>)}</nav><div className="editor-sidebar-bottom"><span><CheckCircle size={16}/>{savedAt?`${savedAt} 下書き保存`:'下書きは自動保存'}</span><button onClick={exit}><ArrowLeft size={17}/>サイトに戻る</button></div></aside>
    <main className="editor-main" inert={busy?true:undefined} aria-busy={busy}><div className="editor-heading"><div><p className="eyebrow">{String(tabs.findIndex(v=>v[0]===tab)+1).padStart(2,'0')} / EDIT & REFINE</p><h1>{tabs.find(v=>v[0]===tab)[2]}</h1><p>{tab==='articles'?'つくる過程を、読みものに。':tab==='appearance'?'落ち着いた背景と、読める文字の組み合わせを。':tab==='publish'?'編集したものを、確かめてひらく。':'言葉と見せ方を、あなたらしく。'}</p></div>{tab==='articles'&&<button className="primary" onClick={addArticle}><Plus size={18}/>記事を追加</button>}</div>
    {(message||error)&&<div className={`editor-message ${error?'error':''}`} role={error?'alert':'status'}>{error?<WarningCircle size={19}/>:<CheckCircle size={19}/>}<span>{error||message}</span></div>}
    {tab==='articles'?<div className="article-workspace"><section className="editor-article-list" aria-label="記事一覧"><input aria-label="記事を検索" placeholder="記事を検索" value={query} onChange={e=>setQuery(e.target.value)}/>{data.articles.filter(a=>(a.titleJa+a.titleEn).toLowerCase().includes(query.toLowerCase())).map(a=><button key={a.id} aria-pressed={selected===a.id} onClick={()=>setSelected(a.id)}><small>{a.date}<span>{a.status==='draft'?'下書き':'表示予定'}</span></small><strong>{a.titleJa||a.titleEn||'無題の記事'}</strong><span>{a.project?data.site.projects[a.project].name:'制作ノート'}</span></button>)}{!data.articles.length&&<p>最初の記事を追加しましょう。</p>}</section>
    {article?<section className="editor-writing"><div className="editor-language" aria-label="編集する言語"><button aria-pressed={language==='ja'} onClick={()=>setLanguage('ja')}>日本語</button><button aria-pressed={language==='en'} onClick={()=>setLanguage('en')}>English</button></div><div className="editor-fields-row"><Field label="日付" type="date" value={article.date} onChange={v=>updateArticle('date',v)}/><label className="editor-field"><span>表示状態</span><select value={article.status} onChange={e=>updateArticle('status',e.target.value)}><option value="draft">下書き</option><option value="published">サイトに表示</option></select></label><label className="editor-field"><span>関連する作品</span><select value={article.project} onChange={e=>updateArticle('project',e.target.value)}><option value="">制作ノート</option>{PROJECT_IDS.map(id=><option key={id} value={id}>{data.site.projects[id].name}</option>)}</select></label></div><Field label={`記事タイトル（${language==='en'?'英語':'日本語'}）`} value={article[`title${suffix}`]} limit={200} onChange={v=>updateArticle(`title${suffix}`,v)}/><Field label={`概要（${language==='en'?'英語':'日本語'}）`} value={article[`summary${suffix}`]} limit={1000} multiline rows={3} onChange={v=>updateArticle(`summary${suffix}`,v)}/><label className="editor-field" htmlFor="article-body-input"><span>本文（{language==='en'?'英語':'日本語'}）</span><div className="writing-toolbar"><button onClick={()=>insert('## ')} aria-label="見出しを挿入"><TextH size={19}/></button><button onClick={()=>insert('**')} aria-label="太字を挿入"><TextB size={19}/></button><button onClick={()=>insert('- ')} aria-label="箇条書きを挿入">箇条書き</button><small>見出し・太字・箇条書きに対応</small></div><textarea id="article-body-input" aria-label={`本文（${language==='en'?'英語':'日本語'}）`} ref={bodyRef} rows={14} value={article[`body${suffix}`]} maxLength={20000} onChange={e=>updateArticle(`body${suffix}`,e.target.value)}/></label><p className="editor-help">英語が空欄の場合は、日本語を表示します。下書きは公開画面に表示されません。公開リポジトリ内のデータは閲覧可能です。</p></section>:<div className="editor-empty"><FileText size={35}/><h2>書きたいことを、ひとつ。</h2><button className="primary" onClick={addArticle}>記事を追加</button></div>}
    {article&&<aside className="editor-preview"><span className="eyebrow">READING PREVIEW</span><p className="editor-preview-meta">{article.date} / {article.project?data.site.projects[article.project].name:'BUILD NOTE'}</p><h2>{articleCopy(article,'title',language)}</h2><p className="editor-preview-summary">{articleCopy(article,'summary',language)}</p><ArticleBody text={articleCopy(article,'body',language)||'本文を入力すると、ここに表示されます。'}/></aside>}</div>:
    tab==='site'?<section className="editor-settings"><div className="editor-language"><button aria-pressed={language==='ja'} onClick={()=>setLanguage('ja')}>日本語</button><button aria-pressed={language==='en'} onClick={()=>setLanguage('en')}>English</button></div><div className="editor-fields-row"><Field label="ブランド名" value={data.site.brand} limit={60} onChange={v=>updateSite('brand',v)}/><Field label="ブランドの肩書き" value={data.site.tagline} limit={100} onChange={v=>updateSite('tagline',v)}/></div>{PAIR_FIELDS.map((key,n)=><Field key={key} label={['トップページの見出し','トップページの説明','スタジオのメッセージ','短いメッセージ','フッターの文章','ブランドについて'][n]+`（${language==='en'?'英語':'日本語'}）`} value={data.site[key][language==='en'?1:0]} onChange={v=>updatePair(key,v)} multiline rows={key==='studioBody'?4:2} limit={key==='heroTitle'?200:3000}/>)}<button className="text-link" onClick={preview}><Eye size={18}/>サイト全体で確認する</button></section>:
    tab==='projects'?<section className="editor-settings"><div className="editor-language"><button aria-pressed={language==='ja'} onClick={()=>setLanguage('ja')}>日本語</button><button aria-pressed={language==='en'} onClick={()=>setLanguage('en')}>English</button></div>{PROJECT_IDS.map(id=>{const p=data.site.projects[id];const change=(key,value)=>updateSite('projects',{...data.site.projects,[id]:{...p,[key]:value}});return <details className="editor-project" key={id} open={id==='atlas'}><summary><Stack size={20}/>{p.name}<CaretDown size={20} className="editor-disclosure"/></summary><Field label="作品名" value={p.name} limit={60} onChange={v=>change('name',v)}/>{['category','title','short','description'].map((key,n)=><Field key={key} label={['カテゴリ','見出し','短い紹介','作品の説明'][n]+`（${language==='en'?'英語':'日本語'}）`} value={p[key][language==='en'?1:0]} multiline={key==='description'||key==='title'} rows={key==='description'?4:2} limit={key==='description'?3000:key==='category'?160:200} onChange={v=>change(key,p[key].map((value,index)=>index===(language==='en'?1:0)?v:value))}/>)}<Field label="技術構成（1行に1項目・空行なし）" value={p.tech.join('\n')} multiline rows={3} onChange={v=>change('tech',v.split('\n'))}/><Field label="処理の流れ（1行に1項目・空行なし）" value={p.flow.join('\n')} multiline rows={3} onChange={v=>change('flow',v.split('\n'))}/></details>;})}</section>:
    tab==='appearance'?<section className="editor-settings"><div className="editor-color-grid">{Object.keys(data.site.colors).map((key,n)=><label key={key} className="editor-color"><span>{['ページの背景','入力欄の背景','作品パネルの背景','文字の色','ポイントの色'][n]}</span><input type="color" aria-label={['ページの背景','入力欄の背景','作品パネルの背景','文字の色','ポイントの色'][n]} value={data.site.colors[key]} onChange={e=>updateSite('colors',{...data.site.colors,[key]:e.target.value})}/><code>{data.site.colors[key]}</code></label>)}</div><div className="color-preview" style={{background:data.site.colors.canvas,color:data.site.colors.ink}}><p className="eyebrow">COLOR & CONTRAST</p><h2 style={{whiteSpace:'pre-line'}}>{localized(data.site.heroTitle,language)}</h2><p>{localized(data.site.heroDescription,language)}</p><button onClick={preview} style={{background:data.site.colors.accent,color:'#fff'}}>サイトで確認<ArrowUpRight size={18}/></button></div><p className="editor-help">読みやすさが不足する色の組み合わせは、保存前にお知らせします。</p></section>:
    <section className="editor-publish"><div className="editor-publish-card"><FloppyDisk size={30}/><h2>{session?'この端末で保存する':'下書きを保管する'}</h2><p>{session?'保存すると、この端末のサイトファイルが更新されます。再読み込み後も内容が残ります。':'下書きはこのブラウザーだけに保存されます。公開サイトの内容は変わりません。'}</p><button className="primary" disabled={busy} onClick={save}>{session?'この端末に保存':'下書きを保存'}</button>{session&&<><button className="text-link" onClick={loadLatest}>元ファイルの最新版を読み込む</button><small>読み込むと現在の編集内容が置き換わります。未保存の変更は、先に編集データをダウンロードしてください。</small></>}</div><div className="editor-publish-card"><GithubLogo size={30}/><h2>GitHub Pagesへ反映する</h2><p>Pages CMSでmakelog / mainを開き、記事やサイトの文章・作品・配色を編集します。保存後に公開サイトの更新が始まります。</p><p>この画面の編集内容は自動転送されません。初回は編集データをダウンロードし、GitHubへ反映してください。</p><a className="primary external-link" href="https://app.pagescms.org/devikuomidorikawa/makelog/main" target="_blank" rel="noopener noreferrer">Pages CMSを開く<ArrowUpRight size={18}/></a><small>Pages CMSでの保存と、公開サイトへの反映を確認済みです。</small></div><div className="editor-publish-card"><DownloadSimple size={30}/><h2>編集データの持ち運び</h2><p>バックアップや別の端末での編集に使えます。取り込んだ内容は、確認後に保存してください。</p><div className="editor-transfer"><button className="text-link" onClick={download}><DownloadSimple size={18}/>編集データをダウンロード</button><button className="text-link" onClick={()=>inputRef.current.click()}><UploadSimple size={18}/>編集データを読み込む</button></div><input ref={inputRef} type="file" accept=".json,application/json" hidden onChange={e=>importFile(e.target.files?.[0])}/></div></section>}
    </main></div>
  </div>;
}
