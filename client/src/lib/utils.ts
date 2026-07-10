export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}

/**
 * Map legacy / invalid service icon names to valid Material Symbols so the
 * glyph renders instead of raw ligature text (e.g. old DB rows).
 */
const ICON_ALIASES: Record<string, string> = {
  scissors: 'content_cut',
  cut: 'content_cut',
  haircut: 'content_cut',
  razor: 'face',
  beard: 'face',
  shave: 'face',
  combo: 'auto_awesome',
  package: 'auto_awesome',
  premium: 'workspace_premium',
  shampoo: 'water_drop',
  wash: 'water_drop',
  kids: 'child_care',
  child: 'child_care',
};

export function resolveServiceIcon(icon?: string | null): string {
  if (!icon) return 'content_cut';
  const key = icon.trim().toLowerCase();
  if (ICON_ALIASES[key]) return ICON_ALIASES[key];
  // Valid Material Symbols use snake_case a-z; anything with spaces/caps is likely a label
  return /^[a-z0-9_]+$/.test(key) ? key : 'content_cut';
}

/** Resolve service name/description for the active UI locale. */
export function localizedService(
  service: {
    name?: string;
    description?: string;
    nameEn?: string;
    nameRu?: string;
    descriptionEn?: string;
    descriptionRu?: string;
  },
  locale: string,
): { name: string; description: string } {
  const ru = locale.startsWith('ru');
  return {
    name: (ru ? service.nameRu || service.name || service.nameEn : service.nameEn || service.name) || '',
    description:
      (ru
        ? service.descriptionRu || service.description || service.descriptionEn
        : service.descriptionEn || service.description) || '',
  };
}

export function formatPriceCents(cents: number): string {
  return `$${(cents / 100).toFixed(0)}`;
}

export function formatDuration(minutes: number, minLabel = 'min'): string {
  if (minutes < 60) return `${minutes} ${minLabel}`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}${minLabel}`;
}

export function formatDateISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function formatDateLabel(iso: string, locale: string): string {
  const date = new Date(`${iso}T00:00:00`);
  return date.toLocaleDateString(locale === 'ru' ? 'ru-RU' : 'en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export function formatTimeLabel(iso: string, locale: string): string {
  const date = new Date(iso);
  return date.toLocaleTimeString(locale === 'ru' ? 'ru-RU' : 'en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function formatDateTimeLabel(iso: string, locale: string): string {
  const date = new Date(iso);
  return date.toLocaleString(locale === 'ru' ? 'ru-RU' : 'en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function combineDateAndTime(dateISO: string, time: string): Date {
  return new Date(`${dateISO}T${time}:00`);
}

export function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
