import React from 'react';
import { 
  ShoppingCart, 
  Home, 
  Car, 
  Utensils, 
  HeartPulse, 
  Sparkles, 
  Shirt, 
  ArrowLeftRight, 
  HelpCircle,
  PiggyBank,
  Landmark,
  Coins,
  Vault
} from 'lucide-react';
import { Category } from '../types';

// Map icon string or category ID to Lucide icon component
export const getCategoryIconComponent = (iconName?: string, categoryId?: string) => {
  const cId = (categoryId || '').toLowerCase();
  const iName = (iconName || '').toLowerCase();

  // 1. Explicit Category ID overrides (guarantees separation between savings and loans)
  if (cId === 'cat-savings' || cId.includes('saving') || cId.includes('копилк')) {
    return PiggyBank;
  }
  if (cId === 'cat-loans' || cId.includes('loan') || cId.includes('кредит')) {
    return Landmark;
  }

  // 2. Savings & Accumulations
  if (iName.includes('piggy') || iName.includes('копилк') || iName.includes('saving') || iName.includes('накоплен') || iName.includes('сбережен')) {
    return PiggyBank;
  }
  if (iName.includes('coins') || iName.includes('монет')) {
    return Coins;
  }
  if (iName.includes('vault') || iName.includes('сейф')) {
    return Vault;
  }

  // 3. Loans, Mortgages & Bank obligations
  if (
    iName.includes('landmark') || 
    iName.includes('credit') || 
    iName.includes('loan') || 
    iName.includes('ипотек') || 
    iName.includes('займ') || 
    iName.includes('рассрочк') || 
    iName.includes('кредит') || 
    iName.includes('банк')
  ) {
    return Landmark;
  }

  const key = `${iName} ${cId}`;

  // 3. Regular expense categories
  if (key.includes('shopping') || key.includes('groceries') || key.includes('продукт') || key.includes('корзин')) {
    return ShoppingCart;
  }
  if (key.includes('home') || key.includes('housing') || key.includes('жкх') || key.includes('дом') || key.includes('жилье')) {
    return Home;
  }
  if (key.includes('car') || key.includes('auto') || key.includes('авто') || key.includes('транспорт') || key.includes('бензин')) {
    return Car;
  }
  if (key.includes('utensils') || key.includes('cafes') || key.includes('кафе') || key.includes('ресторан') || key.includes('еда')) {
    return Utensils;
  }
  if (key.includes('heart') || key.includes('health') || key.includes('аптек') || key.includes('здоровь') || key.includes('врач')) {
    return HeartPulse;
  }
  if (key.includes('sparkles') || key.includes('leisure') || key.includes('развлечен') || key.includes('хобби') || key.includes('кино')) {
    return Sparkles;
  }
  if (key.includes('shirt') || key.includes('clothes') || key.includes('одежд') || key.includes('вещи') || key.includes('обувь')) {
    return Shirt;
  }
  if (key.includes('arrow') || key.includes('transfer') || key.includes('перевод')) {
    return ArrowLeftRight;
  }
  return HelpCircle;
};

export const CATEGORY_STYLE_CONFIG: Record<string, { bg: string; text: string; border: string; glow: string }> = {
  'cat-groceries': {
    bg: 'dark:bg-emerald-500/15 bg-emerald-50',
    text: 'dark:text-emerald-400 text-emerald-700',
    border: 'dark:border-emerald-500/30 border-emerald-200/80',
    glow: 'dark:shadow-emerald-500/20 shadow-emerald-500/10',
  },
  'cat-housing': {
    bg: 'dark:bg-indigo-500/15 bg-sky-50',
    text: 'dark:text-indigo-400 text-sky-700',
    border: 'dark:border-indigo-500/30 border-sky-200/80',
    glow: 'dark:shadow-indigo-500/20 shadow-sky-500/10',
  },
  'cat-auto': {
    bg: 'dark:bg-cyan-500/15 bg-blue-50',
    text: 'dark:text-cyan-400 text-blue-700',
    border: 'dark:border-cyan-500/30 border-blue-200/80',
    glow: 'dark:shadow-cyan-500/20 shadow-blue-500/10',
  },
  'cat-cafes': {
    bg: 'dark:bg-orange-500/15 bg-orange-50',
    text: 'dark:text-orange-400 text-orange-700',
    border: 'dark:border-orange-500/30 border-orange-200/80',
    glow: 'dark:shadow-orange-500/20 shadow-orange-500/10',
  },
  'cat-health': {
    bg: 'dark:bg-rose-500/15 bg-teal-50',
    text: 'dark:text-rose-400 text-teal-700',
    border: 'dark:border-rose-500/30 border-teal-200/80',
    glow: 'dark:shadow-rose-500/20 shadow-teal-500/10',
  },
  'cat-leisure': {
    bg: 'dark:bg-purple-500/15 bg-purple-50',
    text: 'dark:text-purple-400 text-purple-700',
    border: 'dark:border-purple-500/30 border-purple-200/80',
    glow: 'dark:shadow-purple-500/20 shadow-purple-500/10',
  },
  'cat-clothes': {
    bg: 'dark:bg-blue-500/15 bg-indigo-50',
    text: 'dark:text-blue-400 text-indigo-700',
    border: 'dark:border-blue-500/30 border-indigo-200/80',
    glow: 'dark:shadow-blue-500/20 shadow-indigo-500/10',
  },
  'cat-loans': {
    bg: 'dark:bg-red-500/15 bg-rose-50',
    text: 'dark:text-red-400 text-rose-700',
    border: 'dark:border-red-500/30 border-rose-200/80',
    glow: 'dark:shadow-red-500/20 shadow-rose-500/10',
  },
  'cat-transfer': {
    bg: 'dark:bg-slate-500/15 bg-slate-100',
    text: 'dark:text-slate-400 text-slate-700',
    border: 'dark:border-slate-500/30 border-slate-200',
    glow: 'dark:shadow-slate-500/20 shadow-slate-500/10',
  },
  'cat-savings': {
    bg: 'dark:bg-purple-500/15 bg-amber-50',
    text: 'dark:text-purple-400 text-amber-700',
    border: 'dark:border-purple-500/30 border-amber-200/80',
    glow: 'dark:shadow-purple-500/20 shadow-amber-500/10',
  },
};

