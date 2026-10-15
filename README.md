# MAKELOG

AIとコードでつくったものと、その制作過程を共有する独立ブランド型ポートフォリオ。日本語主体・英語対応。MAKELOGは仮称です。

- 公開サイト: https://devikuomidorikawa.github.io/makelog/
- オンライン編集: https://app.pagescms.org/devikuomidorikawa/makelog/main
- この記事・サイトの正本: `src/content/site.json`
- 手動編集: [操作ガイド](EDITOR-GUIDE.md)
- ChatGPT Work・AIへの依頼: [AI編集ガイド](AI-EDITING.md)

記事、ブランド名、サイトの文章、作品の紹介、技術構成、処理の流れ、5色の配色をフォームから更新できます。英語の空欄は日本語を表示します。写真の追加や自由なレイアウト変更はソースの編集で行います。

## 手動とAIで同じ内容を編集

Pages CMS・端末GUI・AIは、同じJSONを更新します。Pages CMSの保存はGitHubのコミットとして記録され、mainの更新で検査・ビルド・GitHub Pages公開が実行されます。保存と公開完了は別で、Actionsの成功後に公開サイトを確認してください。

ChatGPT Workには、このリポジトリURLと変更したい記事ID・項目を伝えます。AIは最新版を読み、指定した箇所だけを変更し、PRで差分を提示します。Work側の書込・実行はその接続権限に依存します。

## 無料の運用構成

公開リポジトリ、標準Linuxランナー、GitHub Pagesの標準URL、無料Pages CMSを使用します。独自ドメイン、AI API、データベースの契約は不要です。ChatGPT/Codexの編集依頼は利用中の契約の通常利用枠を消費します。

デモはブラウザー内の架空データで動きます。実際のAI推論、予約受付、PDF解析、業務データの保存は行いません。下書きは公開画面と配布JavaScriptから除外しますが、この公開リポジトリの元ファイルとGit履歴から閲覧可能です。秘密情報は入れないでください。

## ローカルで編集・検証

Node.js 24、pnpm 11.25.0を使用します。

```sh
pnpm install --frozen-lockfile --ignore-scripts
pnpm studio
```

端末GUIは `http://127.0.0.1:4173/#editor`。元ファイルへの保存は端末で起動した開発時だけです。公開サイトの端末GUIはブラウザー下書き用で、オンラインの正本はPages CMSで編集します。

```sh
pnpm check:content
pnpm test
pnpm build:pages
pnpm check:pages
```

PRでは公開権限なしの検査を行います。mainへの更新はGitHub Pagesへ公開します。GitHubのSettings → Pages → SourceはGitHub Actionsです。

## 構成

作品は「概要・デモ・制作記録」の3タブ。制作記録は技術の要点と記事リンク、記事画面は本文です。パンくずからホーム・作品・記事一覧へ移動できます。作品と記事にタグフィルターがあります。タグの編集方法は `EDITOR-GUIDE.md` を参照してください。

デモの検索・選択・命名ルール・入力内容は、ページを開いている間はタブ移動や記事との往復でも残ります。リセットで初期状態に戻ります。再読み込み後のデモ状態は保存しません。記事から開いたデモは「記事に戻る」で読んでいた位置へ戻れます。共有URLの `?from=記事ID` は公開記事への戻り先だけを示し、入力内容や認証情報は含みません。

体験版コメントは非表示です。設定・コードは保持し、永続コメントを実際に運用するときに明示的に有効化します。旧技術・GitHub・コメントURLは対応する概要・記録へ移動します。

作品の概要・制作記録と記事末尾の「リンクをコピー」で共有できます。例 `#project/atlas/overview`、`#article/atlas-build-note`。記事末尾から関連作品のデモへ進めます。記録は同じJSONから読み込み、掲載サンプルは後から差し替えられます。

| 対象 | ファイル |
| --- | --- |
| 記事・文章・配色・作品紹介 | `src/content/site.json` |
| CMSフォーム | `.pages.yml` |
| 共通の内容検証 | `src/content-model.mjs` |
| GUI・読者プレビュー | `src/Editor.jsx` / `src/Content.jsx` |
| サイト・操作デモ | `src/App.jsx` |
| 表示スタイル | `src/styles.css` / `src/editor.css` |
| 作品GitHubリンク・コメント | `src/site.config.json`（公開識別子のみ） |
| 自動公開 | `.github/workflows/pages.yml` |
| AI/PRの検査 | `.github/workflows/validate-content.yml` |

第三者ライセンスは `THIRD-PARTY-NOTICES.txt`、安全設計は `SECURITY.md` を参照。実際の公開状態はActionsと公開URLで確認します。
