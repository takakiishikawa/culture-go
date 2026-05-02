import type { Metadata } from "next";
import { Inter, Noto_Sans_JP } from "next/font/google";
import "./globals.css";
import { DesignTokens } from "@takaki/go-design-system";
import { ClientProviders } from "./client-providers";

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
  title: "culturego — 世界の進む方向を読む",
  description:
    "世界・日本・ベトナムで起きる「大きな出来事」を週1で検出する、深掘りのトリガー。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ja"
      className={`${inter.variable} ${notoSans.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var s=localStorage.getItem('cg-theme');var d=s||(window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');document.documentElement.classList.add(d);})();`,
          }}
        />
        <DesignTokens primaryColor="#1F2937" primaryColorHover="#0F172A" />
      </head>
      <body className="min-h-full">
        {children}
        <ClientProviders />
      </body>
    </html>
  );
}
