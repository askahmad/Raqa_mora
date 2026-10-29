"use client";

/** Maps stored icon names to Lucide icons with a safe fallback. */
import {
  Wallet, Landmark, Banknote, Smartphone, PiggyBank, CircleDot, Tag, ShoppingBasket, Car,
  Receipt, Home, ShoppingBag, GraduationCap, HeartPulse, Plane, Tv, Briefcase, Laptop, Store,
  PlusCircle, Coffee, Smartphone as Phone2, Baby, Dumbbell, Gift, Wrench, Shirt, BookOpen,
  Bike, Fuel, Wifi, Droplet, Zap, Stethoscope, Pill, Film, Music, UtensilsCrossed, HandCoins,
  type LucideIcon,
} from "lucide-react";

const MAP: Record<string, LucideIcon> = {
  wallet: Wallet, landmark: Landmark, banknote: Banknote, smartphone: Smartphone, phone: Phone2,
  "piggy-bank": PiggyBank, circle: CircleDot, tag: Tag, "shopping-basket": ShoppingBasket,
  car: Car, receipt: Receipt, home: Home, "shopping-bag": ShoppingBag,
  "graduation-cap": GraduationCap, "heart-pulse": HeartPulse, plane: Plane, tv: Tv,
  briefcase: Briefcase, laptop: Laptop, store: Store, "plus-circle": PlusCircle, coffee: Coffee,
  baby: Baby, dumbbell: Dumbbell, gift: Gift, wrench: Wrench, shirt: Shirt, book: BookOpen,
  bike: Bike, fuel: Fuel, wifi: Wifi, droplet: Droplet, zap: Zap, stethoscope: Stethoscope,
  pill: Pill, film: Film, music: Music, utensils: UtensilsCrossed, "hand-coins": HandCoins,
};

export const ICON_CHOICES = Object.keys(MAP);

export function AppIcon({ name, className }: { name: string | null | undefined; className?: string }) {
  const Icon = (name && MAP[name]) || Tag;
  return <Icon className={className} aria-hidden />;
}

export function AccountIcon({ type, className }: { type: string; className?: string }) {
  const map: Record<string, LucideIcon> = {
    CASH: Banknote, BANK: Landmark, EASYPAISA: Smartphone, JAZZCASH: Smartphone,
    SAVINGS: PiggyBank, CUSTOM: Wallet,
  };
  const Icon = map[type] ?? Wallet;
  return <Icon className={className} aria-hidden />;
}
