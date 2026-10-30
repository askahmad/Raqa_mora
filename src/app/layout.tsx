import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { PwaRegister } from "@/components/raqamora/pwa-register";

export const metadata: Metadata = {
  title: "RAQAMORA — Your Money. One Clear Picture.",
  description:
    "Premium personal finance for Pakistan. Track income, expenses, lends & borrowings across Cash, Bank, Easypaisa & JazzCash with person-wise ledgers, offline capability, and paisa-perfect arithmetic.",
  applicationName: "RAQAMORA",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "RAQAMORA",
  },
  icons: {
    icon: "/icon.svg",
    apple: "/icon-192.png",
  },
  keywords: ["Pakistan", "personal finance", "PKR", "budget", "Easypaisa", "JazzCash", "money manager", "offline finance", "PWA"],
};

export const viewport: Viewport = {
  themeColor: "#101C2C",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-background font-sans text-foreground antialiased">
        <PwaRegister />
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
