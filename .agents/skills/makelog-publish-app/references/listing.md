# 新しいアプリの掲載データ

最新版の内容モデルとCMS設定を先に確認する。これは記入例であり、未確認のアプリにそのまま追加しない。

`site.additionalProjects` の1項目：

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

制作ノートを追加するなら、`articles` に固定ID、掲載日、公開状態、関連作品のID、日英タイトル・概要・本文・タグを指定する。「課題 → 判断 → 試せる結果」を中心に、機能説明を重ねすぎない。実コードや操作確認の根拠がない設計判断を作らない。
