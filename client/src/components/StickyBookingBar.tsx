import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import Button from '@/components/Button';
import { cn, formatDuration, formatPriceCents } from '@/lib/utils';

interface StickyBookingBarProps {
  totalPriceCents?: number;
  totalDurationMinutes?: number;
  onBack?: () => void;
  onHome?: () => void;
  onContinue?: () => void;
  continueLabel?: string;
  continueDisabled?: boolean;
  continueVariant?: 'primary' | 'urgent';
  continueLoading?: boolean;
  showBack?: boolean;
  children?: ReactNode;
}

export default function StickyBookingBar({
  totalPriceCents,
  totalDurationMinutes,
  onBack,
  onHome,
  onContinue,
  continueLabel,
  continueDisabled,
  continueVariant = 'primary',
  continueLoading,
  showBack = true,
  children,
}: StickyBookingBarProps) {
  const { t } = useTranslation();

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t-2 border-primary bg-surface-container-lowest/80 backdrop-blur-xl pb-[env(safe-area-inset-bottom)]">
      <div className="container-page flex items-center justify-between gap-3 py-3 md:gap-4 md:py-4">
        <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-4">
          {onHome && (
            <button
              type="button"
              onClick={onHome}
              aria-label={t('nav.home')}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary ring-1 ring-primary/40 transition-colors hover:bg-primary/25 md:hidden"
            >
              <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                home
              </span>
            </button>
          )}
          {showBack && onBack && (
            <button
              type="button"
              onClick={onBack}
              className="flex items-center gap-1 font-label text-label-caps uppercase text-on-surface-variant transition-colors hover:text-primary"
            >
              <span className="material-symbols-outlined text-[18px]">arrow_back</span>
              <span className="hidden sm:inline">{t('booking.backToStep')}</span>
            </button>
          )}

          {children ? (
            <div className="min-w-0 flex-1">{children}</div>
          ) : (
            typeof totalPriceCents === 'number' && (
              <div className="min-w-0 flex-1 truncate font-label text-label-md text-on-surface">
                <span className="text-primary">{formatPriceCents(totalPriceCents)}</span>
                {typeof totalDurationMinutes === 'number' && (
                  <span className="ml-2 text-on-surface-variant">
                    · {formatDuration(totalDurationMinutes, t('common.min'))}
                  </span>
                )}
              </div>
            )
          )}
        </div>

        <Button
          variant={continueVariant}
          size="md"
          onClick={onContinue}
          disabled={continueDisabled || continueLoading}
          className={cn('flex-none', continueVariant === 'urgent' && 'shadow-glow-red')}
        >
          {continueLoading ? t('booking.submitting') : continueLabel || t('booking.continueToStep')}
        </Button>
      </div>
    </div>
  );
}
