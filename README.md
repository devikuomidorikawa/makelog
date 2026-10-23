# MAKELOG

AIとコードでつくったものと、その制作過程を共有する独立ブランド型ポートフォリオ。日本語主体・英語対応。MAKELOGは仮称です。

- 公開サイト: https://devikuomidorikawa.github.io/makelog/
- オンライン編集: https://app.pagescms.org/devikuomidorikawa/makelog/main
- 記事: `src/content/articles/*.json`／作品: `src/content/projects/*.json`（1件1ファイル）
- サイト設定: `src/content/site.json`／タグ: `src/content/tags/*.json`／画像: `public/assets/media/`
- 手動編集: [操作ガイド](EDITOR-GUIDE.md)
- ChatGPT Work・AIへの依頼: [AI編集ガイド](AI-EDITING.md)
- 自作アプリの掲載スキル: [MAKELOGへアプリを掲載](.agents/skills/makelog-publish-app/SKILL.md)

記事、画像、ブランド名、サイトの文章、作品の紹介、技術構成、処理の流れ、ホームの注目作品、5色の配色をフォームから更新できます。英語の空欄は日本語を表示します。自由なレイアウト変更はソースの編集で行います。

## 手動とAIで同じ内容を編集

公開サイトの「運営者向け編集」でスマホから記事を検索し、対象のPages CMS編集画面へ進めます。下書きはGitHubの公開原稿一覧を明示的に読み込んで探します。CMSの「作品一覧」も1件ずつ編集できます。「サイト設定」と「タグ管理」も独立しています。端末GUI・AIも同じ正本を更新します。Pages CMSの保存はGitHubのコミットとして記録され、mainの更新で検査・ビルド・GitHub Pages公開が実行されます。保存と公開完了は別です。運営者向け編集の公開状況を確認し、完了後に公開ページを開いてください。

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

端末GUIは `http://127.0.0.1:4173/#editor`。元ファイルへの保存は端末で起動した開発時だけです。公開サイトの `#editor` はCMSへの記事検索・管理の入口です。ブラウザー内の下書き・読者プレビュー・端末保存はローカル開発版で使います。

```sh
pnpm check:content
pnpm test
pnpm build:pages
pnpm check:pages
```

PRでは公開権限なしの検査を行います。mainへの更新はGitHub Pagesへ公開します。GitHubのSettings → Pages → SourceはGitHub Actionsです。

## 構成

ホームは「01 FEATURED CASE」で管理画面から選んだ公開作品を紹介します。作品一覧 `/works/`、制作ノート `/notes/`、ブランド紹介 `/about/` は通常のページです。各作品と記事も直接URLで開ける静的HTMLを生成します。作品は「概要・デモ・制作記録」の3タブ。パンくずからホーム・作品・記事一覧へ移動できます。制作ノートはタイトル・概要・本文の検索、作品別・タグ別の絞り込み、12件単位のページ分割に対応し、条件をURLに保持し、記事から検索結果へ戻ると条件と一覧位置を復元します。本文で見つかった結果には一致部分を短く表示します。

ホーム下部には「LATEST WORKS」を行形式で3件表示します。各作品の掲載更新日 `updatedAt` の新しい順に自動で選び、同日の場合も順序が安定します。最新の制作ノート3件も紹介します。新しい自作アプリは `src/content/projects/<作品ID>.json` に追加でき、下書きは公開画面・配布データから除きます。外部デモのURLがなければ紹介から掲載でき、サンプルのデモへ自動で接続することはありません。

記事は公開日・更新日・翻訳状態を管理し、雛形から追加できます。CMSは文章を先に入力できる順番です。仮タイトル・空本文の下書きを保存でき、公開前には日本語タイトルと本文を確認します。日本語だけを更新した際、CMSでは英訳状態を「要更新」にし、英訳を合わせて「対応済み」に戻します。本文は安全な見出し・太字・箇条書き・HTTPSリンク・コードブロックに対応。画像は最大8枚、代替文と説明付きで追加でき、タップで拡大します。長文には目次、末尾には関連記事を表示します。共有画像は記事や作品の画像を優先し、なければ共通ブランド画像を使います。

公開用JavaScriptには記事一覧の小さい索引だけを含め、本文は記事ごとのJSONから読み込みます。全文検索用索引は検索時に読み込み、下書きは両方から除外します。保存形式は1件1ファイルですが、端末GUIの持ち運びJSONは全体をまとめた互換形式です。記事は最大1000件、本文各言語20,000文字、1記事ファイル256KiB、編集データ集計20MB以内。上限は性能保証ではなく、安全な入力の境界です。

Pages CMSの独立した「タグ管理」で、タグ名の一括変更と名前から選ぶ統合ができます。記事・作品のタグも名前から選べます。管理IDは自動生成して固定し、入力しません。端末GUI・AIも同じタグファイルを編集します。詳しい手順は `EDITOR-GUIDE.md` を参照してください。

最低限の案内として `/privacy/`、`/guide/`、`/contact/` を用意し、本文はCMSから編集できます。現在の連絡先は公開GitHub Issueのフォームです。個人用メールや制作受付を架空に追加していません。ページ別のタイトル・説明・共有メタ情報、ファビコン、サイトマップと404案内を生成します。

デモの検索・選択・命名ルール・入力内容は、ページを開いている間はタブ移動や記事との往復でも残ります。リセットで初期状態に戻ります。再読み込み後のデモ状態は保存しません。記事から開いたデモは「記事に戻る」で読んでいた位置へ戻れます。共有URLの `?from=記事ID` は公開記事への戻り先だけを示し、入力内容や認証情報は含みません。

体験版コメントは非表示です。設定・コードは保持し、永続コメントを実際に運用するときに明示的に有効化します。旧技術・GitHub・コメントURLは対応する概要・記録へ移動します。

作品の概要・制作記録と記事末尾の「リンクをコピー」で共有できます。例 `/makelog/works/atlas/`、`/makelog/notes/atlas-build-note/`。以前の `#project/atlas/overview`、`#article/atlas-build-note` も読み込めます。記事末尾から関連作品のデモへ進めます。記録は同じJSONから読み込み、掲載サンプルは後から差し替えられます。

| 対象 | ファイル |
| --- | --- |
| 記事（固定ID・公開日・更新日・翻訳状態） | `src/content/articles/*.json` |
| 作品紹介 | `src/content/projects/*.json` |
| サイト共通の文章・配色・案内ページ・注目作品 | `src/content/site.json` |
| 公開用の追加画像 | `public/assets/media/` |
| タグ名・統合先 | `src/content/tags/*.json` |
| CMSフォーム | `.pages.yml` |
| 共通の内容検証 | `src/content-model.mjs` |
| GUI・読者プレビュー | `src/Editor.jsx` / `src/Content.jsx` |
| サイト・操作デモ | `src/App.jsx` |
| 表示スタイル | `src/styles.css` / `src/editor.css` |
| 作品GitHubリンク・コメント | `src/site.config.json`（公開識別子のみ） |
| 自動公開 | `.github/workflows/pages.yml` |
| AI/PRの検査 | `.github/workflows/validate-content.yml` |

第三者ライセンスは `THIRD-PARTY-NOTICES.txt`、安全設計は `SECURITY.md` を参照。実際の公開状態はActionsと公開URLで確認します。
