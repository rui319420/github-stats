import type { Session } from "next-auth";
import { redirect } from "next/navigation";
import { auth, signIn, signOut } from "../../auth";
import { revokeGitHubConnection } from "../lib/githubConnection";
import GitHubConnectionStatus from "./GitHubConnectionStatus";

interface Props { session: Session | null; configured: boolean; notice?: string }
export default function GitHubConnection({ session, configured, notice }: Props) {
  async function connect() {
    "use server";
    await signIn("github", { redirectTo: "/#builder" });
  }
  async function disconnect(formData: FormData) {
    "use server";
    if (formData.get("confirm") !== "yes") redirect("/?connection=confirm-required#connection");
    try { await revokeGitHubConnection(await auth()); }
    catch { redirect("/?connection=disconnect-error#connection"); }
    await signOut({ redirectTo: "/?connection=disconnected#connection" });
  }
  return <section id="connection" className="panel connection-panel" aria-labelledby="connection-title">
    <div className="connection-main">
      <div><h2 id="connection-title">GitHub と連携</h2>
        <p>{session ? <>連携中：<strong className="mono">@{session.user?.login}</strong> · 本人の非公開リポジトリを任意で集計できます。</> : "GitHubアカウントでログインして、自分のカードを作成できます。"}</p>
        <p className="field-help">公開カードはサーバー側、非公開カードは本人の認証で取得します。通常上限は毎時5,000回（認証未設定時は60回）です。</p>
      </div>
      {configured ? <form action={connect}><button className="button secondary" type="submit">{session ? "GitHub と再連携" : "GitHub と連携する ↗"}</button></form> : <span className="status-pill">連携設定が必要です</span>}
    </div>
    {!session && <p className="field-help connection-permission">連携ではプロフィールと repo 権限を要求します。repo には書き込み権限も含まれますが、本アプリはリポジトリを変更しません。<a href="#privacy">権限とカードの公開範囲</a></p>}
    {!configured && <p className="field-help">管理者は AUTH_GITHUB_ID・AUTH_GITHUB_SECRET・32文字以上の AUTH_SECRET を設定してください。</p>}
    {session && <><GitHubConnectionStatus />
      <details className="connection-disconnect"><summary>連携を解除する</summary>
        <p className="field-help">GitHubの認可を取り消し、ログアウトします。この連携で作った非公開カードの共有URLも無効になります。保存済み画像は削除できません。</p>
        <form action={disconnect}><label className="check-row"><input type="checkbox" name="confirm" value="yes" required />非公開カードが使えなくなることを確認しました</label><button type="submit" className="button secondary">連携を解除してログアウト</button></form>
        <a className="text-button" href="https://github.com/settings/applications">GitHub側で認可を管理 ↗</a>
      </details>
    </>}
    {notice === "disconnected" && <p className="connection-feedback" role="status">GitHub連携を解除しました。</p>}
    {notice === "disconnect-error" && <p className="error-text" role="alert">連携を解除できませんでした。再試行するか、GitHubの設定から認可を取り消してください。</p>}
    {notice === "confirm-required" && <p className="error-text" role="alert">解除する前に確認欄を選択してください。</p>}
  </section>;
}
