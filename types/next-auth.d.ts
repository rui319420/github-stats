import "next-auth";
import "next-auth/jwt";
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    privateCardToken?: string;
    privateCardError?: string;
    user?: DefaultSession["user"] & {
      login?: string;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    accessToken?: string;
    githubUsername?: string;
  }
}
