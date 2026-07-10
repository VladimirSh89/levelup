import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

interface LanguageSwitchProps {
  className?: string;
}

export default function LanguageSwitch({ className }: LanguageSwitchProps) {
  const { i18n } = useTranslation();
  const current = i18n.language?.startsWith('ru') ? 'ru' : 'en';

  const setLocale = (locale: 'en' | 'ru') => {
    i18n.changeLanguage(locale);
  };

  return (
    <div className={cn('flex items-center gap-2 font-label text-label-caps', className)}>
      <button
        type="button"
        onClick={() => setLocale('en')}
        aria-current={current === 'en'}
        className={cn(
          'cursor-pointer transition-colors',
          current === 'en' ? 'text-primary' : 'text-on-surface-variant hover:text-primary',
        )}
      >
        EN
      </button>
      <span className="text-outline">/</span>
      <button
        type="button"
        onClick={() => setLocale('ru')}
        aria-current={current === 'ru'}
        className={cn(
          'cursor-pointer transition-colors',
          current === 'ru' ? 'text-primary' : 'text-on-surface-variant hover:text-primary',
        )}
      >
        RU
      </button>
    </div>
  );
}
