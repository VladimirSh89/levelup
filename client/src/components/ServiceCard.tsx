import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import type { Service } from '@/types';
import { cn, formatDuration, formatPriceCents, localizedService } from '@/lib/utils';

interface ServiceCardProps {
  service: Service;
  selectable?: boolean;
  selected?: boolean;
  onSelect?: (service: Service) => void;
}

export default function ServiceCard({ service, selectable, selected, onSelect }: ServiceCardProps) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language?.startsWith('ru') ? 'ru' : 'en';
  const { name, description } = localizedService(service, locale);
  const priceCents = service.priceCents ?? service.basePriceCents;
  const durationMinutes = service.durationMinutes ?? service.baseDurationMinutes;

  const cardClassName = cn(
    'group relative w-full cursor-pointer border-t-2 p-8 text-left transition-all duration-300 glow-hover',
    selected ? 'border-secondary-container bg-surface-container-highest' : 'border-primary bg-surface-container-high',
  );

  const content = (
    <>
      {selected && (
        <span className="absolute right-8 top-8 flex h-6 w-6 items-center justify-center bg-secondary-container text-on-secondary">
          <span className="material-symbols-outlined text-[16px]">check</span>
        </span>
      )}
      {!selected && (
        <div className="absolute top-8 right-8 font-label text-label-md text-primary">
          {formatPriceCents(priceCents)}
        </div>
      )}

      <span
        className="material-symbols-outlined mb-6 block text-4xl text-on-surface-variant transition-colors group-hover:text-primary"
        style={{ fontVariationSettings: "'wght' 200" }}
      >
        {service.icon || 'content_cut'}
      </span>

      <h3 className="mb-3 font-headline text-headline-md uppercase text-on-surface">{name}</h3>
      <p className="mb-4 font-body text-body-md text-on-surface-variant line-clamp-3">{description}</p>

      <div className="flex items-center gap-4 border-t border-outline-variant pt-4 font-label text-label-md text-on-surface-variant">
        <span className="flex items-center gap-1">
          <span className="material-symbols-outlined text-[16px]">schedule</span>
          {formatDuration(durationMinutes, t('common.min'))}
        </span>
        {selected && (
          <span className="flex items-center gap-1 text-primary">
            <span className="material-symbols-outlined text-[16px]">payments</span>
            {formatPriceCents(priceCents)}
          </span>
        )}
      </div>
    </>
  );

  if (selectable) {
    return (
      <motion.button type="button" onClick={() => onSelect?.(service)} whileTap={{ scale: 0.98 }} className={cardClassName}>
        {content}
      </motion.button>
    );
  }

  return <motion.div className={cardClassName}>{content}</motion.div>;
}
