# GitHub Stats

GitHub profile READMEに貼れる、言語使用率カードを生成するNext.jsアプリです。

## Features

- Public repositoriesの言語使用率をSVGカードで表示
- GitHub OAuth loginでprivate repositoriesも集計
- Web UIでusername、private集計、貼り付け用Markdownを生成
- GitHub READMEで表示しやすい`image/svg+xml`エンドポイント

## Profile README

デプロイ後、プロフィールREADMEに以下を貼り付けます。

```md
[![GitHub Language Stats](https://your-domain.example/api/languages.svg?username=YOUR_GITHUB_USERNAME)](https://your-domain.example)
```

Private repositoriesも含めたい場合は、トップページでGitHubログインし、`Include private repositories`をオンにして生成されたMarkdownを貼り付けます。private用URLには暗号化された`card_token`が付きます。

```md
[![GitHub Language Stats](https://your-domain.example/api/languages.svg?username=YOUR_GITHUB_USERNAME&include_private=true&card_token=...)](https://your-domain.example)
```

## Environment Variables

```bash
GITHUB_USERNAME=YOUR_GITHUB_USERNAME
GITHUB_TOKEN=github_pat_or_classic_token
AUTH_SECRET=random_32_bytes_or_longer_secret
AUTH_GITHUB_ID=github_oauth_app_client_id
AUTH_GITHUB_SECRET=github_oauth_app_client_secret
NEXTAUTH_URL=https://your-domain.example
```

`GITHUB_USERNAME`は、URLに`username`を指定しない場合のデフォルトです。

`GITHUB_TOKEN`は任意です。共通のサーバーtokenで集計したい場合だけ設定します。通常、private repositoriesはOAuthログインしたユーザーのtokenで集計します。

`AUTH_SECRET`はOAuth sessionとprivate card URLの暗号化に使います。以下のような値を設定してください。

```bash
openssl rand -base64 32
```

`AUTH_GITHUB_ID`と`AUTH_GITHUB_SECRET`はGitHub OAuth Appで発行します。OAuth AppのCallback URLは以下です。

```text
https://your-domain.example/api/auth/callback/github
```

ローカル開発では以下を使います。

```text
http://localhost:3000/api/auth/callback/github
```

## API

### SVG card

```text
GET /api/languages.svg?username=YOUR_GITHUB_USERNAME
GET /api/languages.svg?username=YOUR_GITHUB_USERNAME&include_private=true&card_token=...
```

### JSON

```text
GET /api/languages?username=YOUR_GITHUB_USERNAME
GET /api/languages?username=YOUR_GITHUB_USERNAME&include_private=true&card_token=...
```

`include_private`は`1`、`true`、`yes`、`on`で有効になります。

## Development

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Deploy

VercelなどのNext.js対応ホスティングにデプロイできます。private repositoriesを含めるカードを公開する場合、SVG URLを知っている人は集計結果を見られるため、公開してよい範囲か確認してから`include_private=true`を使ってください。GitHub profile READMEに貼る以上、private repoの中身そのものは出ませんが、言語使用率の集計結果は公開されます。
