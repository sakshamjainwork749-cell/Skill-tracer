import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/auth";

export const metadata: Metadata = {
  metadataBase: new URL("https://skilltrace.in"),
  title: {
    default: "SkillTrace — Maharashtra Skill Outcome Intelligence",
    template: "%s | SkillTrace",
  },
  description:
    "SkillTrace connects training, placement, retention and skill-gap intelligence to build sustainable livelihoods across Maharashtra.",
  applicationName: "SkillTrace",
  keywords: [
    "skill outcomes",
    "Maharashtra training",
    "employment verification",
    "Outcome Passport",
    "civic technology",
  ],
  openGraph: {
    title: "SkillTrace — From Training to Real Outcomes",
    description:
      "Maharashtra skill outcome and livelihood intelligence for trainees, employers and government.",
    type: "website",
    locale: "en_IN",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#F7F4EC",
  colorScheme: "light",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning data-scroll-behavior="smooth">
      <body>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-3 focus:z-[100] focus:rounded-xl focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-bold focus:text-navy focus:shadow-lg"
        >
          Skip to content
        </a>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
