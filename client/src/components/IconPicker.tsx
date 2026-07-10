import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils';

/** Curated Material Symbols for barbershop services */
export const SERVICE_ICONS = [
  'content_cut',
  'face',
  'auto_awesome',
  'spa',
  'water_drop',
  'design_services',
  'child_care',
  'workspace_premium',
  'health_and_beauty',
  'self_care',
  'dry_cleaning',
  'cleaning_services',
  'brush',
  'palette',
  'star',
  'favorite',
  'local_fire_department',
  'bolt',
  'timer',
  'schedule',
  'groups',
  'person',
  'face_retouching_natural',
  'sentiment_satisfied',
  'verified',
  'diamond',
  'loyalty',
  'storefront',
  'straighten',
  'gesture',
] as const;

interface IconPickerProps {
  label: string;
  value: string;
  onChange: (icon: string) => void;
}

export default function IconPicker({ label, value, onChange }: IconPickerProps) {
  const { t } = useTranslation();
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  const selected = value && SERVICE_ICONS.includes(value as (typeof SERVICE_ICONS)[number]) ? value : value || 'content_cut';

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative block">
      <span className="mb-2 block font-label text-label-caps uppercase text-on-surface-variant">{label}</span>

      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 border border-outline-variant bg-surface-container-low px-4 py-3 text-left outline-none transition-colors hover:border-primary/60 focus:border-primary"
      >
        <span className="material-symbols-outlined text-[28px] text-primary">{selected}</span>
        <span className="min-w-0 flex-1 truncate font-body text-body-md text-on-surface">{selected}</span>
        <span className="material-symbols-outlined text-[20px] text-on-surface-variant">
          {open ? 'expand_less' : 'expand_more'}
        </span>
      </button>

      {open && (
        <div
          id={listId}
          role="listbox"
          aria-label={label}
          className="absolute left-0 right-0 z-20 mt-1 max-h-64 overflow-y-auto border border-outline-variant bg-surface-container-highest p-2 shadow-glow-sm"
        >
          <div className="grid grid-cols-5 gap-1 sm:grid-cols-6">
            {SERVICE_ICONS.map((icon) => {
              const isActive = icon === selected;
              return (
                <button
                  key={icon}
                  type="button"
                  role="option"
                  aria-selected={isActive}
                  title={icon}
                  onClick={() => {
                    onChange(icon);
                    setOpen(false);
                  }}
                  className={cn(
                    'flex flex-col items-center gap-1 p-2 transition-colors',
                    isActive
                      ? 'bg-primary/15 text-primary'
                      : 'text-on-surface-variant hover:bg-primary/10 hover:text-primary',
                  )}
                >
                  <span className="material-symbols-outlined text-[28px]">{icon}</span>
                  <span className="w-full truncate text-center font-label text-[8px] uppercase tracking-wide">
                    {icon.replace(/_/g, ' ')}
                  </span>
                </button>
              );
            })}
          </div>
          {value && !SERVICE_ICONS.includes(value as (typeof SERVICE_ICONS)[number]) && (
            <p className="mt-2 border-t border-outline-variant px-2 pt-2 font-body text-[12px] text-on-surface-variant">
              {t('admin.services.iconCustom', { icon: value })}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
