import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import Logo from '@/components/Logo';
import LanguageSwitch from '@/components/LanguageSwitch';
import Button from '@/components/Button';
import { useAuth } from '@/lib/auth';
import { roleHome } from '@/lib/api';

const NAV_LINKS = [
  { key: 'services', hash: '#services' },
  { key: 'barbers', hash: '#barbers' },
  { key: 'booking', hash: '#booking' },
  { key: 'locations', hash: '#locations' },
] as const;

export default function TopNav() {
  const { t } = useTranslation();
  const { user, isAuthenticated, logout } = useAuth();
  const location = useLocation();
  const isHome = location.pathname === '/';

  const accountLink = isAuthenticated && user ? roleHome(user.role) : '/login';
  const accountLabel = isAuthenticated
    ? user?.role === 'admin'
      ? t('nav.admin')
      : user?.role === 'master'
        ? t('nav.masterPanel')
        : t('nav.account')
    : t('nav.login');

  return (
    <header className="fixed top-0 left-0 right-0 z-50">
      {/* Mobile: compact liquid glass bar */}
      <div className="px-4 pt-[max(0.5rem,env(safe-area-inset-top))] md:hidden">
        <div className="liquid-glass flex h-14 items-center justify-between rounded-full px-3">
          <Link to="/" className="flex items-center gap-2">
            <Logo className="h-9 w-7" />
            <span className="font-headline text-[15px] font-bold tracking-tighter text-primary">
              {t('common.brand')}
            </span>
          </Link>
          <div className="flex items-center gap-1">
            <LanguageSwitch className="scale-90" />
            <Button as="link" to="/book" variant="primary" size="sm" className="!px-3 !py-1.5 text-[10px]">
              {t('nav.bookNow')}
            </Button>
          </div>
        </div>
      </div>

      {/* Desktop: solid header */}
      <div className="hidden border-b border-outline-variant bg-background/95 shadow-[0_0_15px_rgba(242,202,80,0.1)] backdrop-blur-md md:block">
        <div className="container-page flex h-20 items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <Logo className="h-12 w-9" />
            <span className="font-headline text-headline-lg font-bold tracking-tighter text-primary">
              {t('common.brand')}
            </span>
          </Link>

          <nav className="flex items-center gap-2">
            {NAV_LINKS.map((link) => (
              <a
                key={link.key}
                href={isHome ? link.hash : `/${link.hash}`}
                className="px-3 py-2 font-label text-label-caps uppercase text-on-surface-variant transition-all duration-300 hover:bg-primary/10 hover:text-primary"
              >
                {t(`nav.${link.key}`)}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-4">
            <LanguageSwitch className="border-r border-outline-variant pr-4 mr-2" />

            <Link
              to={accountLink}
              className="flex items-center gap-1 px-2 py-2 font-label text-label-caps uppercase text-primary transition-all duration-300 hover:bg-primary/10"
            >
              <span className="material-symbols-outlined text-[20px]">person</span>
              {accountLabel}
            </Link>

            {isAuthenticated && (
              <button
                type="button"
                onClick={logout}
                className="font-label text-label-caps uppercase text-on-surface-variant transition-colors hover:text-primary"
              >
                {t('common.logout')}
              </button>
            )}

            <Button as="link" to="/book" variant="primary" size="sm">
              {t('nav.bookNow')}
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
