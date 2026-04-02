import type { Metadata } from "next";
import { ThemeProvider } from "@/theme";
import "./globals.css";

export const metadata: Metadata = {
  title: "palpay",
  description: "Producer-first pilot UI for recording livestock progress, sharing proof, and guiding payout review.",
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
