# MAKELOG 無料運用・公開手順

**GitHub Freeの公開リポジトリ + GitHub Pagesの標準ドメイン**で公開しました。作品一覧・制作記録・技術構成・3つの操作デモは静的ファイルだけで動き、サーバー、データベース、AI APIの契約は不要です。

公開サイト：[MAKELOG](https://devikuomidorikawa.github.io/makelog/)。公開元：[devikuomidorikawa/makelog](https://github.com/devikuomidorikawa/makelog)、公開ブランチは `main`。GitHub Actionsからの初回公開を確認済みです。Pages CMSは対象リポジトリだけへのGitHub Appインストール、本人ログイン、`makelog/main` の表示、実保存後の自動公開まで確認しました（2026-10-15）。文章変更の公開ページへの反映と、追加した下書き記事の非掲載も確認済みです。

## 運用費とホスティングの選択

| 項目 | 構成と無料の条件 |
| --- | --- |
| ホスティング | GitHub Pages。GitHub Freeでは公開リポジトリが対象 |
| 自動更新 | GitHub Actionsの標準Linuxランナー。公開リポジトリでは無料。付属ワークフローは非公開リポジトリでは起動しません |
| URL | `https://所有者.github.io/リポジトリ名/`。独自ドメイン不要。独自ドメインの取得・更新費用は別途 |
| コメント | 任意のgiscus。無料。GitHub Discussionsに保存。投稿者はGitHubにログイン |
| デモ | ブラウザー内のサンプル処理。外部AI APIの呼び出し・課金なし |

**Cloudflare Pagesが向く場合**：ソースを非公開にしたまま無料公開したい場合。無料プランは月500ビルド、静的アセットのリクエストは無料・無制限です。同じ配布ファイルを使えます。Node 24 / pnpm 11.25.0、自動ビルドは `pnpm install --frozen-lockfile --ignore-scripts && pnpm build:pages && pnpm check:pages`、出力先 `dist/client`。Functionsは不要です。今回の機能はGitHub Pagesで満たせるため、まずGitHubにまとめる構成を推奨します。

料金条件は2026-10-14の公式資料で確認しました。将来の料金変更を保証するものではありません。付属コードに有料API・自動課金・有料プランへの切替処理はありません。

## GitHub Pagesへ公開

1. 公開先 `devikuomidorikawa/makelog` に公開用ソースを配置済みです。`package.json` と `.github` がルートにある構成です。私用の元資料や作業フォルダー全体はアップロードしません。
2. GitHubの `Settings → Pages → Build and deployment → Source` は **GitHub Actions** に設定済みです。
3. `main` に反映するとテスト・ビルド・公開が自動実行されます。Actionsの「Publish MAKELOG」から手動実行も可能です。主ブランチが異なる場合は `.github/workflows/pages.yml` の2か所の `main` を変更します。
4. Actions完了後、[公開サイト](https://devikuomidorikawa.github.io/makelog/)で更新を確認します。初回公開は成功しました。更新ごとに公開workflowの成功と実際のページへの反映を確認します。

個人アクセストークンやAPIキーは不要です。GitHub標準の短期トークンを利用します。公開先の権限・ブランチ保護は、選定したリポジトリで確認します。

## 日々の更新

- GUI編集：公開サイト下部の「サイトを編集」から[Pages CMSのmakelog/main](https://app.pagescms.org/devikuomidorikawa/makelog/main)を開き、記事・サイトの文章・作品・配色を編集します。この端末の開発版は既存の編集スタジオを開きます。端末の元ファイルへの保存は `pnpm studio`。公開版の `#editor` はブラウザー内の下書きだけを保存します。詳しくは `EDITOR-GUIDE.md`。
- 文章・記事・技術説明：`src/content/site.json` へ分離。GUI保存先と公開ビルドの入力は同一です。下書きは公開画面・配布JavaScriptから除外しますが、公開GitHubリポジトリの元ファイルは閲覧可能です。
- 作品画像：`public/assets/` の対象画像を置換。公開する画像は `vite.config.mjs` の許可リスト5枚だけです。検討中のデザイン画像は公開ビルドから除外します。
- GitHubリンク：`src/site.config.json` の `repositories` に、各作品の公開 `owner/repository` を記入。README・Releases・Issuesへ移動できます。空欄は公開準備中の表示です。
- 共有URL：作品を開いたときのURLをコピーできます。例 `#project/atlas/process`。再読み込み・戻る・進むに対応します。

## 永続コメントの有効化（任意）

1. 公開GitHubリポジトリでDiscussionsを有効にします。
2. giscus GitHub Appに対象リポジトリだけのアクセスを与えます。これは所有者が承認する外部アプリ接続です。
3. [giscus設定画面](https://giscus.app/ja)でリポジトリとカテゴリ（Announcements形式を推奨）を選びます。
4. 生成された公開IDを `src/site.config.json` の `giscus` に記入します。項目は `repo`、`repoId`、`category`、`categoryId`。`enabled` を `true` にして再公開します。秘密鍵やトークンは記入しません。
5. 実環境で表示・ログイン・投稿・返信・モデレーションを確認します。実際の公開投稿は所有者の承認後に行います。

作品単位の固定キー `makelog-project-atlas` / `form` / `flow` で会話を分けるため、URLや日本語・英語切替でコメントが分裂しません。現在は未設定のため、入力が再読み込みで消える体験版が動きます。giscusの実接続・投稿は未検証です。

## ローカル起動・公開ファイルの生成

Node.js 24、pnpm 11.25.0を使用します。

```sh
pnpm install --frozen-lockfile --ignore-scripts
pnpm dev --host 127.0.0.1
pnpm test
pnpm build:pages
pnpm check:pages
pnpm preview --host 127.0.0.1 --port 4173
```

公開対象は `dist/client` の中身です。相対パスにより、ルートURLとプロジェクトのサブディレクトリの両方に対応します。サーバー側ルーティングやSPA用404リダイレクトは不要です。ZIPを直接開くのでなく、HTTPサーバーで表示してください。

`pnpm test` はビルド前の入力境界・GUI保存テストです。Sites互換ビルド `pnpm build` と `pnpm test:sites` は保持。Sites用4件はビルド後に実行します。GitHub PagesはSitesサーバーを使いません。CMS設定とローカル保存用スクリプトはソース配布だけに含み、公開物には書込APIがありません。

## 機能の範囲と拡張

ATLASは架空の大学検索・比較、FORMはサンプル書類名プレビュー・CSV保存、FLOWは架空の予約入力・確認です。実際のPDF解析、ファイル変更、予約受付、通知、AI推論は行いません。写真・名称・本文も公開用の架空サンプルです。

giscusで公開の対話を始められます。独自プロフィール、フォロー、フィード、非公開メッセージなどのSNS機能は、別途認証・保存先・無料枠の設計が必要です。現時点で有料バックエンドは組み込んでいません。

安全設計は `SECURITY.md` を参照。監査の追加費用上限は0円。ローカル監査を用い、AIレビューは通常のCodex利用枠を消費します。Codex Security Cloudのスキャンは実施しません。

## 公式資料

- [GitHub Pagesの利用条件](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages)
- [GitHub Actionsの料金](https://docs.github.com/en/billing/concepts/product-billing/github-actions)
- [GitHub Pagesのワークフロー](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)
- [Cloudflare Pagesの制限](https://developers.cloudflare.com/pages/platform/limits/)
- [Cloudflare Pagesの料金](https://developers.cloudflare.com/pages/functions/pricing/)
- [Cloudflare PagesのGit連携](https://developers.cloudflare.com/pages/configuration/git-integration/)
- [giscus](https://giscus.app/ja)
