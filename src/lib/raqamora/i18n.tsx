"use client";

import * as React from "react";
import type { ViewKey } from "@/components/raqamora/view-props";

export type Locale = "en" | "ur" | "roman";

export interface Translations {
  appName: string;
  tagline: string;
  quickAdd: string;
  signOut: string;
  installApp: string;
  offlineBanner: string;
  syncNow: string;
  pending: string;
  onlineSyncBanner: string;
  nav: Record<ViewKey, string>;
  viewMeta: Record<ViewKey, { title: string; subtitle: string }>;
  common: {
    income: string;
    expense: string;
    transfer: string;
    lent: string;
    borrowed: string;
    save: string;
    cancel: string;
    delete: string;
    amount: string;
    date: string;
    category: string;
    account: string;
    person: string;
    note: string;
    balance: string;
    search: string;
    total: string;
  };
}

export const TRANSLATIONS: Record<Locale, Translations> = {
  en: {
    appName: "RAQAMORA",
    tagline: "Your Money. One Clear Picture.",
    quickAdd: "Quick Add",
    signOut: "Sign out",
    installApp: "Install App",
    offlineBanner: "You are offline. Transactions and changes are saved locally and will auto-sync when online.",
    syncNow: "Sync now",
    pending: "pending",
    onlineSyncBanner: "Back online. Offline changes ready to sync.",
    nav: {
      dashboard: "Dashboard",
      transactions: "Transactions",
      accounts: "Accounts",
      people: "People",
      debts: "Debts",
      budgets: "Budgets",
      goals: "Goals",
      recurring: "Recurring",
      reports: "Reports",
      notifications: "Notifications",
      settings: "Settings",
    },
    viewMeta: {
      dashboard: { title: "Dashboard", subtitle: "Your money at a glance" },
      transactions: { title: "Transactions", subtitle: "Every rupee in and out" },
      accounts: { title: "Accounts", subtitle: "Cash, bank & mobile wallets" },
      people: { title: "People", subtitle: "Lends & borrowings by person" },
      debts: { title: "Debts", subtitle: "Receivables & payables" },
      budgets: { title: "Budgets", subtitle: "Monthly category limits" },
      goals: { title: "Goals", subtitle: "Savings targets" },
      recurring: { title: "Recurring", subtitle: "Automated income & bills" },
      reports: { title: "Reports", subtitle: "Insights & CSV export" },
      notifications: { title: "Notifications", subtitle: "Alerts & reminders" },
      settings: { title: "Settings", subtitle: "Preferences & data" },
    },
    common: {
      income: "Income",
      expense: "Expense",
      transfer: "Transfer",
      lent: "Money Lent",
      borrowed: "Money Borrowed",
      save: "Save",
      cancel: "Cancel",
      delete: "Delete",
      amount: "Amount",
      date: "Date",
      category: "Category",
      account: "Account",
      person: "Person",
      note: "Note",
      balance: "Balance",
      search: "Search...",
      total: "Total",
    },
  },
  ur: {
    appName: "رقمورا",
    tagline: "آپ کا پیسہ، ایک واضح تصویر۔",
    quickAdd: "نیا اندراج",
    signOut: "لاگ آؤٹ",
    installApp: "ایپ انسٹال کریں",
    offlineBanner: "انٹرنیٹ بند ہے۔ اندراج محفوظ ہے، آن لائن ہوتے ہی خودکار سنک ہو جائے گا۔",
    syncNow: "ابھی سنک کریں",
    pending: "زیر التواء",
    onlineSyncBanner: "انٹرنیٹ بحال ہو گیا، ڈیٹا سنک ہو رہا ہے۔",
    nav: {
      dashboard: "ڈیش بورڈ",
      transactions: "لین دین",
      accounts: "اکاؤنٹس / والٹس",
      people: "افراد / رابطے",
      debts: "ادھار / کھاتہ",
      budgets: "ماہانہ بجٹ",
      goals: "بچت کے اہداف",
      recurring: "ماہانہ بل و آمدن",
      reports: "رپورٹس اور جائزے",
      notifications: "اطلاعات / الرٹس",
      settings: "ترتیبات",
    },
    viewMeta: {
      dashboard: { title: "ڈیش بورڈ", subtitle: "آپ کے مالی معاملات کا خلاصہ" },
      transactions: { title: "لین دین کا ریکارڈ", subtitle: "آمدنی اور اخراجات کا مکمل کھاتہ" },
      accounts: { title: "اکاؤنٹس اور والٹس", subtitle: "کیش، بینک، ایزی پیسہ اور جیز کیش" },
      people: { title: "افراد کے کھاتے", subtitle: "کس سے کتنا لین دین ہے" },
      debts: { title: "ادھار اور واجبات", subtitle: "وصولیاں اور ادائیگیاں" },
      budgets: { title: "ماہانہ بجٹ", subtitle: "کیٹگری کے مطابق خرچ کی حد" },
      goals: { title: "بچت کے اہداف", subtitle: "مستقبل کی ضروریات کی منصوبہ بندی" },
      recurring: { title: "بار بار ہونے والے اخراجات", subtitle: "تنخواہ، بل اور فیسیں" },
      reports: { title: "مالیاتی رپورٹس", subtitle: "مکمل تجزیہ اور فائل برآمد کریں" },
      notifications: { title: "الرٹس اور یاد دہانیاں", subtitle: "بجٹ اور ادھار کی واپسی کے پیغامات" },
      settings: { title: "ایپ ترتیبات", subtitle: "ترجیحات، ڈیٹا بیک اپ اور سیکیورٹی" },
    },
    common: {
      income: "آمدنی",
      expense: "خرچ",
      transfer: "ٹرانسفر",
      lent: "ادھار دیا",
      borrowed: "ادھار لیا",
      save: "محفوظ کریں",
      cancel: "منسوخ",
      delete: "حذف کریں",
      amount: "رقم",
      date: "تاریخ",
      category: "کیٹگری",
      account: "اکاؤنٹ",
      person: "شخص",
      note: "وضاحت",
      balance: "بیلنس",
      search: "تلاش کریں...",
      total: "کل رقم",
    },
  },
  roman: {
    appName: "RAQAMORA",
    tagline: "Aap ka paisa, aik wazeh tasweer.",
    quickAdd: "Naya Entry",
    signOut: "Log Out",
    installApp: "App Install Karein",
    offlineBanner: "Net band hai. Entry mehfooz hai, net aate hi auto-sync ho jaye gi.",
    syncNow: "Abhi Sync Karein",
    pending: "pending",
    onlineSyncBanner: "Net wapis aa gaya. Offline data live sync ke liye tayar hai.",
    nav: {
      dashboard: "Dashboard",
      transactions: "Transactions",
      accounts: "Accounts / Wallets",
      people: "Log (People)",
      debts: "Udhar / Khata",
      budgets: "Monthly Budgets",
      goals: "Bachat Goals",
      recurring: "Recurring Bills",
      reports: "Reports & Charts",
      notifications: "Alerts",
      settings: "Settings",
    },
    viewMeta: {
      dashboard: { title: "Dashboard", subtitle: "Aap ke paison ka aik nazar jaiza" },
      transactions: { title: "Transactions", subtitle: "Aamadni aur kharch ka hisab" },
      accounts: { title: "Accounts", subtitle: "Cash, Bank, Easypaisa aur JazzCash" },
      people: { title: "Log (People)", subtitle: "Har fard ka alag khata" },
      debts: { title: "Udhar / Khata", subtitle: "Lene aur dene walay paise" },
      budgets: { title: "Budgets", subtitle: "Har category ki mahana had" },
      goals: { title: "Bachat Goals", subtitle: "Saving targets aur planning" },
      recurring: { title: "Mahana Bills", subtitle: "Har maheene ke automatic kharchay" },
      reports: { title: "Reports", subtitle: "Tafseeli jaiza aur CSV download" },
      notifications: { title: "Alerts", subtitle: "Budget aur udhar ke reminders" },
      settings: { title: "Settings", subtitle: "Preferences aur data backup" },
    },
    common: {
      income: "Aamadni",
      expense: "Kharch",
      transfer: "Transfer",
      lent: "Udhar Diya",
      borrowed: "Udhar Liya",
      save: "Save Karein",
      cancel: "Cancel",
      delete: "Delete",
      amount: "Raqam",
      date: "Tareekh",
      category: "Category",
      account: "Account",
      person: "Fard",
      note: "Note",
      balance: "Balance",
      search: "Dhoondein...",
      total: "Kul Raqam",
    },
  },
};

