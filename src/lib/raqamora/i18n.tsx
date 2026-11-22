"use client";

import * as React from "react";
import type { ViewKey } from "@/components/raqamora/view-props";

export type Locale = "en" | "ur" | "roman";

export interface DashboardTranslations {
  greeting: string;
  financialSummary: string;
  totalBalance: string;
  monthlyRolloverCard: {
    title: string;
    subtitle: string;
    carriedFromLastMonth: string;
    carriedSubtext: string;
    addedThisMonth: string;
    addedSubtext: string;
    totalAvailable: string;
    totalAvailableSubtext: string;
    spentThisMonth: string;
    spentSubtext: string;
    remainingForNextMonth: string;
    remainingSubtext: string;
    easyAddTitle: string;
    easyAddPlaceholder: string;
    addBtn: string;
    saving: string;
    selectAccount: string;
    exampleExplainer: string;
    successAdded: string;
  };
  statCards: {
    netPosition: string;
    income: string;
    expense: string;
    netSavings: string;
    lent: string;
    borrowed: string;
  };
  tabs: {
    today: string;
    week: string;
    month: string;
    year: string;
    custom: string;
  };
  charts: {
    cashFlow: string;
    expenseByCategory: string;
    monthlyTrend: string;
    recentActivity: string;
    viewAll: string;
    noTransactions: string;
    budgetStatus: string;
    upcomingBills: string;
  };
}