const DEFAULT_STYLE = {
  bg: 'dark:bg-slate-800/80 bg-slate-100',
  text: 'dark:text-slate-300 text-slate-700',
  border: 'dark:border-slate-700/60 border-slate-200',
  glow: 'dark:shadow-slate-500/10 shadow-slate-200/50',
};

interface CategoryIconProps {
  category?: Category | null;
  categoryId?: string;
  iconName?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  showTooltip?: boolean;
}

export const CategoryIcon: React.FC<CategoryIconProps> = ({
  category,
  categoryId,
  iconName,
  size = 'md',
  className = '',
  showTooltip = true,
}) => {
  const catId = category?.id || categoryId || '';
  const icon = category?.icon || iconName;
  const name = category?.name || 'Категория';
  const IconComponent = getCategoryIconComponent(icon, catId);
  const style = CATEGORY_STYLE_CONFIG[catId] || DEFAULT_STYLE;

  const sizeMap = {
    xs: { container: 'w-6 h-6 rounded-md', icon: 'w-3 h-3' },
    sm: { container: 'w-8 h-8 rounded-lg', icon: 'w-4 h-4' },
    md: { container: 'w-9 h-9 rounded-xl', icon: 'w-4.5 h-4.5' },
    lg: { container: 'w-11 h-11 rounded-xl', icon: 'w-5.5 h-5.5' },
    xl: { container: 'w-13 h-13 rounded-2xl', icon: 'w-6.5 h-6.5' },
  };

  const sz = sizeMap[size];

  return (
    <div
      title={showTooltip ? name : undefined}
      className={`inline-flex items-center justify-center border shrink-0 ${sz.container} ${style.bg} ${style.text} ${style.border} ${className}`}
    >
      <IconComponent className={sz.icon} />
    </div>
  );
};

// Compact icon badge that replaces full text inscriptions
export const CategoryIconBadge: React.FC<{ category?: Category | null; categoryId?: string; showLabel?: boolean }> = ({
  category,
  categoryId,
  showLabel = false,
}) => {
  const catId = category?.id || categoryId || '';
  const name = category?.name || 'Категория';
  const IconComponent = getCategoryIconComponent(category?.icon, catId);
  const style = CATEGORY_STYLE_CONFIG[catId] || DEFAULT_STYLE;

  return (
    <span
      title={name}
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg border text-xs font-medium ${style.bg} ${style.text} ${style.border}`}
    >
      <IconComponent className="w-3.5 h-3.5 shrink-0" />
      {showLabel && <span className="truncate max-w-[120px]">{name}</span>}
    </span>
  );
};

// Interactive category icon selector replacing <select> dropdowns
interface CategoryIconSelectorProps {
  categories: Category[];
  selectedCategoryId: string;
  onSelect: (categoryId: string) => void;
  filterTransfers?: boolean;
  showLabel?: boolean;
}

export const CategoryIconSelector: React.FC<CategoryIconSelectorProps> = ({
  categories,
  selectedCategoryId,
  onSelect,
  filterTransfers = true,
  showLabel = false,
}) => {
  const displayCategories = filterTransfers
    ? categories.filter((c) => c.id !== 'cat-transfer')
    : categories;

  return (
    <div className="grid grid-cols-4 sm:grid-cols-4 md:grid-cols-8 gap-2">
      {displayCategories.map((c) => {
        const IconComponent = getCategoryIconComponent(c.icon, c.id);
        const isSelected = selectedCategoryId === c.id;
        const style = CATEGORY_STYLE_CONFIG[c.id] || DEFAULT_STYLE;

        return (
          <button
            key={c.id}
            type="button"
            onClick={() => onSelect(c.id)}
            title={c.name}
            aria-label={c.name}
            className={`group relative flex ${showLabel ? 'flex-col' : ''} items-center justify-center ${showLabel ? 'p-2' : 'p-2.5 sm:p-3'} rounded-xl border transition-all ${
              isSelected
                ? `${style.bg} ${style.border} ring-2 ring-blue-500/50 shadow-md ${style.glow} scale-105`
                : 'dark:bg-slate-950/60 bg-slate-50 dark:border-slate-800/80 border-slate-200 dark:hover:border-slate-700/80 hover:border-slate-300 dark:hover:bg-slate-900/60 hover:bg-slate-100'
            }`}
          >
            <div
              className={`w-8 h-8 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center transition-colors ${
                isSelected ? style.text : 'dark:text-slate-400 text-slate-500 dark:group-hover:text-slate-200 group-hover:text-slate-700'
              }`}
            >
              <IconComponent className="w-5 h-5" />
            </div>
            {showLabel && (
              <span
                className={`text-[10px] mt-1 truncate max-w-full text-center transition-colors ${
                  isSelected ? 'font-bold dark:text-white text-slate-900' : 'dark:text-slate-400 text-slate-600 dark:group-hover:text-slate-300 group-hover:text-slate-800'
                }`}
              >
                {c.name}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};
