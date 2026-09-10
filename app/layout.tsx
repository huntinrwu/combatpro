import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import { Sidebar } from "@/components/sidebar";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { ViewAsBanner } from "@/components/view-as-banner";
import { getSessionUser } from "@/lib/auth/session";
import { visibleModules } from "@/lib/modules";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CombatPro",
  description: "Operations platform for combat sports promoters and sanctioning bodies.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "CombatPro",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getSessionUser();
  const visibleSlugs = session
    ? visibleModules(session.approvedRoles, session.isStaff).map((m) => m.slug)
    : [];
  const navUser = session
    ? {
        email: session.email,
        fullName: session.fullName,
        isStaff: session.isStaff,
        actualIsStaff: session.actualIsStaff,
        isAdmin: session.isAdmin,
        actualIsAdmin: session.actualIsAdmin,
        viewAsRole: session.viewAsRole,
        viewAsEmployee: session.viewAsEmployee,
      }
    : null;

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full bg-background text-foreground">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <div className="flex min-h-screen">
            <Sidebar user={navUser} visibleSlugs={visibleSlugs} />
            <main className="flex min-w-0 flex-1 flex-col pt-14 md:pt-0">
              {session && (session.viewAsRole || session.viewAsEmployee) && (
                <ViewAsBanner
                  role={session.viewAsRole}
                  employee={session.viewAsEmployee}
                />
              )}
              {children}
            </main>
          </div>
          <Toaster position="bottom-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}
