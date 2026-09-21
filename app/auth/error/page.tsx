import Link from "next/link";
export default async function AuthError({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const message = error === "AccessDenied" ? "GitHub連携がキャンセルされたか、アクセスが許可されませんでした。" : error === "Configuration" ? "GitHub連携の設定を確認できませんでした。管理者に確認してください。" : "GitHubとの連携を完了できませんでした。時間をおいて再試行してください。";
  return <main className="site-shell"><section className="panel connection-panel"><h1>GitHub と連携できませんでした</h1><p>{message}</p><Link href="/#connection" className="button secondary">カード作成画面へ戻る</Link></section></main>;
}
