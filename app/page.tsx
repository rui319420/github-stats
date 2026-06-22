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
    <main className="min-h-screen bg-[#f8fafd] px-4 py-5 text-[#202124] sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-6xl">
        <header className="mb-8 flex flex-col gap-6 rounded-[28px] border border-[#e8eaed] bg-white px-5 py-5 shadow-[0_1px_2px_rgba(60,64,67,0.12),0_1px_3px_rgba(60,64,67,0.08)] sm:px-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <div className="grid h-12 w-12 shrink-0 grid-cols-2 gap-1 rounded-2xl bg-white p-2 shadow-[0_1px_3px_rgba(60,64,67,0.25)]" aria-hidden="true">
              <span className="rounded-full bg-[#4285f4]" />
              <span className="rounded-full bg-[#ea4335]" />
              <span className="rounded-full bg-[#fbbc04]" />
              <span className="rounded-full bg-[#34a853]" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-[#5f6368]">Profile README card builder</p>
              <h1 className="mt-1 text-3xl font-semibold tracking-tight text-[#202124]">
                GitHub Stats
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[#5f6368]">
                Generate a clean language usage card and embed it in your GitHub profile README.
              </p>
            </div>
          </div>
          <div className="flex shrink-0 justify-start lg:justify-end">
            {session ? (
              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-full bg-[#f1f3f4] px-4 py-2 text-sm font-medium text-[#3c4043]">
                  @{username || session.user?.name}
                </span>
                <form
                  action={async () => {
                    "use server";
                    await signOut();
                  }}
                >
                  <button className="h-10 cursor-pointer rounded-full border border-[#dadce0] bg-white px-5 text-sm font-medium text-[#1a73e8] transition-colors duration-200 hover:bg-[#f8fafd] focus:outline-none focus:ring-2 focus:ring-[#1a73e8]/30">
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
                <button className="h-10 cursor-pointer rounded-full bg-[#1a73e8] px-5 text-sm font-medium text-white shadow-[0_1px_2px_rgba(26,115,232,0.25)] transition-colors duration-200 hover:bg-[#1765cc] focus:outline-none focus:ring-2 focus:ring-[#1a73e8]/30">
                  Sign in with GitHub
                </button>
              </form>
            )}
          </div>
        </header>
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