export interface AccountsTranslations {
  title: string;
  subtitle: string;
  newAccount: string;
  transfer: string;
  totalBalance: string;
  activeWallets: string;
  archivedWallets: string;
  showArchived: string;
  hideArchived: string;
  monthlyProgressBtn: string;
  editAmountBtn: string;
  addMonthlyBtn: string;
  emptyNotice: string;
  quickEditTitle: string;
  quickEditSubtitle: string;
  monthlyDialogTitle: string;
  monthlyDialogSubtitle: string;
  carriedForward: string;
  inflowAdded: string;
  available: string;
  outflowSpent: string;
  remainingShift: string;
}

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
  dashboard: DashboardTranslations;
  accounts: AccountsTranslations;
  common: {
    income: string;
    expense: string;
    transfer: string;
    lent: string;
    borrowed: string;
    save: string;
    cancel: string;
    delete: string;
    edit: string;
    amount: string;
    date: string;
    category: string;
    account: string;
    person: string;
    note: string;
    balance: string;
    search: string;
    total: string;
    close: string;
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
      kameti: "Kameti",
      zakat: "Zakat",
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
      kameti: { title: "Kameti", subtitle: "Peer-saving & rotating credit tracker" },
      zakat: { title: "Zakat Calculator", subtitle: "Nisab & Islamic wealth evaluation" },
    },
    dashboard: {
      greeting: "Assalam-o-Alaikum",
      financialSummary: "Financial Summary & Rollover",
      totalBalance: "Total Available Balance",
      monthlyRolloverCard: {
        title: "Monthly Budget & Rollover",
        subtitle: "Unspent money automatically shifts into next month's balance",
        carriedFromLastMonth: "Carried from Last Month",
        carriedSubtext: "Unspent money brought forward",
        addedThisMonth: "Added This Month",
        addedSubtext: "Income & deposits",
        totalAvailable: "Total Available",
        totalAvailableSubtext: "Carried + Added",
        spentThisMonth: "Spent This Month",
        spentSubtext: "Expenses & bills",
        remainingForNextMonth: "Remaining (Shifting to Next Month)",
        remainingSubtext: "Will roll into next month",
        easyAddTitle: "Add Monthly Amount / Salary",
        easyAddPlaceholder: "e.g. 50,000",
        addBtn: "Save Raqam",
        saving: "Saving...",
        selectAccount: "Account",
        exampleExplainer: "Rule: If you add Rs 15,000 in June and spend Rs 13,000, the remaining Rs 2,000 automatically rolls into July as starting funds.",
        successAdded: "Monthly amount added successfully!",
      },
      statCards: {
        netPosition: "Net Position",
        income: "Income",
        expense: "Expense",
        netSavings: "Net Savings",
        lent: "Money Lent (Receivable)",
        borrowed: "Money Borrowed (Payable)",
      },
      tabs: {
        today: "Today",
        week: "Week",
        month: "Month",
        year: "Year",
        custom: "Custom",
      },
      charts: {
        cashFlow: "Cash Flow",
        expenseByCategory: "Spending by Category",
        monthlyTrend: "Monthly Trend",
        recentActivity: "Recent Activity",
        viewAll: "View all",
        noTransactions: "No transactions in this period",
        budgetStatus: "Budget Status",
        upcomingBills: "Upcoming Bills & Debts",
      },
    },
    accounts: {
      title: "Accounts & Wallets",
      subtitle: "Cash, bank & mobile wallets",
      newAccount: "New Account",
      transfer: "Transfer",
      totalBalance: "Total Balance Across All Accounts",
      activeWallets: "Active Accounts",
      archivedWallets: "Archived Accounts",
      showArchived: "Show Archived",
      hideArchived: "Hide Archived",
      monthlyProgressBtn: "Monthly Progress & Rollover",
      editAmountBtn: "Quick Edit Amount",
      addMonthlyBtn: "Is Mahine Ki Raqam Dalein",
      emptyNotice: "No accounts found. Create your first wallet or bank account.",
      quickEditTitle: "Edit Account Amount / Balance",
      quickEditSubtitle: "Update the live amount in this wallet or record an adjustment.",
      monthlyDialogTitle: "Monthly Carry-Forward & Progress",
      monthlyDialogSubtitle: "Track unspent money shifting month to month.",
      carriedForward: "Carried Forward",
      inflowAdded: "Added Inflow",
      available: "Total Available",
      outflowSpent: "Spent",
      remainingShift: "Remaining for Next Month",
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
      edit: "Edit",
      amount: "Amount",
      date: "Date",
      category: "Category",
      account: "Account",
      person: "Person",
      note: "Note",
      balance: "Balance",
      search: "Search...",
      total: "Total",
      close: "Close",
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
      kameti: "کمیٹی / بچت",
      zakat: "زکوٰۃ کیلکولیٹر",
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
      kameti: { title: "کمیٹی ٹریکر", subtitle: "ماہانہ اقساط اور قرعہ اندازی کا حساب" },
      zakat: { title: "زکوٰۃ کیلکولیٹر", subtitle: "نصاب کا تعین اور ڈھائی فیصد حساب" },
    },
    dashboard: {
      greeting: "السلام علیکم",
      financialSummary: "مالی خلاصہ اور ماہانہ رول اوور",
      totalBalance: "کل دستیاب بیلنس",
      monthlyRolloverCard: {
        title: "ماہانہ بجٹ اور بچت کی منتقلی (رول اوور)",
        subtitle: "بچ جانے والی رقم خود بخود اگلے مہینے منتقل ہو جاتی ہے",
        carriedFromLastMonth: "پچھلے مہینے سے آئی رقم",
        carriedSubtext: "پچھلے مہینے کی غیر خرچ شدہ رقم",
        addedThisMonth: "اس مہینے ڈالی گئی رقم",
        addedSubtext: "آمدن، تنخواہ اور ڈپازٹس",
        totalAvailable: "کل دستیاب رقم",
        totalAvailableSubtext: "پچھلی بچت + نئی آمدنی",
        spentThisMonth: "اس مہینے کا خرچہ",
        spentSubtext: "تمام بل اور اخراجات",
        remainingForNextMonth: "باقی بچی رقم (اگلے مہینے شفٹ ہوگی)",
        remainingSubtext: "اگلے مہینے میں خود بخود جائے گی",
        easyAddTitle: "اس مہینے کی رقم / تنخواہ درج کریں",
        easyAddPlaceholder: "مثلاً 50,000",
        addBtn: "رقم محفوظ کریں",
        saving: "محفوظ ہو رہا ہے...",
        selectAccount: "اکاؤنٹ منتخب کریں",
        exampleExplainer: "اصول: اگر آپ نے جون میں 15,000 روپے ڈالے اور 13,000 خرچ کیے، تو باقی 2,000 روپے خود بخود جولائی میں بطور شروعاتی رقم شفٹ ہو جائیں گے۔",
        successAdded: "ماہانہ رقم کامیابی سے شامل ہو گئی!",
      },
      statCards: {
        netPosition: "مجموعی مالی حالت",
        income: "آمدنی",
        expense: "خرچ",
        netSavings: "خالص بچت",
        lent: "ادھار دیا (لینی رقم)",
        borrowed: "ادھار لیا (دینی رقم)",
      },
      tabs: {
        today: "آج",
        week: "یہ ہفتہ",
        month: "یہ مہینہ",
        year: "یہ سال",
        custom: "تاریخ منتخب کریں",
      },
      charts: {
        cashFlow: "پیسوں کا بہاؤ",
        expenseByCategory: "کیٹگری کے لحاظ سے خرچ",
        monthlyTrend: "ماہانہ رجحان",
        recentActivity: "حالیہ لین دین",
        viewAll: "سب دیکھیں",
        noTransactions: "اس مدت میں کوئی لین دین نہیں ہوا",
        budgetStatus: "بجٹ کی صورتحال",
        upcomingBills: "آنے والے بل اور ادھار",
      },
    },
    accounts: {
      title: "اکاؤنٹس اور والٹس",
      subtitle: "کیش، بینک اور موبائل والٹس (ایزی پیسہ، جیز کیش)",
      newAccount: "نیا اکاؤنٹ بنائیں",
      transfer: "رقم ٹرانسفر کریں",
      totalBalance: "تمام اکاؤنٹس کا کل بیلنس",
      activeWallets: "فعال اکاؤنٹس",
      archivedWallets: "محفوظ شدہ (آرکائیو) اکاؤنٹس",
      showArchived: "آرکائیو دکھائیں",
      hideArchived: "آرکائیو چھپائیں",
      monthlyProgressBtn: "ماہانہ بچت اور رول اوور",
      editAmountBtn: "رقم تبدیل کریں",
      addMonthlyBtn: "اس مہینے کی رقم شامل کریں",
      emptyNotice: "کوئی اکاؤنٹ نہیں ملا۔ کیش یا بینک اکاؤنٹ شامل کریں۔",
      quickEditTitle: "اکاؤنٹ کا بیلنس تبدیل کریں",
      quickEditSubtitle: "موجودہ رقم کو درست کریں یا نئی رقم درج کریں۔",
      monthlyDialogTitle: "ماہانہ رپورٹ اور رول اوور",
      monthlyDialogSubtitle: "دیکھیں کہ ہر مہینے کتنا آیا، کتنا خرچ ہوا اور کتنا اگلے مہینے شفٹ ہوا۔",
      carriedForward: "پچھلے مہینے سے آئی رقم",
      inflowAdded: "اس مہینے آئی رقم",
      available: "کل دستیاب رقم",
      outflowSpent: "خرچ ہوا",
      remainingShift: "اگلے مہینے شفٹ ہونے والی بچت",
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
      edit: "ترمیم کریں",
      amount: "رقم",
      date: "تاریخ",
      category: "کیٹگری",
      account: "اکاؤنٹ",
      person: "شخص",
      note: "وضاحت",
      balance: "بیلنس",
      search: "تلاش کریں...",
      total: "کل رقم",
      close: "بند کریں",
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
      recurring: "Mahana Bills",
      reports: "Reports & Charts",
      notifications: "Alerts",
      settings: "Settings",
      kameti: "Kameti",
      zakat: "Zakat",
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
      kameti: { title: "Kameti Tracker", subtitle: "Mahana bachat committee aur barri" },
      zakat: { title: "Zakat Calculator", subtitle: "Nisab aur 2.5% zakat ka hisab" },
    },
    dashboard: {
      greeting: "Assalam-o-Alaikum",
      financialSummary: "Mali Khulasa & Mahana Rollover",
      totalBalance: "Kul Dastyab Balance",
      monthlyRolloverCard: {
        title: "Is Mahine Ki Raqam & Bachat Shift (Rollover)",
        subtitle: "Bachi hui raqam khud-bakhud aglay mahine shift hoti hai",
        carriedFromLastMonth: "Pichlay Mahine Se Aaya",
        carriedSubtext: "Pichlay mahine ki bachi hui raqam",
        addedThisMonth: "Is Mahine Dali Raqam",
        addedSubtext: "Aamadni, tankhwah aur jama",
        totalAvailable: "Kul Dastyab Raqam",
        totalAvailableSubtext: "Pichli bachat + Is mahine ki raqam",
        spentThisMonth: "Is Mahine Ka Kharcha",
        spentSubtext: "Bills aur kharchay",
        remainingForNextMonth: "Baqi Raqam (Aglay Mahine Shift Hogi)",
        remainingSubtext: "Aglay mahine mein shamil ho jayegi",
        easyAddTitle: "Is Mahine Ki Raqam / Salary Shamil Karein",
        easyAddPlaceholder: "Maslan 50,000",
        addBtn: "Raqam Save Karein",
        saving: "Save ho raha hai...",
        selectAccount: "Account chunein",
        exampleExplainer: "Usool: Agar aap ne June mein 15,000 dale aur 13,000 kharch kiye, to baqi 2,000 khud-bakhud July mein shift ho jayenge.",
        successAdded: "Mahana raqam kamyabi se shamil ho gayi!",
      },
      statCards: {
        netPosition: "Kul Mali Position",
        income: "Aamdani",
        expense: "Kharch",
        netSavings: "Khaalis Bachat",
        lent: "Udhar Diya (Lene Hain)",
        borrowed: "Udhar Liya (Dene Hain)",
      },
      tabs: {
        today: "Aaj",
        week: "Yeh Hafta",
        month: "Yeh Mahina",
        year: "Yeh Saal",
        custom: "Apni Marzi Ka Range",
      },
      charts: {
        cashFlow: "Paison Ka Bahaao (Cash Flow)",
        expenseByCategory: "Kharch Category Ke Mutabiq",
        monthlyTrend: "Mahana Trend",
        recentActivity: "Halia Transactions",
        viewAll: "Sab Dekhein",
        noTransactions: "Is arsay mein koi entry nahi hai",
        budgetStatus: "Budget Ki Halat",
        upcomingBills: "Aane Walay Bills Aur Udhar",
      },
    },
    accounts: {
      title: "Accounts & Wallets",
      subtitle: "Cash, bank aur mobile wallets (Easypaisa, JazzCash)",
      newAccount: "Naya Account Banayein",
      transfer: "Raqam Transfer Karein",
      totalBalance: "Tamam Accounts Ka Kul Balance",
      activeWallets: "Active Accounts",
      archivedWallets: "Archived Accounts",
      showArchived: "Archived Dekhein",
      hideArchived: "Archived Chhupayein",
      monthlyProgressBtn: "Mahana Progress & Rollover",
      editAmountBtn: "Raqam Edit Karein",
      addMonthlyBtn: "Is Mahine Ki Raqam Dalein",
      emptyNotice: "Koi account nahi mila. Naya cash ya bank account shamil karein.",
      quickEditTitle: "Account Balance Edit Karein",
      quickEditSubtitle: "Wallet ki raqam foran update karein.",
      monthlyDialogTitle: "Mahana Rollover & Progress",
      monthlyDialogSubtitle: "Har mahine ki bachat aglay mahine shift hoti hai.",
      carriedForward: "Pichlay Mahine Se Aaya",
      inflowAdded: "Is Mahine Dali Raqam",
      available: "Kul Dastyab Raqam",
      outflowSpent: "Kharch Hua",
      remainingShift: "Aglay Mahine Shift Honay Wali Bachat",
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
      edit: "Edit",
      amount: "Raqam",
      date: "Tareekh",
      category: "Category",
      account: "Account",
      person: "Fard",
      note: "Note",
      balance: "Balance",
      search: "Dhoondein...",
      total: "Kul Raqam",
      close: "Band Karein",
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
    return {
      locale: "en" as Locale,
      setLocale: () => {},
      t: TRANSLATIONS.en,
      isUrdu: false,
    };
  }
  return ctx;
}
