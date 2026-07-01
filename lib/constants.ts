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
