import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

export const metadata: Metadata = {
  title: "RAQAMORA — Your Money. One Clear Picture.",
  description:
    "Premium personal finance for Pakistan. Track income, expenses, lends & borrowings across Cash, Bank, Easypaisa & JazzCash with person-wise ledgers and paisa-perfect arithmetic.",
  applicationName: "RAQAMORA",
  keywords: ["Pakistan", "personal finance", "PKR", "budget", "Easypaisa", "JazzCash", "money manager"],
};

export const viewport: Viewport = {
  themeColor: "#101C2C",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-background font-sans text-foreground antialiased">
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
