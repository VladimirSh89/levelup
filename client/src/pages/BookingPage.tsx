import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useMutation, useQuery } from '@tanstack/react-query';

import Button from '@/components/Button';
import MasterCard from '@/components/MasterCard';
import ServiceCard from '@/components/ServiceCard';
import BookingProgress from '@/components/BookingProgress';
import StickyBookingBar from '@/components/StickyBookingBar';
import { bookingsApi, mastersApi, servicesApi, ApiRequestError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { clearDraft, setDraft, useBookingDraft } from '@/lib/bookingStore';
import { FALLBACK_MASTERS, FALLBACK_SERVICES } from '@/lib/mockData';
import {
  addDays,
  formatDateISO,
  formatDateLabel,
  formatDuration,
  formatPriceCents,
  formatTimeLabel,
} from '@/lib/utils';
import type { MasterProfile, Service } from '@/types';

const CANCELLATION_HOURS = 24;

export default function BookingPage() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language?.startsWith('ru') ? 'ru' : 'en';
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated } = useAuth();
  const draft = useBookingDraft();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [draft.step]);

  useEffect(() => {
    if (location.state && (location.state as { from?: string }).from === '/book' && isAuthenticated) {
      setDraft({ step: 4 });
    }
  }, [location.state, isAuthenticated]);

  const { data: mastersData } = useQuery({ queryKey: ['masters'], queryFn: mastersApi.list });
  const masters = mastersData && mastersData.length > 0 ? mastersData : FALLBACK_MASTERS;

  const resolvedMasterId = useMemo(() => {
    if (!draft.masterId || draft.masterId === 'any') return masters[0]?.id ?? null;
    return draft.masterId;
  }, [draft.masterId, masters]);

  const { data: catalogServices } = useQuery({ queryKey: ['services'], queryFn: servicesApi.list });
  const { data: masterServices } = useQuery({
    queryKey: ['master-services', resolvedMasterId],
    queryFn: () => mastersApi.services(resolvedMasterId!),
    enabled: Boolean(resolvedMasterId) && draft.step >= 2,
  });

  const availableServices =
    masterServices && masterServices.length > 0
      ? masterServices
      : catalogServices && catalogServices.length > 0
        ? catalogServices
        : FALLBACK_SERVICES;

  const selectedMaster = useMemo<MasterProfile | null>(() => {
    if (!draft.masterId || draft.masterId === 'any') return null;
    return masters.find((m) => m.id === draft.masterId) ?? null;
  }, [draft.masterId, masters]);

  const selectedServices = useMemo<Service[]>(
    () => availableServices.filter((s) => draft.serviceIds.includes(s.id)),
    [availableServices, draft.serviceIds],
  );

  const totalPriceCents = selectedServices.reduce(
    (sum, s) => sum + (s.priceCents ?? s.basePriceCents),
    0,
  );
  const totalDurationMinutes = selectedServices.reduce(
    (sum, s) => sum + (s.durationMinutes ?? s.baseDurationMinutes),
    0,
  );

  const month = draft.date?.slice(0, 7) ?? formatDateISO(new Date()).slice(0, 7);

  const { data: bookableDays } = useQuery({
    queryKey: ['bookable-days', resolvedMasterId, month],
    queryFn: () => mastersApi.bookableDays(resolvedMasterId!, month),
    enabled: draft.step === 3 && Boolean(resolvedMasterId),
  });

  const dateOptions = useMemo(() => {
    const fallback = Array.from({ length: 14 }, (_, i) => formatDateISO(addDays(new Date(), i)));
    if (bookableDays && bookableDays.length > 0) return bookableDays;
    return fallback;
  }, [bookableDays]);

  const { data: slotIsos, isLoading: slotsLoading } = useQuery({
    queryKey: ['slots', resolvedMasterId, draft.date, draft.serviceIds.join(',')],
    queryFn: async () => {
      if (!draft.date || !resolvedMasterId || draft.serviceIds.length === 0) return [];
      try {
        return await mastersApi.slots(resolvedMasterId, draft.date, draft.serviceIds);
      } catch {
        return [];
      }
    },
    enabled: draft.step === 3 && Boolean(draft.date && resolvedMasterId && draft.serviceIds.length),
  });

  const createBooking = useMutation({
    mutationFn: () => {
      if (!resolvedMasterId || !draft.startAt) throw new Error('Missing booking data');
      return bookingsApi.create({
        masterId: resolvedMasterId,
        serviceIds: draft.serviceIds,
        startAt: draft.startAt,
      });
    },
    onSuccess: () => {
      clearDraft();
      setSuccess(true);
    },
    onError: (err) => {
      setSubmitError(err instanceof ApiRequestError ? err.message : t('booking.errorSubmit'));
    },
  });

  const goToStep = (step: 1 | 2 | 3 | 4) => setDraft({ step });

  const canContinueFrom = {
    1: Boolean(draft.masterId),
    2: draft.serviceIds.length > 0,
    3: Boolean(draft.date && draft.startAt),
    4: true,
  } as const;

  const handleContinue = () => {
    if (draft.step < 4) {
      goToStep((draft.step + 1) as 1 | 2 | 3 | 4);
      return;
    }
    handleConfirm();
  };

  const handleConfirm = () => {
    if (!isAuthenticated) {
      navigate('/login', { state: { from: '/book' } });
      return;
    }
    setSubmitError(null);
    createBooking.mutate();
  };

  const handleBack = () => {
    if (draft.step === 1) return;
    goToStep((draft.step - 1) as 1 | 2 | 3 | 4);
  };

  if (success) {
    return (
      <div className="container-page flex min-h-[60vh] flex-col items-center justify-center py-section-gap text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
        >
          <span className="material-symbols-outlined mb-6 inline-block text-6xl text-primary">task_alt</span>
          <h1 className="mb-3 font-headline text-headline-lg uppercase text-on-surface">{t('booking.successTitle')}</h1>
          <p className="mb-10 font-body text-body-lg text-on-surface-variant">{t('booking.successSubtitle')}</p>
          <div className="flex flex-col justify-center gap-4 sm:flex-row">
            <Button as="link" to="/account" variant="primary">
              {t('booking.successViewAccount')}
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setSuccess(false);
                goToStep(1);
              }}
            >
              {t('booking.successBookAnother')}
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div>
      <div className="container-page py-10">
        <span className="eyebrow mb-3">{t('booking.subtitle')}</span>
        <h1 className="mb-8 font-headline text-headline-lg uppercase text-on-surface">{t('booking.title')}</h1>
        <BookingProgress currentStep={draft.step} />
      </div>

      <div className="container-page pb-10">
        {draft.step === 1 && (
          <StepMasters
            masters={masters}
            selectedId={draft.masterId}
            onSelect={(id) =>
              setDraft({ masterId: id, serviceIds: [], date: null, startAt: null, time: null })
            }
          />
        )}

        {draft.step === 2 && (
          <StepServices
            services={availableServices}
            selectedIds={draft.serviceIds}
            onToggle={(id) =>
              setDraft((d) => ({
                serviceIds: d.serviceIds.includes(id)
                  ? d.serviceIds.filter((s) => s !== id)
                  : [...d.serviceIds, id],
                date: null,
                startAt: null,
                time: null,
              }))
            }
          />
        )}

        {draft.step === 3 && (
          <StepDateTime
            dateOptions={dateOptions}
            selectedDate={draft.date}
            selectedStartAt={draft.startAt}
            slots={slotIsos ?? []}
            loading={slotsLoading}
            onSelectDate={(date) => setDraft({ date, startAt: null, time: null })}
            onSelectSlot={(startAt) => setDraft({ startAt, time: formatTimeLabel(startAt, locale) })}
            locale={locale}
          />
        )}

        {draft.step === 4 && (
          <StepConfirm
            master={selectedMaster}
            services={selectedServices}
            startAt={draft.startAt}
            totalPriceCents={totalPriceCents}
            totalDurationMinutes={totalDurationMinutes}
            isAuthenticated={isAuthenticated}
            submitError={submitError}
            locale={locale}
          />
        )}
      </div>

      <StickyBookingBar
        showBack={draft.step > 1}
        onBack={handleBack}
        onContinue={handleContinue}
        continueDisabled={!canContinueFrom[draft.step]}
        continueLoading={draft.step === 4 && createBooking.isPending}
        continueVariant={draft.step === 4 ? 'urgent' : 'primary'}
        continueLabel={
          draft.step === 4
            ? isAuthenticated
              ? t('booking.confirmButton')
              : t('booking.confirmButtonAuth')
            : t('booking.continueToStep')
        }
        totalPriceCents={draft.step >= 2 ? totalPriceCents : undefined}
        totalDurationMinutes={draft.step >= 2 ? totalDurationMinutes : undefined}
      />
    </div>
  );
}

