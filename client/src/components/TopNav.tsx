import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion } from 'framer-motion';

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
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const isHome = location.pathname === '/';

  const handleAnchorClick = (hash: string) => {
    setMenuOpen(false);
    if (isHome) return;
    navigate(`/${hash}`);
  };

  const accountLink = isAuthenticated && user ? roleHome(user.role) : '/login';
  const accountLabel = isAuthenticated
    ? user?.role === 'admin'
      ? t('nav.admin')
      : user?.role === 'master'
        ? t('nav.masterPanel')
        : t('nav.account')
    : t('nav.login');

  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-outline-variant bg-background shadow-[0_0_15px_rgba(242,202,80,0.1)]">
      <div className="container-page flex h-20 items-center justify-between">
        <Link to="/" className="flex items-center gap-2" onClick={() => setMenuOpen(false)}>
          <Logo className="h-11 w-11" />
          <span className="hidden font-headline text-headline-lg font-bold tracking-tighter text-primary md:block">
            {t('common.brand')}
          </span>
        </Link>

        <nav className="hidden items-center gap-2 md:flex">
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
          <LanguageSwitch className="hidden border-r border-outline-variant pr-4 mr-2 md:flex" />

          <Link
            to={accountLink}
            className="hidden items-center gap-1 font-label text-label-caps uppercase text-primary transition-all duration-300 hover:bg-primary/10 md:flex px-2 py-2"
          >
            <span className="material-symbols-outlined text-[20px]">person</span>
            {accountLabel}
          </Link>

          {isAuthenticated && (
            <button
              type="button"
              onClick={logout}
              className="hidden font-label text-label-caps uppercase text-on-surface-variant transition-colors hover:text-primary md:flex"
            >
              {t('common.logout')}
            </button>
          )}

          <Button as="link" to="/book" variant="primary" size="sm" className="hidden md:inline-flex">
            {t('nav.bookNow')}
          </Button>

          <button
            type="button"
            aria-label={t('nav.menu')}
            className="flex items-center justify-center p-2 text-primary md:hidden"
            onClick={() => setMenuOpen((o) => !o)}
          >
            <span className="material-symbols-outlined text-[28px]">{menuOpen ? 'close' : 'menu'}</span>
          </button>
        </div>
      </div>

      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden border-t border-outline-variant bg-surface md:hidden"
          >
            <div className="flex flex-col px-margin-mobile py-6 gap-1">
              {NAV_LINKS.map((link) => (
                <a
                  key={link.key}
                  href={isHome ? link.hash : `/${link.hash}`}
                  onClick={() => handleAnchorClick(link.hash)}
                  className="py-3 font-label text-label-caps uppercase text-on-surface-variant border-b border-outline-variant/50"
                >
                  {t(`nav.${link.key}`)}
                </a>
              ))}
              <Link
                to={accountLink}
                onClick={() => setMenuOpen(false)}
                className="py-3 font-label text-label-caps uppercase text-primary border-b border-outline-variant/50"
              >
                {accountLabel}
              </Link>
              {isAuthenticated && (
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    logout();
                  }}
                  className="py-3 text-left font-label text-label-caps uppercase text-on-surface-variant border-b border-outline-variant/50"
                >
                  {t('common.logout')}
                </button>
              )}
              <div className="flex items-center justify-between pt-4">
                <LanguageSwitch />
                <Button as="link" to="/book" variant="primary" size="sm" onClick={() => setMenuOpen(false)}>
                  {t('nav.bookNow')}
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
