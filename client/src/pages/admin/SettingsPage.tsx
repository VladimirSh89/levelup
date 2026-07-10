import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery } from '@tanstack/react-query';

import Button from '@/components/Button';
import FormField from '@/components/FormField';
import { adminApi } from '@/lib/api';
import type { ShopSettings } from '@/types';

const FALLBACK_SETTINGS: ShopSettings = {
  id: 'settings-default',
  businessName: 'Level Up Barbershop',
  address: '4820 Vine Street, Cincinnati, OH 45217',
  timezone: 'America/New_York',
  cancellationCutoffHours: 24,
  contactPhone: '+1 (513) 555-0142',
  contactEmail: 'hello@levelupbarbershop.com',
  defaultLocale: 'en',
};

export default function SettingsPage() {
  const { t } = useTranslation();
  const [form, setForm] = useState<ShopSettings>(FALLBACK_SETTINGS);
  const [saved, setSaved] = useState(false);

  const { data } = useQuery({
    queryKey: ['admin', 'settings'],
    queryFn: async () => {
      try {
        return await adminApi.settings.get();
      } catch {
        return FALLBACK_SETTINGS;
      }
    },
  });

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: (payload: ShopSettings) => adminApi.settings.update(payload),
    onSuccess: () => {
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2500);
    },
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    saveMutation.mutate(form);
  };

  return (
    <div>
      <h1 className="mb-8 font-headline text-headline-lg uppercase text-on-surface">{t('admin.settings.title')}</h1>

      <form onSubmit={handleSubmit} className="max-w-xl space-y-5 border-t-2 border-primary bg-surface-container-high p-8">
        <FormField
          label={t('admin.settings.businessName')}
          name="businessName"
          value={form.businessName}
          onChange={(v) => setForm((f) => ({ ...f, businessName: v }))}
          required
        />
        <FormField
          label={t('admin.settings.address')}
          name="address"
          value={form.address}
          onChange={(v) => setForm((f) => ({ ...f, address: v }))}
          required
        />
        <FormField
          label={t('admin.settings.timezone')}
          name="timezone"
          value={form.timezone}
          onChange={(v) => setForm((f) => ({ ...f, timezone: v }))}
        />
        <FormField
          label={t('admin.settings.cancellationCutoff')}
          name="cancellationCutoffHours"
          type="number"
          value={String(form.cancellationCutoffHours)}
          onChange={(v) => setForm((f) => ({ ...f, cancellationCutoffHours: Number(v) }))}
        />
        <FormField
          label={t('admin.settings.contactPhone')}
          name="contactPhone"
          value={form.contactPhone ?? ''}
          onChange={(v) => setForm((f) => ({ ...f, contactPhone: v }))}
        />
        <FormField
          label={t('admin.settings.contactEmail')}
          name="contactEmail"
          type="email"
          value={form.contactEmail ?? ''}
          onChange={(v) => setForm((f) => ({ ...f, contactEmail: v }))}
        />

        <label className="block">
          <span className="mb-2 block font-label text-label-caps uppercase text-on-surface-variant">
            {t('admin.settings.defaultLocale')}
          </span>
          <select
            value={form.defaultLocale}
            onChange={(e) => setForm((f) => ({ ...f, defaultLocale: e.target.value as 'en' | 'ru' }))}
            className="w-full border border-outline-variant bg-surface-container-low px-4 py-3 font-body text-body-md text-on-surface outline-none focus:border-primary"
          >
            <option value="en">EN</option>
            <option value="ru">RU</option>
          </select>
        </label>

        <div className="flex items-center gap-4 pt-2">
          <Button type="submit" variant="primary" disabled={saveMutation.isPending}>
            {saveMutation.isPending ? '…' : t('common.save')}
          </Button>
          {saved && <span className="font-body text-[13px] text-primary">{t('admin.settings.saved')}</span>}
        </div>
      </form>
    </div>
  );
}
