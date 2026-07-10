import { useTranslation } from 'react-i18next';
import Logo from '@/components/Logo';
import LanguageSwitch from '@/components/LanguageSwitch';

export default function Footer() {
  const { t } = useTranslation();
  const year = new Date().getFullYear();

  return (
    <footer className="w-full border-t-2 border-primary bg-surface-container-lowest py-16">
      <div className="container-page flex flex-col items-center gap-gutter md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col items-center gap-4 md:items-start">
          <div className="flex items-center gap-2">
            <Logo className="h-10 w-10" />
            <span className="font-headline text-headline-md uppercase text-primary">{t('common.brand')}</span>
          </div>
          <p className="font-body text-body-md text-on-surface-variant text-center md:text-left">
            {t('footer.copyright', { year })} {t('footer.tagline')}
          </p>
        </div>

        <nav className="flex flex-wrap justify-center gap-6 font-label text-label-caps uppercase">
          <a href="#" className="text-on-surface-variant transition-colors hover:text-primary">
            {t('footer.privacy')}
          </a>
          <a href="#" className="text-on-surface-variant transition-colors hover:text-primary">
            {t('footer.terms')}
          </a>
          <a href="#locations" className="text-on-surface-variant transition-colors hover:text-primary">
            {t('footer.hq')}
          </a>
          <a href="#" className="text-on-surface-variant transition-colors hover:text-primary">
            {t('footer.contact')}
          </a>
        </nav>

        <LanguageSwitch />
      </div>
    </footer>
  );
}
