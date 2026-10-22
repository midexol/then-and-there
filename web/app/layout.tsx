import type { Metadata, Viewport } from "next";
import "@fontsource/young-serif/400.css";
import "@fontsource-variable/atkinson-hyperlegible-next";
import "@fontsource/atkinson-hyperlegible/400.css";
import "@fontsource/atkinson-hyperlegible/700.css";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: "Then & There",
  description: "Plan a 30-minute reminiscence session from the world someone grew up in: songs, places, tastes and films, powered by Qloo.",
  icons: { icon: "/favicon.svg" },
  openGraph: {
    title: "Then & There",
    description: "Bring back the world they grew up in.",
    images: ["/og.png"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F3F4F0" },
    { media: "(prefers-color-scheme: dark)", color: "#121A3D" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
