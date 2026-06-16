# GitHub Stats

Beautiful GitHub language usage cards for profile READMEs.

Show what you actually build with, including private repositories when the user opts in with GitHub OAuth.

```md
[![GitHub Language Stats](https://your-app.vercel.app/api/languages.svg?username=YOUR_GITHUB_USERNAME)](https://your-app.vercel.app)
```

## Why

Most GitHub stats cards only show public activity. This project focuses on one thing: a clean language distribution card that can also include private repositories without exposing repository names or source code.

Users can choose:

- Public repositories only
- Public + private repositories through GitHub OAuth
- A copy-ready Markdown snippet for their profile README

## Features

- SVG card endpoint that works in GitHub profile READMEs
- Public repository language stats for any GitHub username
- GitHub OAuth login for private repository language stats
- Copy-ready Markdown generator in the web UI
- Custom themes, hidden languages, borders, language count, and boundary position
- Animated language labels inside the SVG card
- Encrypted `card_token` support for private README cards
- JSON API for custom clients
- Built with Next.js App Router, React, Recharts, and Octokit

## Quick Start

Clone and install:

```bash
git clone https://github.com/YOUR_NAME/github-stats.git
cd github-stats
npm install
```

Create `.env.local`:

```env
GITHUB_USERNAME=YOUR_GITHUB_USERNAME
GITHUB_TOKEN=
AUTH_SECRET=YOUR_RANDOM_SECRET
AUTH_GITHUB_ID=YOUR_GITHUB_OAUTH_CLIENT_ID
AUTH_GITHUB_SECRET=YOUR_GITHUB_OAUTH_CLIENT_SECRET
NEXTAUTH_URL=http://localhost:3000
DATABASE_URL=
```

Generate `AUTH_SECRET`:

```bash
openssl rand -base64 32
```

Run locally:

```bash
npm run dev
```

Open http://localhost:3000.

## GitHub OAuth Setup

Create a GitHub OAuth App:

```text
GitHub Settings -> Developer settings -> OAuth Apps -> New OAuth App
```

For local development:

```text
Application name:
GitHub Stats

Homepage URL:
http://localhost:3000

Authorization callback URL:
http://localhost:3000/api/auth/callback/github
```

For production:

```text
Homepage URL:
https://your-app.vercel.app

Authorization callback URL:
https://your-app.vercel.app/api/auth/callback/github
```

Copy the OAuth App values into `.env.local` or your hosting provider:

```env
AUTH_GITHUB_ID=Client ID
AUTH_GITHUB_SECRET=Client Secret
```

## Profile README Usage

Public repositories:

```md
[![GitHub Language Stats](https://your-app.vercel.app/api/languages.svg?username=YOUR_GITHUB_USERNAME)](https://your-app.vercel.app)
```

Customized card:

```md
[![GitHub Language Stats](https://your-app.vercel.app/api/languages.svg?username=YOUR_GITHUB_USERNAME&count=10&hide=HTML,CSS&theme=github-dark)](https://your-app.vercel.app)
```

Private repositories:

1. Open your deployed app.
2. Sign in with GitHub.
3. Enable `Include private repositories`.
4. Copy the generated Markdown.
5. Paste it into your GitHub profile README.

The private card URL includes an encrypted `card_token`:

```md
[![GitHub Language Stats](https://your-app.vercel.app/api/languages.svg?username=YOUR_GITHUB_USERNAME&include_private=true&card_token=...)](https://your-app.vercel.app)
```

You do not need to log in every time the card is displayed. Login is only needed when generating the private card URL.

## API

SVG card:

```text
GET /api/languages.svg?username=YOUR_GITHUB_USERNAME
GET /api/languages.svg?username=YOUR_GITHUB_USERNAME&include_private=true&card_token=...
```

JSON:

```text
GET /api/languages?username=YOUR_GITHUB_USERNAME
GET /api/languages?username=YOUR_GITHUB_USERNAME&include_private=true&card_token=...
```

`include_private` accepts `1`, `true`, `yes`, or `on`.

## Customization

All options can be set in the web UI or directly in the card URL.

| Parameter | Values | Description |
| --- | --- | --- |
| `count` | `5`, `8`, `10`, `all` | Number of languages to show. |
| `hide` | Comma-separated language names | Hide languages such as `HTML,CSS,Jupyter Notebook`. |
| `theme` | `github-dark`, `github-light`, `dark`, `light`, `transparent` | Card color theme. |
| `boundary` | `top`, `right`, `bottom`, `left` | Where the first language boundary appears on the donut. |
| `transparent` | `true`, `false` | Force a transparent background. |
| `github_colors` | `true`, `false` | Use GitHub language colors. Enabled by default. |
| `border` | `true`, `false` | Show or hide the card border. |
| `animated` | `true`, `false` | Cycle the active language label, highlight, percentage, and KB text. Enabled by default. |
| `interval` | `1` to `10` | Seconds each language stays visible when `animated=true`. Defaults to `2`. |

Examples:

```text
/api/languages.svg?username=YOUR_GITHUB_USERNAME&count=5
/api/languages.svg?username=YOUR_GITHUB_USERNAME&hide=HTML,CSS&theme=github-light
/api/languages.svg?username=YOUR_GITHUB_USERNAME&boundary=right
/api/languages.svg?username=YOUR_GITHUB_USERNAME&transparent=true&border=false
/api/languages.svg?username=YOUR_GITHUB_USERNAME&animated=true&interval=2
```

## Environment Variables

| Name | Required | Description |
| --- | --- | --- |
| `GITHUB_USERNAME` | Optional | Default GitHub username when `username` is not passed in the URL. |
| `GITHUB_TOKEN` | Optional | Server-level GitHub token. Usually leave this empty when using OAuth. |
| `AUTH_SECRET` | Yes for OAuth/private cards | Secret used by NextAuth and encrypted private card tokens. |
| `AUTH_GITHUB_ID` | Yes for OAuth | GitHub OAuth App client ID. |
| `AUTH_GITHUB_SECRET` | Yes for OAuth | GitHub OAuth App client secret. |
| `NEXTAUTH_URL` | Yes in production | Canonical app URL, such as `https://your-app.vercel.app`. |
| `DATABASE_URL` | Not currently used | Reserved for future database-backed sessions or token storage. |

## Security Notes

Private repository cards expose aggregated language percentages, not repository names or source code.

Anyone who can see a private `card_token` URL can request the same aggregated card. Treat that URL as shareable-but-sensitive. If you need to invalidate old private card URLs, revoke the GitHub OAuth authorization or rotate `AUTH_SECRET`.

## Deploy

Deploy to Vercel or any Next.js-compatible host.

After deployment:

1. Set the environment variables in your hosting provider.
2. Update your GitHub OAuth App callback URL.
3. Open the app and copy your README Markdown.

## Star This Project

If this helps make your GitHub profile a little more honest about what you build, a star would mean a lot.
