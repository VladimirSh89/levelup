import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import type { MasterProfile } from '@/types';
import { cn, initials } from '@/lib/utils';

interface MasterCardProps {
  master: MasterProfile;
  selectable?: boolean;
  selected?: boolean;
  onSelect?: (master: MasterProfile) => void;
}

export default function MasterCard({ master, selectable, selected, onSelect }: MasterCardProps) {
  const { t } = useTranslation();

  const cardClassName = cn(
    'group relative flex w-full flex-col items-center border border-outline-variant bg-surface-container-high p-8 text-center transition-all duration-300 glow-hover cursor-pointer',
    selected && 'border-primary bg-surface-container-highest shadow-glow',
  );

  const content = (
    <>
      {selected && (
        <span className="absolute right-4 top-4 flex h-6 w-6 items-center justify-center bg-primary text-on-primary">
          <span className="material-symbols-outlined text-[16px]">check</span>
        </span>
      )}

      <div
        className={cn(
          'mb-5 flex h-24 w-24 items-center justify-center rounded-full border-2 bg-surface-container-highest font-headline text-headline-md text-on-surface',
          selected ? 'border-primary' : 'border-primary/70',
        )}
      >
        {master.photoUrl ? (
          <img src={master.photoUrl} alt={master.name} className="h-full w-full rounded-full object-cover" />
        ) : (
          <span>{initials(master.name)}</span>
        )}
      </div>

      <h3 className="font-headline text-headline-md uppercase text-on-surface">{master.name}</h3>

      {master.rating && (
        <div className="mt-1 flex items-center gap-1 text-primary">
          <span className="material-symbols-outlined text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>
            star
          </span>
          <span className="font-label text-label-md">{master.rating.toFixed(1)}</span>
        </div>
      )}

      {Array.isArray(master.specialtyTags) && master.specialtyTags.length > 0 && (
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {master.specialtyTags.map((tag: string) => (
            <span
              key={tag}
              className="border border-outline-variant px-2 py-1 font-label text-[10px] uppercase tracking-[0.1em] text-on-surface-variant"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {master.bio && <p className="mt-4 font-body text-body-md text-on-surface-variant line-clamp-3">{master.bio}</p>}

      {selectable && (
        <span className="mt-5 font-label text-label-caps uppercase text-primary">
          {selected ? t('master.selected') : t('master.select')}
        </span>
      )}
    </>
  );

  if (selectable) {
    return (
      <motion.button type="button" onClick={() => onSelect?.(master)} whileTap={{ scale: 0.98 }} className={cardClassName}>
        {content}
      </motion.button>
    );
  }

  return <motion.div className={cardClassName}>{content}</motion.div>;
}
