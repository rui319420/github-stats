# プロジェクトの知見

## 2026-09-20 — 非公開カードと公開キャッシュの境界

### Context
GitHub のプロフィール画像は閲覧者のログイン状態や Cookie を利用できないため、非公開を含むカードにも共有 URL が必要。

### Finding
サーバーの `GITHUB_TOKEN` を匿名の `include_private=true` に利用すると、運営者の非公開リポジトリの集計を第三者が取得できる。セッション由来の結果を共有キャッシュに保存することにも同様のリスクがある。

### Decision
非公開の集計は本人のセッションまたは暗号化カードトークンで許可し、ユーザー名を認証された本人に束縛する。公開検索はセッションの GitHub 資格情報を使わない。非公開レスポンスとエラーは `private, no-store` とし、生の GitHub アクセストークンをブラウザー用セッションに含めない。

### Reason
カード URL は集計閲覧用の権限であり、GitHub API を直接操作できる権限と分離する必要がある。共有された集計値自体は公開情報となるため、UIとREADMEで説明する。

### Related files
- `auth.ts`
- `app/lib/cardToken.ts`
- `app/lib/languageStatsRequest.ts`
- `app/api/languages/route.ts`
- `app/api/languages.svg/route.ts`

## 2026-09-20 — 表示数と割合の分母

### Context
上位の言語だけを選択してから割合を再計算すると、小さな言語を除外した分だけ主要言語の割合が過大になる。

### Decision
明示的な非表示言語を除外した全言語を分母とし、表示数を超えた言語は「その他」に集約する。固定の言語除外を行わない。

### Reason
README上の「使用言語の割合」が実際の対象コード量と対応するようにする。

### Related files
- `app/lib/githubLanguages.ts`
- `app/lib/renderLanguageCard.ts`

## 2026-09-20 — README向けSVGは画像として完結させる

### Finding
GitHub READMEの画像ではSVG内のJavaScriptや外部資源に依存できない。円周の外側に割合を置くと、角度によってラベルが画像の外へはみ出す。

### Decision
スクリプトを含めず、CSSのみで中央の言語表示を切り替える。全言語の割合を凡例に常時表示し、動きを減らす設定ではアニメーションを止める。言語数が増えた場合はカードの高さを増やす。

### Related files
- `app/lib/renderLanguageCard.ts`


## 2026-09-21 — 公開集計の再利用と任意トークン失効

### Finding
実通信で32リポジトリ・12言語の公開集計に約3秒かかった。JSONプレビューとSVGで同じ集計を繰り返すと、リポジトリごとのAPI呼び出しも二重になる。また、既存環境の任意GITHUB_TOKENはGitHubから401を返した。

### Decision
公開集計だけをプロセス内で5分・最大100ユーザーまで再利用し、同時リクエストも共有する。失敗は保持しない。非公開のデータ・資格情報はキャッシュしない。公開集計で任意トークンが401になった場合だけ、匿名取得を一度試す。

### Reason
公開カードを任意設定の失効で停止させず、API呼び出しを抑える。実測で初回約1.4秒に対し、設定変更時JSONは約0.03秒、SVGは約0.03秒になった。

### Related files
- `app/lib/githubLanguages.ts`
- `app/lib/publicLanguageCache.ts`
- `app/lib/languageStatsRequest.ts`

## 2026-09-21 — 本番依存のセキュリティ更新

### Finding
着手時の依存監査で本番依存に17件（critical 3件）の指摘があった。Next.js 16.2.2とAuth.js 5.0.0-beta.31の修正版が利用可能であり、PrismaとSupabaseはソースから使われていなかった。

### Decision
Next.js／eslint-config-nextを16.3.5、next-authを5.0.0-beta.32へ更新。未使用のDB依存を削除し、互換範囲内の推移依存を更新した。更新直後のnpm auditは0件。

### Related files
- `package.json`
- `package-lock.json`
- [Next.js advisory](https://github.com/advisories/GHSA-p293-qw3h-jr36)
- [Auth.js advisory](https://github.com/advisories/GHSA-x445-f3h2-j279)

## 2026-09-21 — 画像としてのSVGと対話型プレビュー

### Context
円弧をホバーして言語表示を固定し、カーソルを外した言語から自動再生を再開する操作が必要になった。

### Finding
GitHub READMEの画像（HTML img）として参照するSVGは対話イベントやスクリプトを実行できない。SVGにスクリプトを追加しても要件を満たせない。

### Decision
アプリではReact管理のインラインSVG、書き出しではスクリプトなしのCSSアニメーションを使う。座標・色・表示言語の集計を純粋な共有モジュールに置き、ブラウザーにGitHub APIや秘密値に依存するサーバー処理を取り込まない。ホバー・フォーカスが残っている間は再生しない。動きを減らす設定では手動選択だけを提供する。

### Related files
- `app/components/InteractiveLanguageCard.tsx`
- `app/lib/languageCardLayout.ts`
- `app/lib/languageStats.ts`
- `app/lib/renderLanguageCard.ts`
