import {
  Banknote,
  Car,
  CircleHelp,
  Home,
  HeartPulse,
  PiggyBank,
  ShoppingCart,
  Shirt,
  Sparkles,
  Utensils,
  type LucideIcon,
} from 'lucide-react';

/** Category/goal icons come from the server as names ("ShoppingCart", "Home", ...). */
const ICONS: Record<string, LucideIcon> = {
  shoppingcart: ShoppingCart,
  home: Home,
  car: Car,
  utensils: Utensils,
  heartpulse: HeartPulse,
  sparkles: Sparkles,
  shirt: Shirt,
  banknote: Banknote,
  piggybank: PiggyBank,
};

export const iconByName = (name: string | undefined): LucideIcon => ICONS[(name ?? '').toLowerCase()] ?? CircleHelp;
