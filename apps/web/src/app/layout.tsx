import type { Metadata } from "next";
import { ThemeProvider } from "@/theme";
import "./globals.css";

export const metadata: Metadata = {
  title: "P2P Milestone Escrow dApps",
  description: "P2P Milestone Escrow dApps - Premium Blockchain Payment Infrastructure",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <body className="antialiased min-h-screen" suppressHydrationWarning>
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
