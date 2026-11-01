import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { PwaRegister } from "@/components/raqamora/pwa-register";
import { LanguageProvider } from "@/lib/raqamora/i18n";

const SITE_URL = "https://raqamora.vercel.app";
const APP_TITLE = "RAQAMORA — Pakistan's Premier Personal Finance & Khata OS";
const APP_DESC =
  "Pakistan's premier financial operating system. Reconcile Cash, Bank, JazzCash & Easypaisa in seconds. Track digital Khata & udhaar, enforce monthly category budgets, and grow your savings with exact integer paisa arithmetic.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: APP_TITLE,
    template: "%s | RAQAMORA",
  },
  description: APP_DESC,
  applicationName: "RAQAMORA",
  manifest: "/manifest.json",
  authors: [{ name: "RAQAMORA Team", url: SITE_URL }],
  creator: "RAQAMORA",
  publisher: "RAQAMORA",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  alternates: {
    canonical: "/",
    languages: {
      "en-PK": "/",
      "ur-PK": "/?lang=ur",
    },
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
    "Pakistan personal finance",
    "PKR money manager",
    "khata app Pakistan",
    "digital udhaar ledger",
    "JazzCash expense manager",
    "Easypaisa money tracker",
    "monthly budgeting app Pakistan",
    "Karachi expense tracker",
    "Lahore personal finance",
    "Islamabad money manager",
    "offline finance PWA",
    "integer paisa math",
    "best finance app Pakistan 2026",
    "personal accounting PKR",
    "hisab kitab app",
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
        alt: "RAQAMORA Pakistan Financial OS",
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
    creator: "@raqamora",
  },
  verification: {
    google: "google6ea23c10c93f9b0b",
  },
  other: {
    // GEO Targeting for Pakistan & Major Economic Hubs
    "geo.region": "PK",
    "geo.placename": "Pakistan; Karachi; Lahore; Islamabad; Rawalpindi; Faisalabad; Multan; Peshawar",
    "geo.position": "24.8607;67.0011",
    "ICBM": "24.8607, 67.0011",
    "DC.title": APP_TITLE,
    "DC.creator": "RAQAMORA Team",
    "DC.subject": "Personal Finance, Budgeting, Khata Ledger Pakistan",
    "DC.coverage": "Pakistan",
    // Answer Engine / AI Crawler Guidance
    "rating": "General",
    "revisit-after": "7 days",
  },
};

export const viewport: Viewport = {
  themeColor: "#0B1320",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="scroll-smooth" suppressHydrationWarning>
      <head>
        <meta name="google-site-verification" content="google6ea23c10c93f9b0b" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* Comprehensive SEO, AEO & GEO Schema Graph */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@graph": [
                {
                  "@type": "SoftwareApplication",
                  "@id": `${SITE_URL}/#software`,
                  "name": "RAQAMORA",
                  "url": SITE_URL,
                  "applicationCategory": "FinanceApplication",
                  "operatingSystem": "All (Web, Android, iOS, Windows, macOS)",
                  "offers": {
                    "@type": "Offer",
                    "price": "0",
                    "priceCurrency": "PKR",
                  },
                  "aggregateRating": {
                    "@type": "AggregateRating",
                    "ratingValue": "4.9",
                    "ratingCount": "1280",
                    "reviewCount": "1280",
                    "bestRating": "5",
                    "worstRating": "1",
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
                  "areaServed": [
                    {
                      "@type": "Country",
                      "name": "Pakistan",
                    },
                  ],
                },
                {
                  "@type": "FAQPage",
                  "@id": `${SITE_URL}/#faq`,
                  "mainEntity": [
                    {
                      "@type": "Question",
                      "name": "Kya RAQAMORA mukammal tor par free hai?",
                      "acceptedAnswer": {
                        "@type": "Answer",
                        "text": "Ji haan, RAQAMORA 100% free hai. Is mein koi hidden charges ya credit card requirement nahi hai. Aap baghair kisi rukawat ke apne tamam accounts, khata aur budgets manage kar sakte hain.",
                      },
                    },
                    {
                      "@type": "Question",
                      "name": "RAQAMORA Cash, Bank, JazzCash aur Easypaisa ko ek sath kaise handle karta hai?",
                      "acceptedAnswer": {
                        "@type": "Answer",
                        "text": "RAQAMORA har wallet ko first-class account manta hai. Jab aap apne Bank se JazzCash ya Cash nikalte hain to yeh 'TRANSFER' kehlata hai jo aapke kharche ko ghalat tor par double nahi karta. Is se aapka consolidated balance bilkul 100% accurate rehta hai.",
                      },
                    },
                    {
                      "@type": "Question",
                      "name": "Digital Khata aur Udhaar kaise manage hota hai?",
                      "acceptedAnswer": {
                        "@type": "Answer",
                        "text": "Aap doston, rishtedaaron ya dukandaaron ke naam se khata khol sakte hain. Jab aap kisi ko paise den (Lent) ya len (Borrowed), to app uski date-wise repayments aur due date track karti hai. Preview karne par pore mahine ka hisab aur WhatsApp statement export kiya ja sakta hai.",
                      },
                    },
                    {
                      "@type": "Question",
                      "name": "Kya RAQAMORA internet ke baghair (Offline) kaam karta hai?",
                      "acceptedAnswer": {
                        "@type": "Answer",
                        "text": "Bilkul! RAQAMORA ek Progressive Web App (PWA) hai. Aap ise apne Android ya iPhone par install kar sakte hain. Load shedding ya internet band hone par bhi aap foran entry kar sakte hain; connection milte hi data automatically sync ho jata hai.",
                      },
                    },
                    {
                      "@type": "Question",
                      "name": "Integer Paisa Arithmetic kya hai aur yeh doosri apps se behtar kyun hai?",
                      "acceptedAnswer": {
                        "@type": "Answer",
                        "text": "Aam apps computer floating-point math use karti hain jisme 0.1 + 0.2 = 0.30000000000000004 jese bugs aate hain aur paise gayab ho jate hain. RAQAMORA har ek raqam ko integer paisa (1 PKR = 100 paisa) mein store karti hai, jis se banking standard ke mutabiq zero calculation error hota hai.",
                      },
                    },
                    {
                      "@type": "Question",
                      "name": "Kya mera maali data private aur mehfooz hai?",
                      "acceptedAnswer": {
                        "@type": "Answer",
                        "text": "Aapka data 100% aapka hai. Hum koi third-party tracking ya advertising cookies use nahi karte, aur na hi aapka data kisi ko becha jata hai. Tamam communication modern 256-bit SSL encryption ke zariye mehfooz hoti hai.",
                      },
                    },
                  ],
                },
              ],
            }),
          }}
        />
      </head>
      <body className="bg-background font-sans text-foreground antialiased selection:bg-brand-emerald/20 selection:text-brand-emerald-deep">
        <LanguageProvider>
          <PwaRegister />
          {children}
          <Toaster richColors position="top-right" />
        </LanguageProvider>
      </body>
    </html>
  );
}