function StepMasters({
  masters,
  selectedId,
  onSelect,
}: {
  masters: MasterProfile[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <div>
      <h2 className="mb-6 font-headline text-headline-md uppercase text-on-surface">{t('booking.step1Title')}</h2>
      <div className="grid grid-cols-1 gap-gutter md:grid-cols-3">
        <button
          type="button"
          onClick={() => onSelect('any')}
          className={`flex flex-col items-center justify-center gap-4 border p-8 text-center transition-all duration-300 glow-hover ${
            selectedId === 'any'
              ? 'border-primary bg-surface-container-highest shadow-glow'
              : 'border-outline-variant bg-surface-container-high'
          }`}
        >
          <span className="material-symbols-outlined text-4xl text-primary">shuffle</span>
          <div>
            <h3 className="font-headline text-headline-md uppercase text-on-surface">{t('master.any')}</h3>
            <p className="mt-1 font-body text-body-md text-on-surface-variant">{t('master.anyDesc')}</p>
          </div>
        </button>

        {masters.map((master) => (
          <MasterCard
            key={master.id}
            master={master}
            selectable
            selected={selectedId === master.id}
            onSelect={(m) => onSelect(m.id)}
          />
        ))}
      </div>
    </div>
  );
}

function StepServices({
  services,
  selectedIds,
  onToggle,
}: {
  services: Service[];
  selectedIds: string[];
  onToggle: (id: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <div>
      <h2 className="mb-2 font-headline text-headline-md uppercase text-on-surface">{t('booking.step2Title')}</h2>
      <p className="mb-6 font-body text-body-md text-on-surface-variant">{t('booking.selectServicesPrompt')}</p>
      <div className="grid grid-cols-1 gap-gutter md:grid-cols-3">
        {services.map((service) => (
          <ServiceCard
            key={service.id}
            service={service}
            selectable
            selected={selectedIds.includes(service.id)}
            onSelect={(s) => onToggle(s.id)}
          />
        ))}
      </div>
    </div>
  );
}

function StepDateTime({
  dateOptions,
  selectedDate,
  selectedStartAt,
  slots,
  loading,
  onSelectDate,
  onSelectSlot,
  locale,
}: {
  dateOptions: string[];
  selectedDate: string | null;
  selectedStartAt: string | null;
  slots: string[];
  loading: boolean;
  onSelectDate: (date: string) => void;
  onSelectSlot: (startAt: string) => void;
  locale: string;
}) {
  const { t } = useTranslation();
  return (
    <div>
      <h2 className="mb-6 font-headline text-headline-md uppercase text-on-surface">{t('booking.step3Title')}</h2>

      <div className="mb-8">
        <span className="mb-3 block font-label text-label-caps uppercase text-on-surface-variant">
          {t('booking.chooseDate')}
        </span>
        <div className="flex gap-2 overflow-x-auto pb-2">
          {dateOptions.map((date) => (
            <button
              key={date}
              type="button"
              onClick={() => onSelectDate(date)}
              className={`flex-none border px-4 py-3 text-center font-label text-label-md transition-all duration-300 ${
                selectedDate === date
                  ? 'border-primary bg-primary text-on-primary'
                  : 'border-outline-variant bg-surface-container-high text-on-surface-variant hover:border-primary/50'
              }`}
            >
              {formatDateLabel(date, locale)}
            </button>
          ))}
        </div>
      </div>

      <div>
        <span className="mb-3 block font-label text-label-caps uppercase text-on-surface-variant">
          {t('booking.chooseTime')}
        </span>

        {!selectedDate && (
          <p className="font-body text-body-md text-on-surface-variant">{t('booking.chooseDate')}</p>
        )}

        {selectedDate && loading && (
          <p className="font-body text-body-md text-on-surface-variant">{t('booking.loadingSlots')}</p>
        )}

        {selectedDate && !loading && slots.length === 0 && (
          <p className="font-body text-body-md text-on-surface-variant">{t('booking.noSlots')}</p>
        )}

        {selectedDate && !loading && slots.length > 0 && (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
            {slots.map((startAt) => (
              <button
                key={startAt}
                type="button"
                onClick={() => onSelectSlot(startAt)}
                className={`border px-2 py-3 text-center font-label text-label-md transition-all duration-300 ${
                  selectedStartAt === startAt
                    ? 'border-primary bg-primary text-on-primary'
                    : 'border-outline-variant bg-surface-container-high text-on-surface-variant hover:border-primary/50'
                }`}
              >
                {formatTimeLabel(startAt, locale)}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StepConfirm({
  master,
  services,
  startAt,
  totalPriceCents,
  totalDurationMinutes,
  isAuthenticated,
  submitError,
  locale,
}: {
  master: MasterProfile | null;
  services: Service[];
  startAt: string | null;
  totalPriceCents: number;
  totalDurationMinutes: number;
  isAuthenticated: boolean;
  submitError: string | null;
  locale: string;
}) {
  const { t } = useTranslation();

  return (
    <div className="mx-auto max-w-2xl">
      <h2 className="mb-6 font-headline text-headline-md uppercase text-on-surface">{t('booking.step4Title')}</h2>

      <div className="border-t-2 border-secondary-container bg-surface-container-high p-8">
        <span className="mb-6 block font-label text-label-caps uppercase text-primary">{t('booking.summaryTitle')}</span>

        <dl className="space-y-4">
          <div className="flex items-start justify-between gap-4 border-b border-outline-variant pb-4">
            <dt className="font-label text-label-caps uppercase text-on-surface-variant">{t('booking.summaryMaster')}</dt>
            <dd className="text-right font-body text-body-md text-on-surface">
              {master ? master.name : t('master.any')}
            </dd>
          </div>

          <div className="flex items-start justify-between gap-4 border-b border-outline-variant pb-4">
            <dt className="font-label text-label-caps uppercase text-on-surface-variant">{t('booking.summaryServices')}</dt>
            <dd className="text-right font-body text-body-md text-on-surface">
              {services.map((s) => (
                <div key={s.id}>{s.name || (locale === 'ru' ? s.nameRu : s.nameEn)}</div>
              ))}
            </dd>
          </div>

          <div className="flex items-start justify-between gap-4 border-b border-outline-variant pb-4">
            <dt className="font-label text-label-caps uppercase text-on-surface-variant">{t('booking.summaryDateTime')}</dt>
            <dd className="text-right font-body text-body-md text-on-surface">
              {startAt
                ? new Date(startAt).toLocaleString(locale === 'ru' ? 'ru-RU' : 'en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                  })
                : '—'}
            </dd>
          </div>

          <div className="flex items-start justify-between gap-4 border-b border-outline-variant pb-4">
            <dt className="font-label text-label-caps uppercase text-on-surface-variant">{t('booking.totalDuration')}</dt>
            <dd className="text-right font-body text-body-md text-on-surface">
              {formatDuration(totalDurationMinutes, t('common.min'))}
            </dd>
          </div>

          <div className="flex items-start justify-between gap-4">
            <dt className="font-label text-label-caps uppercase text-primary">{t('booking.summaryTotal')}</dt>
            <dd className="text-right font-label text-headline-md text-primary">
              {formatPriceCents(totalPriceCents)}
            </dd>
          </div>
        </dl>

        <p className="mt-6 font-body text-[13px] text-on-surface-variant">
          {t('booking.cancellationNotice', { hours: CANCELLATION_HOURS })}
        </p>
      </div>

      {!isAuthenticated && (
        <div className="mt-6 flex items-center gap-3 border border-outline-variant bg-surface-container-low p-4">
          <span className="material-symbols-outlined text-primary">info</span>
          <p className="font-body text-body-md text-on-surface-variant">
            {t('booking.loginPrompt')}{' '}
            <Link to="/register" state={{ from: '/book' }} className="text-primary underline">
              {t('auth.signUp')}
            </Link>
          </p>
        </div>
      )}

      {submitError && (
        <div className="mt-6 border border-error-container bg-error-container/20 p-4 font-body text-body-md text-error">
          {submitError}
        </div>
      )}
    </div>
  );
}