const LOCALE_KEY = "raqamora_locale_pref";

interface LanguageContextType {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: Translations;
  isUrdu: boolean;
}

const LanguageContext = React.createContext<LanguageContextType | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = React.useState<Locale>("en");

  React.useEffect(() => {
    try {
      const saved = localStorage.getItem(LOCALE_KEY) as Locale | null;
      if (saved && (saved === "en" || saved === "ur" || saved === "roman")) {
        setLocaleState(saved);
        if (saved === "ur") {
          document.documentElement.dir = "rtl";
          document.documentElement.lang = "ur";
        } else {
          document.documentElement.dir = "ltr";
          document.documentElement.lang = "en";
        }
      }
    } catch {
      /* ignore storage error */
    }
  }, []);

  const setLocale = React.useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    try {
      localStorage.setItem(LOCALE_KEY, newLocale);
    } catch {
      /* ignore storage error */
    }

    if (newLocale === "ur") {
      document.documentElement.dir = "rtl";
      document.documentElement.lang = "ur";
    } else {
      document.documentElement.dir = "ltr";
      document.documentElement.lang = "en";
    }
  }, []);

  const value = React.useMemo(() => {
    return {
      locale,
      setLocale,
      t: TRANSLATIONS[locale],
      isUrdu: locale === "ur",
    };
  }, [locale, setLocale]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const ctx = React.useContext(LanguageContext);
  if (!ctx) {
    // fallback safe
    return {
      locale: "en" as Locale,
      setLocale: () => {},
      t: TRANSLATIONS.en,
      isUrdu: false,
    };
  }
  return ctx;
}

