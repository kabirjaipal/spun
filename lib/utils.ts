import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return "—";
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return "—";
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

export function calculatePreTaxDiscount(
  rawTaxableAmount: number,
  rawTotal: number,
  discountType: string | null | undefined,
  discountValue: number | string | null | undefined
): number {
  const type = discountType || "percentage";
  const value = Number(discountValue) || 0;
  if (value <= 0) return 0;
  
  if (type === "percentage") {
    return Math.round((rawTaxableAmount * value / 100) * 100) / 100;
  }
  if (type === "value" && rawTotal > 0) {
    return Math.round((value * (rawTaxableAmount / rawTotal)) * 100) / 100;
  }
  return 0;
}

export function getLocalTodayString(): string {
  return new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10);
}

