import LanguagePieChart from "./components/LanguagePieChart";
import { auth, signIn, signOut } from "@/auth";
import { createCardToken } from "./lib/cardToken";

export default async function Home() {
  const session = await auth();
  const username = session?.user?.login ?? "";
  let privateCardToken: string | undefined;
  let privateCardError: string | undefined;

  if (session?.accessToken && username) {
    try {
      privateCardToken = createCardToken({
        accessToken: session.accessToken,
        username,
      });
    } catch (error) {
      privateCardError =
        error instanceof Error ? error.message : "Failed to create private card URL.";
    }
  }

  return (
    <main className="min-h-screen bg-[#0d1117] px-4 py-8 text-[#f0f6fc]">
      <div className="mx-auto w-full max-w-3xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">GitHub Stats</h1>
            <p className="mt-2 text-sm text-[#8b949e]">
              Generate a language usage card for your GitHub profile README.
            </p>
          </div>
          <div>
            {session ? (
              <div className="flex items-center gap-3">
                <span className="text-sm text-[#8b949e]">
                  @{username || session.user?.name}
                </span>
                <form
                  action={async () => {
                    "use server";
                    await signOut();
                  }}
                >
                  <button className="rounded-md border border-[#3d444d] px-4 py-2 text-sm text-[#f0f6fc] hover:border-[#8b949e]">
                    Sign out
                  </button>
                </form>
              </div>
            ) : (
              <form
                action={async () => {
                  "use server";
                  await signIn("github");
                }}
              >
                <button className="rounded-md bg-[#238636] px-4 py-2 text-sm font-semibold text-white hover:bg-[#2ea043]">
                  Sign in with GitHub
                </button>
              </form>
            )}
          </div>
        </div>
        <LanguagePieChart
          initialUsername={username}
          isSignedIn={Boolean(session)}
          privateCardToken={privateCardToken}
          privateCardError={privateCardError}
        />
      </div>
    </main>
  );
}
