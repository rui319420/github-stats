import NextAuth from "next-auth";
import { isGitHubConfigured } from "./app/lib/githubOAuth";
import GitHub from "next-auth/providers/github";
import { createCardToken } from "./app/lib/cardToken";

export const { handlers, signIn, signOut, auth } = NextAuth({
  pages: { error: "/auth/error" },
  providers: isGitHubConfigured() ? [
    GitHub({
      clientId: process.env.AUTH_GITHUB_ID,
      clientSecret: process.env.AUTH_GITHUB_SECRET,
      authorization: {
        params: {
          scope: "read:user repo",
        },
      },
    }),
  ] : [],
  callbacks: {
    async jwt({ token, account, profile }) {
      if (account?.access_token) {
        token.accessToken = account.access_token;
      }
      if (profile && "login" in profile && typeof profile.login === "string") {
        token.githubUsername = profile.login;
      }
      return token;
    },
    async session({ session, token }) {
      const username =
        typeof token.githubUsername === "string"
          ? token.githubUsername
          : undefined;

      if (session.user && username) {
        session.user.login = username;
      }

      if (
        process.env.AUTH_SECRET &&
        typeof token.accessToken === "string" &&
        username
      ) {
        try {
          session.privateCardToken = createCardToken({
            accessToken: token.accessToken,
            username,
          });
        } catch {
          session.privateCardError = "非公開カードを作成できませんでした。再連携するか、管理者に設定を確認してください。";
        }
      }

      return session;
    },
  },
});
