import type { Metadata } from "next";
import { Inter, Noto_Sans_JP } from "next/font/google";
import "./globals.css";
import { AppLayout, DesignTokens } from "@takaki/go-design-system";
import { ClientProviders } from "./client-providers";
import { CultureGoSidebar } from "@/components/layout/culture-go-sidebar";
import { createClient } from "@/lib/supabase/server";
import { fetchUnreadCounts } from "@/lib/unread-counts";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

const notoSans = Noto_Sans_JP({
  variable: "--font-noto-sans",
  weight: ["400", "500", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "CultureGo",
  description: "週刊のスローメディア",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const unreadCounts = user ? await fetchUnreadCounts(supabase) : null;

  return (
    <html
      lang="ja"
      className={`${inter.variable} ${notoSans.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <DesignTokens primaryColor="#1F2937" primaryColorHover="#0F172A" />
      </head>
      <body className="min-h-full">
        {user ? (
          <AppLayout sidebar={<CultureGoSidebar unreadCounts={unreadCounts} />}>
            {children}
          </AppLayout>
        ) : (
          <main>{children}</main>
        )}
        <ClientProviders />
      </body>
    </html>
  );
}
