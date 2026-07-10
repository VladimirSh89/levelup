import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import Button from '@/components/Button';
import FormField from '@/components/FormField';
import { adminApi } from '@/lib/api';
import { FALLBACK_SERVICES } from '@/lib/mockData';
import { cn, formatDuration, formatPriceCents } from '@/lib/utils';
import type { Service } from '@/types';

interface ServiceFormState {
  id?: string;
  nameEn: string;
  nameRu: string;
  descriptionEn: string;
  descriptionRu: string;
  price: string;
  duration: string;
  category: string;
  icon: string;
  isActive: boolean;
}

const emptyForm: ServiceFormState = {
  nameEn: '',
  nameRu: '',
  descriptionEn: '',
  descriptionRu: '',
  price: '',
  duration: '',
  category: 'hair',
  icon: 'content_cut',
  isActive: true,
};

export default function ServicesPage() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language?.startsWith('ru') ? 'ru' : 'en';
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<ServiceFormState>(emptyForm);

  const { data } = useQuery({
    queryKey: ['admin', 'services'],
    queryFn: async () => {
      try {
        return await adminApi.services.list();
      } catch {
        return FALLBACK_SERVICES;
      }
    },
  });

  const services = data ?? [];
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin', 'services'] });

  const toPayload = (payload: ServiceFormState): Partial<Service> => ({
    nameEn: payload.nameEn,
    nameRu: payload.nameRu,
    descriptionEn: payload.descriptionEn,
    descriptionRu: payload.descriptionRu,
    basePriceCents: Math.round(Number(payload.price) * 100),
    baseDurationMinutes: Number(payload.duration),
    category: payload.category,
    icon: payload.icon,
    isActive: payload.isActive,
  });

  const createMutation = useMutation({
    mutationFn: (payload: ServiceFormState) => adminApi.services.create(toPayload(payload)),
    onSuccess: () => {
      invalidate();
      closeForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: (payload: ServiceFormState) => adminApi.services.update(payload.id!, toPayload(payload)),
    onSuccess: () => {
      invalidate();
      closeForm();
    },
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => adminApi.services.remove(id),
    onSuccess: invalidate,
  });

  const openCreate = () => {
    setForm(emptyForm);
    setFormOpen(true);
  };

  const openEdit = (service: Service) => {
    setForm({
      id: service.id,
      nameEn: service.nameEn ?? service.name ?? '',
      nameRu: service.nameRu ?? service.name ?? '',
      descriptionEn: service.descriptionEn ?? service.description ?? '',
      descriptionRu: service.descriptionRu ?? service.description ?? '',
      price: (service.basePriceCents / 100).toString(),
      duration: service.baseDurationMinutes.toString(),
      category: service.category,
      icon: service.icon ?? '',
      isActive: service.isActive ?? true,
    });
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setForm(emptyForm);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (form.id) updateMutation.mutate(form);
    else createMutation.mutate(form);
  };

  const saving = createMutation.isPending || updateMutation.isPending;

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <h1 className="font-headline text-headline-lg uppercase text-on-surface">{t('admin.services.title')}</h1>
        <Button variant="primary" size="sm" onClick={openCreate}>
          {t('admin.services.add')}
        </Button>
      </div>

      {services.length === 0 && (
        <div className="border border-outline-variant bg-surface-container-low p-8 text-center font-body text-body-md text-on-surface-variant">
          {t('admin.services.empty')}
        </div>
      )}

      <div className="overflow-x-auto border border-outline-variant">
        <table className="w-full text-left">
          <thead className="bg-surface-container-lowest">
            <tr className="font-label text-label-caps uppercase text-on-surface-variant">
              <th className="px-4 py-3">{t('admin.services.nameEn')}</th>
              <th className="px-4 py-3">{t('admin.services.price')}</th>
              <th className="px-4 py-3">{t('admin.services.duration')}</th>
              <th className="px-4 py-3">{t('admin.services.status')}</th>
              <th className="px-4 py-3">{t('admin.bookings.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {services.map((service) => (
              <tr key={service.id} className="border-t border-outline-variant font-body text-body-md text-on-surface">
                <td className="px-4 py-3">{locale === 'ru' ? service.nameRu : service.nameEn}</td>
                <td className="px-4 py-3 font-label text-primary">{formatPriceCents(service.basePriceCents)}</td>
                <td className="px-4 py-3">{formatDuration(service.baseDurationMinutes, t('common.min'))}</td>
                <td className="px-4 py-3">
                  <span className={cn('font-label text-[10px] uppercase', service.isActive ? 'text-primary' : 'text-outline')}>
                    {service.isActive ? t('common.active') : t('common.inactive')}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-3">
                    <button type="button" onClick={() => openEdit(service)} className="text-primary hover:underline">
                      {t('common.edit')}
                    </button>
                    <button
                      type="button"
                      onClick={() => removeMutation.mutate(service.id)}
                      className="text-error hover:underline"
                    >
                      {t('common.delete')}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-lg border-t-2 border-primary bg-surface-container-high p-8 max-h-[90vh] overflow-y-auto">
            <h2 className="mb-6 font-headline text-headline-md uppercase text-on-surface">
              {form.id ? t('admin.services.edit') : t('admin.services.add')}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <FormField label={t('admin.services.nameEn')} name="nameEn" value={form.nameEn} onChange={(v) => setForm((f) => ({ ...f, nameEn: v }))} required />
              <FormField label={t('admin.services.nameRu')} name="nameRu" value={form.nameRu} onChange={(v) => setForm((f) => ({ ...f, nameRu: v }))} required />
              <FormField label={t('admin.services.descEn')} name="descriptionEn" value={form.descriptionEn} onChange={(v) => setForm((f) => ({ ...f, descriptionEn: v }))} />
              <FormField label={t('admin.services.descRu')} name="descriptionRu" value={form.descriptionRu} onChange={(v) => setForm((f) => ({ ...f, descriptionRu: v }))} />

              <div className="grid grid-cols-2 gap-4">
                <FormField label={t('admin.services.price')} name="price" type="number" value={form.price} onChange={(v) => setForm((f) => ({ ...f, price: v }))} required />
                <FormField label={t('admin.services.duration')} name="duration" type="number" value={form.duration} onChange={(v) => setForm((f) => ({ ...f, duration: v }))} required />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField label={t('admin.services.category')} name="category" value={form.category} onChange={(v) => setForm((f) => ({ ...f, category: v }))} />
                <FormField label={t('admin.services.icon')} name="icon" value={form.icon} onChange={(v) => setForm((f) => ({ ...f, icon: v }))} />
              </div>

              <label className="flex items-center gap-3 font-label text-label-caps uppercase text-on-surface-variant">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                  className="h-4 w-4 accent-primary"
                />
                {t('admin.services.status')}
              </label>

              <div className="flex gap-3 pt-4">
                <Button type="submit" variant="primary" disabled={saving}>
                  {saving ? '…' : t('common.save')}
                </Button>
                <Button type="button" variant="ghost" onClick={closeForm}>
                  {t('common.cancel')}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
