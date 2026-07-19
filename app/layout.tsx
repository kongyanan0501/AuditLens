import type { Metadata } from "next";
import { AppShell } from "@/components/AppShell";
import { ThemeProvider } from "@/components/theme-provider";
import { defaultThemeMode, themeInitScript } from "@/lib/theme-init";
import "./globals.css";

export const metadata: Metadata = {
  title: "AuditLens AI",
  description: "智能审计风险分析系统",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-CN"
      className={defaultThemeMode}
      data-theme={defaultThemeMode}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-[100dvh] font-sans antialiased">
        <ThemeProvider defaultTheme={defaultThemeMode}>
          <AppShell>{children}</AppShell>
        </ThemeProvider>
      </body>
    </html>
  );
}
