export interface Currency {
  symbol: string;
  nation: string;
  label: string;
}

export const CURRENCIES: Currency[] = [
  { symbol: "₹", nation: "India", label: "₹ (INR - India)" },
  { symbol: "$", nation: "United States", label: "$ (USD - USA)" },
  { symbol: "£", nation: "United Kingdom", label: "£ (GBP - UK)" },
  { symbol: "€", nation: "Eurozone", label: "€ (EUR - Euro)" },
  { symbol: "¥", nation: "Japan", label: "¥ (JPY - Japan)" },
  { symbol: "A$", nation: "Australia", label: "A$ (AUD - Australia)" },
  { symbol: "C$", nation: "Canada", label: "C$ (CAD - Canada)" },
  { symbol: "CHF", nation: "Switzerland", label: "CHF (Swiss Franc)" },
  { symbol: "元", nation: "China", label: "元 (CNY - China)" },
  { symbol: "AED", nation: "United Arab Emirates", label: "AED (UAE Dirham)" },
];

export const MARKET_CATEGORIES: Record<string, string[]> = {
  textiles: ["Weaving", "Trading", "Processing", "Knitting", "Spinning", "Manufacturing", "Other"],
  diamond: ["Polished Diamonds", "Rough Diamonds", "Diamond Manufacturing", "Jewellery", "Other"],
  general: ["Retail", "Wholesale", "Services", "Manufacturing", "Distribution", "Other"],
};

export const DEFAULT_UNITS = [
  { code: "PCS", name: "Pieces" },
  { code: "MTR", name: "Meters" },
  { code: "KGS", name: "Kilograms" },
  { code: "GRM", name: "Grams" },
  { code: "LTR", name: "Liters" },
  { code: "BOX", name: "BOX" },
];

export const DEFAULT_LEDGER_GROUPS = [
  "Capital Account",
  "Sales Account",
  "Purchase Account",
  "Bank Account",
  "Stock in Hand",
  "Sales Return",
  "Purchase Return",
  "Direct Expenses",
  "Indirect Income",
  "Profit & Loss",
  "Unsecured Loans",
  "Secured Loans",
  "Deposits & Advance Assets",
  "Fixed Assets",
  "Investment",
  "Loan (Assets)",
  "Preliminary Expenses",
  "Cash in Hand",
  "Provisions",
  "Sundry Debtors",
  "Sundry Creditors",
  "Suspense Account",
];

export const DEFAULT_INVENTORY_GROUPS = ["Consumable", "Selling"];

export const APP_NAME = "Spun";
export const APP_DESCRIPTION = "Spun is a modern cloud ERP for textile businesses — manage bookkeeping, inventory, GST, vouchers, and reports in one place.";
export const APP_MOTTO = "Modern ERP for Textile Businesses";
export const STORAGE_BANKS_KEY = "spun_custom_banks";

