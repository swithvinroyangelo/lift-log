import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { TabBar } from "@/components/tab-bar";
import "./globals.css";

export const metadata: Metadata = {
  title: "Lift Log",
  description: "A personal workout log with unlimited routines.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon-192.png", apple: "/apple-touch-icon.png" },
  appleWebApp: { capable: true, title: "Lift Log", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#000000",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh bg-bg font-sans text-sm text-text antialiased">
        <div className="mx-auto min-h-dvh w-full max-w-[480px] pb-[calc(var(--tab-bar-height)+env(safe-area-inset-bottom)+16px)]">
          {children}
        </div>
        <TabBar />
      </body>
    </html>
  );
}
