import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Providers from "./providers";
import { resolveRequestTheme } from "@/lib/theme-server";
import { PLATFORM_THEME_SCOPE } from "@/lib/theme";
import { ThemeToggle } from "@/components/ThemeToggle";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "TeamLease EdTech Innovation Hub",
    template: "%s | TeamLease EdTech Innovation Hub",
  },
  description:
    "Hackathons, business symposiums and innovation challenges by TeamLease EdTech — register a team, submit, pitch and follow live results.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Light/dark: contest default (hackathon dark, symposium light) unless the
  // visitor toggled it for this contest. Resolved on the server → no flash.
  const { mode, scope } = await resolveRequestTheme();
  return (
    <html lang="en" data-theme={mode} data-theme-scope={scope} style={{ colorScheme: mode }}>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Providers>{children}</Providers>
        {/* Contest pages carry the toggle in their nav bar; platform pages get a floating one. */}
        {scope === PLATFORM_THEME_SCOPE && <ThemeToggle floating />}
      </body>
    </html>
  );
}
