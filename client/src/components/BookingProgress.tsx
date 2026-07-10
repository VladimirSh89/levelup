import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

interface BookingProgressProps {
  currentStep: 1 | 2 | 3 | 4;
  totalSteps?: number;
}

const STEP_LABEL_KEYS = ['stepLabel1', 'stepLabel2', 'stepLabel3', 'stepLabel4'] as const;

export default function BookingProgress({ currentStep, totalSteps = 4 }: BookingProgressProps) {
  const { t } = useTranslation();
  const steps = Array.from({ length: totalSteps }, (_, i) => i + 1);

  return (
    <div className="w-full">
      <div className="mb-3 flex items-center justify-between">
        <span className="font-label text-label-caps uppercase text-on-surface-variant">
          {t('booking.stepOf', { current: currentStep, total: totalSteps })}
        </span>
        <span className="font-label text-label-caps uppercase text-primary">
          {t(`booking.${STEP_LABEL_KEYS[currentStep - 1]}`)}
        </span>
      </div>

      <div className="flex items-center gap-2">
        {steps.map((step) => {
          const isCompleted = step < currentStep;
          const isCurrent = step === currentStep;
          return (
            <div key={step} className="flex flex-1 items-center gap-2">
              <div
                className={cn(
                  'h-2 w-2 flex-none',
                  isCompleted && 'bg-primary',
                  isCurrent && 'bg-secondary-container animate-blink',
                  !isCompleted && !isCurrent && 'bg-surface-container-highest',
                )}
              />
              <div
                className={cn(
                  'h-[2px] flex-1',
                  isCompleted ? 'bg-primary' : 'bg-surface-container-highest',
                )}
              />
            </div>
          );
        })}
      </div>

      <div className="mt-2 hidden justify-between md:flex">
        {steps.map((step) => (
          <span
            key={step}
            className={cn(
              'font-label text-[10px] uppercase tracking-[0.1em]',
              step === currentStep
                ? 'text-secondary-container'
                : step < currentStep
                  ? 'text-primary'
                  : 'text-outline',
            )}
          >
            {t(`booking.${STEP_LABEL_KEYS[step - 1]}`)}
          </span>
        ))}
      </div>
    </div>
  );
}
