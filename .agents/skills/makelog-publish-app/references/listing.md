# 新しいアプリの掲載データ

最新版の内容モデルとCMS設定を先に確認する。これは記入例であり、未確認のアプリにそのまま追加しない。

`src/content/projects/sample-reading-list.json` の1ファイル：

```json
{
  "id": "sample-reading-list",
  "name": "Reading List",
  "category": ["情報整理", "PERSONAL TOOLS"],
  "title": ["読みたい記事を、\n迷わず探せる。", "Find your next read."],
  "short": ["記事を分類して探す読書リスト", "A searchable reading list"],
  "description": ["記事を保存し、タグと検索で探せるアプリ。実際に確認できた保存先・動作条件をこの文章へ置き換えます。", "Save and find articles using tags and search. Replace this example with verified behavior and storage details."],
  "tech": ["確認済みの実装技術"],
  "flow": ["記事を登録する", "タグで整理する", "検索して開く"],
  "tags": [],
  "updatedAt": "2026-10-15",
  "status": "draft"
}
```

この例の技術・機能・日付は、依頼されたアプリの根拠と掲載日に合わせて置き換える。`draft` はサイト非掲載であり秘密を保管する機能ではない。公開指示があり内容を確認できたら `published` にする。IDは初回決定後に維持する。

`demoUrl` は任意の公開HTTPS URL、`repository` は任意の公開GitHub `owner/repo`。根拠がなければ省略する。デモがなくても概要と制作記録を掲載できる。既存のATLAS・FORM・FLOWは専用のサンプルデモであり、新アプリをそのどれかへ誤って接続しない。

タグの割り当てには表示名の文字列ではなく、タグファイルの固定UUIDを使う。共通項目は日英2項目の配列、`tech` と `flow` は短い文字列の配列。自由なJSONキー・任意HTMLを追加せず、素材やスクリーンショットは現在の公開アセット規則に従って取り込む。

制作ノートは `src/content/articles/<固定記事ID>.json` に1件ずつ保存する。`id` とファイル名を一致させ、公開日 `date`、更新日 `updatedAt`、公開状態 `status`、関連作品ID `project`、日英タイトル・概要・本文、固定タグID配列を指定する。`translationStatus` は `missing`（未作成）・`needs-update`（英訳要更新）・`current`（対応済み）。「課題 → 設計思想 → 使い方・確かめたこと」を中心に、機能説明を重ねすぎない。根拠のない設計判断を作らない。

記事の任意画像は `images: [{"src":"media/sample-reading-list/screen.webp","altJa":"記事の一覧画面","altEn":"Article list screen","captionJa":"公開用ダミーデータで撮影。","captionEn":"Captured with dummy data for publication."}]` の形式で最大8件。実ファイルは `public/assets/media/sample-reading-list/screen.webp` に配置する。記事本文は安全な見出し・太字・箇条書き・HTTPSリンク・コードブロックに対応し、画像はこの専用欄で管理する。HTMLは実行しない。

Pages CMSの「記事一覧」「作品一覧」は同じファイルを1件ずつ保存する。サイト共通設定だけが `src/content/site.json` に残る。`site.projects` / `additionalProjects` / `articles` はアプリ内部・持ち運びJSONで使う集計形式で、正本には書き戻さない。タグのUUID・名前変更・統合先は従来のタグファイルを維持する。公開済みIDとURLを変えず、対象ファイルだけ更新する。
