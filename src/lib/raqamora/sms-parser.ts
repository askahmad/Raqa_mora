/**
 * RAQAMORA Pakistani Bank & Mobile Wallet SMS Parser
 *
 * Automatically parses SMS notifications from:
 * - Meezan Bank, HBL, Bank Alfalah, Standard Chartered, UBL, MCB, Faysal Bank
 * - SadaPay, NayaPay
 * - JazzCash, Easypaisa
 *
 * Extracts amount (rupees), flow type (EXPENSE, INCOME, TRANSFER),
 * merchant/recipient note, source bank/wallet, and category hint.
 */

export interface ParsedSmsTransaction {
  amountRupees: number;
  type: "EXPENSE" | "INCOME" | "TRANSFER";
  note: string;
  source: string;
  categoryHint?: string;
  date?: string; // YYYY-MM-DD
}

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  Fuel: ["pso", "shell", "total parco", "attock", "byco", "cng", "petrol", "fuel"],
  Groceries: [
    "naheed",
    "imtiaz",
    "carrefour",
    "al fateh",
    "chase up",
    "supermarket",
    "mart",
    "grocery",
    "spar",
    "bin hashim",
  ],
  Dining: [
    "mcdonald",
    "kfc",
    "subway",
    "foodpanda",
    "cheezious",
    "hardees",
    "pizza",
    "burger",
    "cafe",
    "restaurant",
    "chai",
  ],
  Utilities: ["k-electric", "kelectric", "lesco", "iesco", "sngpl", "ssgc", "ptcl", "stormfiber", "nayatel", "bill"],
  Shopping: ["daraz", "outfitters", "khaadi", "sapphire", "gul ahmed", "junaid jamshed", "clothing", "apparel"],
  Salary: ["salary", "payroll", "allowance", "stipend"],
  Healthcare: ["pharmacy", "chemist", "chughtai", "aga khan", "shaukat khanum", "hospital", "clinic", "medical"],
};

export function parseBankSms(rawText: string): ParsedSmsTransaction | null {
  if (!rawText || rawText.trim().length < 8) return null;
  const text = rawText.trim();
  const lower = text.toLowerCase();

  // 1. Detect Bank or Wallet
  let source = "Bank / Wallet";
  if (lower.includes("meezan")) source = "Meezan Bank";
  else if (lower.includes("sadapay") || lower.includes("sada pay")) source = "SadaPay";
  else if (lower.includes("nayapay") || lower.includes("naya pay")) source = "NayaPay";
  else if (lower.includes("jazzcash") || lower.includes("jazz cash") || lower.includes("mobilink")) source = "JazzCash";
  else if (lower.includes("easypaisa") || lower.includes("easy paisa") || lower.includes("telenor")) source = "Easypaisa";
  else if (lower.includes("hbl") || lower.includes("habib bank")) source = "HBL";
  else if (lower.includes("alfalah")) source = "Bank Alfalah";
  else if (lower.includes("standard chartered") || lower.includes("scb")) source = "Standard Chartered";
  else if (lower.includes("ubl")) source = "UBL";
  else if (lower.includes("mcb")) source = "MCB";
  else if (lower.includes("faysal")) source = "Faysal Bank";

  // 2. Detect Transaction Flow Type
  let type: "EXPENSE" | "INCOME" | "TRANSFER" = "EXPENSE";

  const isIncome =
    lower.includes("credited") ||
    lower.includes("received rs") ||
    lower.includes("received pkr") ||
    lower.includes("deposited") ||
    lower.includes("inward") ||
    lower.includes("you have received");

  const isTransfer =
    lower.includes("sent to") ||
    lower.includes("transferred to") ||
    lower.includes("transfer to") ||
    lower.includes("ibft to") ||
    lower.includes("raast to");

  if (isIncome) {
    type = "INCOME";
  } else if (isTransfer) {
    type = "TRANSFER";
  } else {
    type = "EXPENSE";
  }

  // 3. Extract Amount
  // Matches: PKR 1,500.00 | Rs. 2,450 | Rs 500 | 1500.00 debited | PKR 25,000
  const amountRegexes = [
    /(?:pkr|rs\.?|inr)\s*([\d,]+(?:\.\d{1,2})?)/i,
    /([\d,]+(?:\.\d{1,2})?)\s*(?:pkr|rs\.?)/i,
    /(?:debited|credited|spent|paid|sent|withdrawn)\s*(?:pkr|rs\.?)?\s*([\d,]+(?:\.\d{1,2})?)/i,
  ];

  let amountStr: string | null = null;
  for (const regex of amountRegexes) {
    const match = text.match(regex);
    if (match && match[1]) {
      // Exclude matches that look like phone numbers or trx IDs (e.g. 03001234567 or 12345678901)
      const clean = match[1].replace(/,/g, "");
      const val = parseFloat(clean);
      if (!isNaN(val) && val > 0 && val < 50_000_000) {
        amountStr = clean;
        break;
      }
    }
  }

  if (!amountStr) return null;
  const amountRupees = parseFloat(amountStr);
  if (isNaN(amountRupees) || amountRupees <= 0) return null;

  // 4. Extract Merchant or Recipient Note
  let note = "";
  // Check for "at <Merchant>"
  const atMatch = text.match(/\bat\s+([A-Za-z0-9\s&'-]{3,35})(?:\s+on|\s+with|\s+via|\.|\,|$)/i);
  // Check for "to <Recipient>"
  const toMatch = text.match(/\bto\s+([A-Za-z0-9\s&'().-]{3,40})(?:\s+on|\s+with|\s+via|\.|\,|$)/i);
  // Check for "from <Sender>"
  const fromMatch = text.match(/\bfrom\s+([A-Za-z0-9\s&'().-]{3,40})(?:\s+on|\s+with|\s+via|\.|\,|$)/i);

  if (atMatch && atMatch[1]) {
    note = atMatch[1].trim();
  } else if (toMatch && toMatch[1]) {
    note = toMatch[1].trim();
  } else if (fromMatch && fromMatch[1]) {
    note = fromMatch[1].trim();
  } else {
    note = `${source} transaction`;
  }

  // Clean up note if it captures trailing words
  note = note.replace(/\s+(on|via|with|for|at|ref|trx|avail|balance).*$/i, "").trim();

  // 5. Categorize Hint
  let categoryHint: string | undefined;
  for (const [catName, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some((kw) => lower.includes(kw))) {
      categoryHint = catName;
      break;
    }
  }

  return {
    amountRupees,
    type,
    note,
    source,
    categoryHint,
  };
}
