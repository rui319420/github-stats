import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GitHub Stats — README用言語カード",
  description: "GitHubの使用言語をプロフィールREADME向けSVGカードに整えます。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" suppressHydrationWarning className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
