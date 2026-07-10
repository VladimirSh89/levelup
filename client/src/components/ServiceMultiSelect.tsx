import { useTranslation } from 'react-i18next';

import { cn, resolveServiceIcon } from '@/lib/utils';
import type { Service } from '@/types';

interface ServiceMultiSelectProps {
  label: string;
  services: Service[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  emptyLabel?: string;
}

export default function ServiceMultiSelect({
  label,
  services,
  selectedIds,
  onChange,
  emptyLabel,
}: ServiceMultiSelectProps) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language?.startsWith('ru') ? 'ru' : 'en';

  const toggle = (id: string) => {
    if (selectedIds.includes(id)) onChange(selectedIds.filter((x) => x !== id));
    else onChange([...selectedIds, id]);
  };

  return (
    <div>
      <span className="mb-2 block font-label text-label-caps uppercase text-on-surface-variant">{label}</span>

      {services.length === 0 ? (
        <div className="border border-outline-variant bg-surface-container-low px-4 py-3 font-body text-[13px] text-on-surface-variant">
          {emptyLabel ?? t('admin.masters.servicesEmpty')}
        </div>
      ) : (
        <div className="max-h-48 space-y-1 overflow-y-auto border border-outline-variant bg-surface-container-low p-2">
          {services.map((service) => {
            const id = service.id;
            const checked = selectedIds.includes(id);
            const name =
              (locale === 'ru' ? service.nameRu : service.nameEn) || service.name || service.nameEn || id;
            return (
              <label
                key={id}
                className={cn(
                  'flex cursor-pointer items-center gap-3 px-3 py-2 transition-colors',
                  checked ? 'bg-primary/10 text-on-surface' : 'text-on-surface-variant hover:bg-primary/5',
                )}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(id)}
                  className="h-4 w-4 accent-primary"
                />
                {service.icon && (
                  <span className="material-symbols-outlined text-[18px] text-primary">
                    {resolveServiceIcon(service.icon)}
                  </span>
                )}
                <span className="min-w-0 flex-1 font-body text-body-md">{name}</span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}
