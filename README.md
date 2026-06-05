# GitHub Stats

GitHub profile READMEに貼れる、言語使用率カードを生成するNext.jsアプリです。

## Features

- Public repositoriesの言語使用率をSVGカードで表示
- `include_private=true`でprivate repositoriesも集計
- Web UIでusername、private集計、貼り付け用Markdownを生成
- GitHub READMEで表示しやすい`image/svg+xml`エンドポイント

## Profile README

デプロイ後、プロフィールREADMEに以下を貼り付けます。

```md
[![GitHub Language Stats](https://your-domain.example/api/languages.svg?username=YOUR_GITHUB_USERNAME)](https://your-domain.example)
```

Private repositoriesも含めたい場合は、デプロイ環境に`GITHUB_TOKEN`を設定し、URLに`include_private=true`を付けます。

```md
[![GitHub Language Stats](https://your-domain.example/api/languages.svg?username=YOUR_GITHUB_USERNAME&include_private=true)](https://your-domain.example)
```

## Environment Variables

```bash
GITHUB_USERNAME=YOUR_GITHUB_USERNAME
GITHUB_TOKEN=github_pat_or_classic_token
```

`GITHUB_USERNAME`は、URLに`username`を指定しない場合のデフォルトです。

`GITHUB_TOKEN`は任意ですが、private repositoriesを含める場合は必須です。Fine-grained personal access tokenを使う場合は、集計したいrepositoriesへのread accessを付けてください。Classic tokenを使う場合はprivate repositories読み取りに必要な権限を付けます。

## API

### SVG card

```text
GET /api/languages.svg?username=YOUR_GITHUB_USERNAME&include_private=false
```

### JSON

```text
GET /api/languages?username=YOUR_GITHUB_USERNAME&include_private=false
```

`include_private`は`1`、`true`、`yes`、`on`で有効になります。

## Development

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Deploy

VercelなどのNext.js対応ホスティングにデプロイできます。private repositoriesを含めるカードを公開する場合、SVG URLを知っている人は集計結果を見られるため、公開してよい範囲か確認してから`include_private=true`を使ってください。
