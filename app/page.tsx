import Link from "next/link";
import GitHubConnection from "./components/GitHubConnection";
import { isGitHubConfigured } from "./lib/githubOAuth";
import LanguagePieChart from "./components/LanguagePieChart";
import { auth, signIn, signOut } from "@/auth";

export default async function Home({ searchParams }: { searchParams: Promise<{ connection?: string }> }) {
  const oauthConfigured = isGitHubConfigured();
  const { connection } = await searchParams;
  const session = oauthConfigured ? await auth() : null;
  const username = session?.user?.login ?? "";

  return (
    <main className="site-shell">
      <a className="skip-link" href="#builder">カード作成へ移動</a>
      <header className="site-header">
        <Link className="brand" href="/" aria-label="GitHub Stats ホーム">
          <svg width="34" height="34" viewBox="0 0 64 64" aria-hidden="true">
            <g fill="none" strokeWidth="9" transform="rotate(-90 32 32)">
              <circle cx="32" cy="32" r="21" stroke="#3178c6" strokeDasharray="59 140" />
              <circle cx="32" cy="32" r="21" stroke="#3fb950" strokeDasharray="38 140" strokeDashoffset="-63" />
              <circle cx="32" cy="32" r="21" stroke="#f1e05a" strokeDasharray="23 140" strokeDashoffset="-105" />
            </g>
          </svg>
          <span>GitHub <strong>Stats</strong><small>YOUR CODE, YOUR STORY.</small></span>
        </Link>
        <nav className="header-links" aria-label="メインナビゲーション">
          <a href="https://github.com/rui319420/github-stats" className="repository-link">GitHub で見る <span aria-hidden="true">↗</span></a>
          {session ? <><span className="signed-user mono">@{username}</span><form action={async () => { "use server"; await signOut(); }}><button className="button secondary small" type="submit">ログアウト</button></form></> :
            <a href="#connection" className="button secondary small">GitHub と連携</a>}
        </nav>
      </header>

      <GitHubConnection session={session} configured={oauthConfigured} notice={connection} />

      <div id="builder">
        <h1 className="sr-only">GitHub 使用言語カードの作成</h1>
        <LanguagePieChart initialUsername={username} isSignedIn={Boolean(session)}
          oauthConfigured={oauthConfigured} privateCardToken={session?.privateCardToken}
          privateCardError={session?.privateCardError} />
      </div>

      <section id="privacy" className="privacy-section" aria-labelledby="privacy-title">
        <div className="privacy-icon" aria-hidden="true"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="5" y="10" width="14" height="11" rx="3" /><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3" /></svg></div>
        <div>
          <h2 id="privacy-title">非公開の開発も、あなたの一部。</h2>
          <p>GitHub と連携すると、自分が所有する非公開リポジトリも任意で集計できます。カードの共有URLを知る人には、言語・コード量・割合・リポジトリ数が公開されます。リポジトリ名とソースコードは表示しません。</p>
          <details className="permission-details"><summary>連携前に、権限と公開範囲を確認</summary>
            <p>OAuth の repo 権限には非公開リポジトリへの書き込み権限も含まれます。本アプリは読み取り API だけを使用します。カード用URLには暗号化した集計用トークンが含まれ、ログアウト後も有効です。失効させるには GitHub の連携アプリ設定で認可を取り消してください。</p>
          </details>
          {!session && (oauthConfigured ? <form action={async () => { "use server"; await signIn("github", { redirectTo: "/#builder" }); }}><button className="button secondary connect-button" type="submit">権限を確認して GitHub と連携 ↗</button></form> : <p className="small-muted">この環境では GitHub 連携が未設定です。公開カードはそのまま利用できます。</p>)}
        </div>
      </section>
      <footer className="site-footer"><span>GitHub Stats <span className="footer-dot">·</span> コードで、自分を伝えよう。</span><a href="https://github.com/rui319420/github-stats#readme">使い方・ソースコード ↗</a></footer>
    </main>
  );
}
