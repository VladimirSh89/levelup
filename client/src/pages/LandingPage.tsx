import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';

import Button from '@/components/Button';
import ServiceCard from '@/components/ServiceCard';
import MasterCard from '@/components/MasterCard';
import { servicesApi, mastersApi } from '@/lib/api';
import { FALLBACK_MASTERS, FALLBACK_SERVICES } from '@/lib/mockData';

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-80px' },
  transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] },
};

export default function LandingPage() {
  const { t } = useTranslation();

  const { data: services } = useQuery({
    queryKey: ['services'],
    queryFn: servicesApi.list,
  });

  const { data: masters } = useQuery({
    queryKey: ['masters'],
    queryFn: mastersApi.list,
  });

  const serviceList = (services && services.length > 0 ? services : FALLBACK_SERVICES).slice(0, 6);
  const masterList = (masters && masters.length > 0 ? masters : FALLBACK_MASTERS).slice(0, 3);

  return (
    <div>
      {/* HERO */}
      <section className="relative flex min-h-[calc(100vh-80px)] items-center overflow-hidden">
        <div className="absolute inset-0 z-0">
          <div
            className="h-full w-full bg-cover bg-center opacity-40 mix-blend-overlay"
            style={{
              backgroundImage:
                "url('https://images.unsplash.com/photo-1585747860715-2ba37e788b70?auto=format&fit=crop&w=1600&q=80')",
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-transparent" />
        </div>

        <div className="container-page relative z-10 py-24">
          <div className="max-w-4xl">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="mb-6 flex flex-wrap items-center gap-4"
            >
              <div className="flex text-primary">
                {Array.from({ length: 5 }).map((_, i) => (
                  <span key={i} className="material-symbols-fill">
                    star
                  </span>
                ))}
              </div>
              <span className="border-l border-outline-variant pl-4 font-label text-label-caps text-on-surface-variant">
                {t('home.est')}
              </span>
              <span className="hidden border-l border-outline-variant pl-4 font-label text-label-caps text-on-surface-variant md:inline-block">
                {t('home.city')}
              </span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.1 }}
              className="mb-6 font-headline text-display-lg-mobile uppercase leading-none text-on-background md:text-display-lg"
            >
              {t('home.heroTitleLine1')} <br className="hidden md:block" />
              <span className="bg-gradient-to-r from-primary to-primary-container bg-clip-text text-transparent">
                {t('home.heroTitleLine2')}
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.2 }}
              className="mb-10 max-w-2xl font-body text-body-lg text-on-surface-variant"
            >
              {t('home.heroSubtitle')}
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.3 }}
              className="flex flex-col gap-4 sm:flex-row"
            >
              <Button
                as="link"
                to="/book"
                variant="urgent"
                size="lg"
                className="group"
                icon={<span className="material-symbols-outlined transition-transform group-hover:translate-x-1">arrow_forward</span>}
              >
                {t('home.bookAppointment')}
              </Button>
              <Button as="a" href="#services" variant="ghost" size="lg">
                {t('home.viewServices')}
              </Button>
            </motion.div>
          </div>
        </div>
      </section>

      {/* SERVICES */}
      <section id="services" className="border-t border-outline-variant bg-surface py-section-gap">
        <div className="container-page">
          <motion.div {...fadeUp} className="mb-16 flex flex-col items-end justify-between gap-6 md:flex-row">
            <div>
              <span className="eyebrow mb-4">{t('home.servicesEyebrow')}</span>
              <h2 className="font-headline text-headline-lg uppercase text-on-surface">{t('home.servicesTitle')}</h2>
            </div>
            <Link
              to="/book"
              className="flex items-center gap-2 border-b border-primary/30 pb-2 font-label text-label-caps uppercase text-primary transition-colors hover:border-primary hover:text-primary-fixed"
            >
              {t('home.fullMenu')} <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
            </Link>
          </motion.div>

          <div className="grid grid-cols-1 gap-gutter md:grid-cols-3">
            {serviceList.map((service, i) => (
              <motion.div key={service.id} {...fadeUp} transition={{ ...fadeUp.transition, delay: i * 0.08 }}>
                <ServiceCard service={service} />
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* BARBERS */}
      <section id="barbers" className="border-t border-outline-variant bg-background py-section-gap">
        <div className="container-page">
          <motion.div {...fadeUp} className="mb-16 text-center">
            <span className="eyebrow mb-4">{t('home.barbersEyebrow')}</span>
            <h2 className="mb-4 font-headline text-headline-lg uppercase text-on-surface">{t('home.barbersTitle')}</h2>
            <p className="mx-auto max-w-xl font-body text-body-lg text-on-surface-variant">{t('home.barbersSubtitle')}</p>
          </motion.div>

          <div className="grid grid-cols-1 gap-gutter md:grid-cols-3">
            {masterList.map((master, i) => (
              <motion.div key={master.id} {...fadeUp} transition={{ ...fadeUp.transition, delay: i * 0.08 }}>
                <MasterCard master={master} />
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA BANNER */}
      <section id="booking" className="relative overflow-hidden border-t border-outline-variant bg-surface-container-lowest py-section-gap">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-secondary-container/5" />
        <div className="container-page relative z-10 text-center">
          <motion.div {...fadeUp}>
            <span className="eyebrow mb-4">{t('home.ctaEyebrow')}</span>
            <h2 className="mb-6 font-headline text-headline-lg uppercase text-on-surface">{t('home.ctaTitle')}</h2>
            <p className="mx-auto mb-10 max-w-xl font-body text-body-lg text-on-surface-variant">{t('home.ctaSubtitle')}</p>
            <Button as="link" to="/book" variant="urgent" size="lg">
              {t('home.ctaButton')}
            </Button>
          </motion.div>

          <motion.div
            {...fadeUp}
            className="mx-auto mt-20 grid max-w-3xl grid-cols-2 gap-8 border-t border-outline-variant pt-12 md:grid-cols-4"
          >
            {[
              ['4,200+', t('home.statsClients')],
              ['3', t('home.statsMasters')],
              ['8', t('home.statsYears')],
              ['5.0', t('home.statsRating')],
            ].map(([value, label]) => (
              <div key={label as string}>
                <div className="font-headline text-headline-lg text-primary">{value}</div>
                <div className="mt-1 font-label text-label-caps uppercase text-on-surface-variant">{label}</div>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* LOCATIONS */}
      <section id="locations" className="border-t border-outline-variant bg-surface py-section-gap">
        <div className="container-page grid grid-cols-1 gap-gutter md:grid-cols-2">
          <motion.div {...fadeUp}>
            <span className="eyebrow mb-4">{t('home.locationsEyebrow')}</span>
            <h2 className="mb-6 font-headline text-headline-lg uppercase text-on-surface">{t('home.locationsTitle')}</h2>
            <p className="mb-8 flex items-start gap-2 font-body text-body-lg text-on-surface-variant">
              <span className="material-symbols-outlined text-primary">location_on</span>
              {t('home.locationsAddress')}
            </p>

            <div className="mb-8 border border-outline-variant p-6">
              <h3 className="mb-4 font-label text-label-caps uppercase text-primary">{t('home.locationsHoursTitle')}</h3>
              <ul className="space-y-2 font-body text-body-md text-on-surface-variant">
                <li>{t('home.locationsHours1')}</li>
                <li>{t('home.locationsHours2')}</li>
                <li>{t('home.locationsHours3')}</li>
              </ul>
            </div>

            <Button as="a" href="https://maps.google.com" target="_blank" rel="noreferrer" variant="ghost">
              {t('home.locationsGetDirections')}
              <span className="material-symbols-outlined text-[18px]">north_east</span>
            </Button>
          </motion.div>

          <motion.div
            {...fadeUp}
            className="flex min-h-[320px] items-center justify-center border border-outline-variant bg-surface-container-high"
          >
            <span className="material-symbols-outlined text-6xl text-outline">map</span>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
