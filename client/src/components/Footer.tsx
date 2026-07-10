import { useTranslation } from 'react-i18next';
import Logo from '@/components/Logo';
import LanguageSwitch from '@/components/LanguageSwitch';

export default function Footer() {
  const { t } = useTranslation();
  const year = new Date().getFullYear();

  const links = [
    { href: '#locations', label: t('footer.hq') },
    { href: 'tel:+15136683522', label: t('footer.contact') },
    { href: '#', label: t('footer.privacy') },
    { href: '#', label: t('footer.terms') },
  ] as const;

  return (
    <footer className="w-full border-t-2 border-primary bg-surface-container-lowest py-16 pb-32 md:pb-16">
      <div className="container-page flex flex-col gap-10 md:flex-row md:items-start md:justify-between">
        <div className="flex flex-col items-center gap-4 md:items-start">
          <div className="flex items-center gap-2">
            <Logo className="h-12 w-9" />
            <span className="font-headline text-headline-md uppercase text-primary">{t('common.brand')}</span>
          </div>
          <p className="max-w-md font-body text-body-md text-on-surface-variant text-center md:text-left">
            {t('footer.copyright', { year })} {t('footer.tagline')}
          </p>
          <div className="space-y-2 font-body text-body-md text-on-surface-variant text-center md:text-left">
            <p>
              <a href="tel:+15136683522" className="transition-colors hover:text-primary">
                {t('footer.phone')}
              </a>
            </p>
            <p>
              <a
                href="https://instagram.com/shaxa__24"
                target="_blank"
                rel="noreferrer"
                className="transition-colors hover:text-primary"
              >
                {t('footer.instagram')}
              </a>
            </p>
            <p className="max-w-xs">{t('footer.address')}</p>
          </div>
        </div>

        <div className="flex flex-col items-center gap-6 md:items-end">
          <LanguageSwitch />
          <nav className="grid w-full max-w-md grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2 md:w-auto md:justify-items-end">
            {links.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="text-center font-label text-label-caps uppercase text-on-surface-variant transition-colors hover:text-primary sm:text-left md:text-right"
              >
                {link.label}
              </a>
            ))}
          </nav>
        </div>
      </div>
    </footer>
  );
}
