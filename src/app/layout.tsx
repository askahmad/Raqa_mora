import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { PwaRegister } from "@/components/raqamora/pwa-register";

const SITE_URL = "https://raqamora.vercel.app";
const APP_TITLE = "RAQAMORA — Personal Finance & Money Manager Pakistan";
const APP_DESC =
  "Best personal finance app for Pakistan. Track income, expenses, udhaar & borrowings across Cash, Bank, Easypaisa & JazzCash with person-wise khata ledgers, offline support, and paisa-perfect precision.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: APP_TITLE,
    template: "%s | RAQAMORA",
  },
  description: APP_DESC,
  applicationName: "RAQAMORA",
  manifest: "/manifest.json",
  authors: [{ name: "RAQAMORA Team" }],
  creator: "RAQAMORA",
  publisher: "RAQAMORA",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  alternates: {
    canonical: "/",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "RAQAMORA",
  },
  icons: {
    icon: "/icon.svg",
    apple: "/icon-192.png",
  },
  keywords: [
    "Pakistan",
    "personal finance Pakistan",
    "PKR expense manager",
    "budgeting app Pakistan",
    "Easypaisa money tracker",
    "JazzCash expense manager",
    "khata app",
    "udhaar ledger app",
    "offline finance app",
    "PWA personal finance",
    "money manager PKR",
  ],
  openGraph: {
    title: APP_TITLE,
    description: APP_DESC,
    url: SITE_URL,
    siteName: "RAQAMORA",
    images: [
      {
        url: "/icon-512.png",
        width: 512,
        height: 512,
        alt: "RAQAMORA App Logo",
      },
    ],
    locale: "en_PK",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: APP_TITLE,
    description: APP_DESC,
    images: ["/icon-512.png"],
  },
  other: {
    // GEO Targeting for Pakistan (Karachi / Lahore / Islamabad)
    "geo.region": "PK",
    "geo.placename": "Pakistan",
    "geo.position": "30.3753;69.3451",
    "ICBM": "30.3753, 69.3451",
  },
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
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@graph": [
                {
                  "@type": "WebApplication",
                  "@id": `${SITE_URL}/#webapp`,
                  "url": SITE_URL,
                  "name": "RAQAMORA",
                  "applicationCategory": "FinanceApplication",
                  "operatingSystem": "All (Web, Android, iOS, Windows, macOS)",
                  "offers": {
                    "@type": "Offer",
                    "price": "0",
                    "priceCurrency": "PKR",
                  },
                  "description": APP_DESC,
                  "inLanguage": ["en", "ur"],
                },
                {
                  "@type": "Organization",
                  "@id": `${SITE_URL}/#organization`,
                  "name": "RAQAMORA",
                  "url": SITE_URL,
                  "logo": `${SITE_URL}/icon-512.png`,
                  "areaServed": {
                    "@type": "Country",
                    "name": "Pakistan",
                  },
                },
              ],
            }),
          }}
        />
      </head>
      <body className="bg-background font-sans text-foreground antialiased">
        <PwaRegister />
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
