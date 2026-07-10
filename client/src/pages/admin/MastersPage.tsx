import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import Button from '@/components/Button';
import FormField from '@/components/FormField';
import { adminApi } from '@/lib/api';
import { FALLBACK_MASTERS } from '@/lib/mockData';
import { cn, initials } from '@/lib/utils';
import type { MasterProfile } from '@/types';

interface MasterFormState {
  id?: string;
  name: string;
  email: string;
  password: string;
  bio: string;
  photoUrl: string;
  tags: string;
  instagramHandle: string;
  isActive: boolean;
}

const emptyForm: MasterFormState = {
  name: '',
  email: '',
  password: '',
  bio: '',
  photoUrl: '',
  tags: '',
  instagramHandle: '',
  isActive: true,
};

export default function MastersPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<MasterFormState>(emptyForm);

  const { data } = useQuery({
    queryKey: ['admin', 'masters'],
    queryFn: async () => {
      try {
        return await adminApi.masters.list();
      } catch {
        return FALLBACK_MASTERS;
      }
    },
  });

  const masters = data ?? [];

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin', 'masters'] });

  const createMutation = useMutation({
    mutationFn: (payload: MasterFormState) =>
      adminApi.masters.create({
        name: payload.name,
        email: payload.email,
        password: payload.password,
        bio: payload.bio,
        photoUrl: payload.photoUrl || null,
        specialtyTags: payload.tags.split(',').map((s) => s.trim()).filter(Boolean),
        instagramHandle: payload.instagramHandle || null,
        isActive: payload.isActive,
      }),
    onSuccess: () => {
      invalidate();
      closeForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: (payload: MasterFormState) =>
      adminApi.masters.update(payload.id!, {
        name: payload.name,
        bio: payload.bio,
        photoUrl: payload.photoUrl || null,
        specialtyTags: payload.tags.split(',').map((s) => s.trim()).filter(Boolean),
        instagramHandle: payload.instagramHandle || null,
        isActive: payload.isActive,
      }),
    onSuccess: () => {
      invalidate();
      closeForm();
    },
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => adminApi.masters.remove(id),
    onSuccess: invalidate,
  });

  const openCreate = () => {
    setForm(emptyForm);
    setFormOpen(true);
  };

  const openEdit = (master: MasterProfile) => {
    setForm({
      id: master.id,
      name: master.name,
      email: '',
      password: '',
      bio: master.bio ?? '',
      photoUrl: master.photoUrl ?? '',
      tags: Array.isArray(master.specialtyTags) ? master.specialtyTags.join(', ') : '',
      instagramHandle: master.instagramHandle ?? '',
      isActive: master.isActive ?? true,
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
        <h1 className="font-headline text-headline-lg uppercase text-on-surface">{t('admin.masters.title')}</h1>
        <Button variant="primary" size="sm" onClick={openCreate}>
          {t('admin.masters.add')}
        </Button>
      </div>

      {masters.length === 0 && (
        <div className="border border-outline-variant bg-surface-container-low p-8 text-center font-body text-body-md text-on-surface-variant">
          {t('admin.masters.empty')}
        </div>
      )}

      <div className="grid grid-cols-1 gap-gutter md:grid-cols-2 lg:grid-cols-3">
        {masters.map((master) => (
          <div key={master.id} className="border border-outline-variant bg-surface-container-high p-6">
            <div className="mb-4 flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-primary/70 bg-surface-container-highest font-headline text-body-lg text-on-surface">
                {master.photoUrl ? (
                  <img src={master.photoUrl} alt={master.name} className="h-full w-full rounded-full object-cover" />
                ) : (
                  initials(master.name)
                )}
              </div>
              <div>
                <div className="font-headline text-headline-md uppercase text-on-surface">{master.name}</div>
                <span
                  className={cn(
                    'font-label text-[10px] uppercase',
                    master.isActive ? 'text-primary' : 'text-outline',
                  )}
                >
                  {master.isActive ? t('common.active') : t('common.inactive')}
                </span>
              </div>
            </div>

            {master.bio && <p className="mb-4 font-body text-[13px] text-on-surface-variant line-clamp-2">{master.bio}</p>}

            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => openEdit(master)}>
                {t('common.edit')}
              </Button>
              <Button variant="plain" size="sm" onClick={() => removeMutation.mutate(master.id)}>
                {t('common.delete')}
              </Button>
            </div>
          </div>
        ))}
      </div>

      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-lg border-t-2 border-primary bg-surface-container-high p-8 max-h-[90vh] overflow-y-auto">
            <h2 className="mb-6 font-headline text-headline-md uppercase text-on-surface">
              {form.id ? t('admin.masters.edit') : t('admin.masters.add')}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <FormField label={t('admin.masters.name')} name="name" value={form.name} onChange={(v) => setForm((f) => ({ ...f, name: v }))} required />

              {!form.id && (
                <>
                  <FormField label={t('auth.email')} name="email" type="email" value={form.email} onChange={(v) => setForm((f) => ({ ...f, email: v }))} required />
                  <FormField label={t('auth.password')} name="password" type="password" value={form.password} onChange={(v) => setForm((f) => ({ ...f, password: v }))} required />
                </>
              )}

              <FormField label={t('admin.masters.bio')} name="bio" value={form.bio} onChange={(v) => setForm((f) => ({ ...f, bio: v }))} />
              <FormField label={t('admin.masters.photo')} name="photoUrl" value={form.photoUrl} onChange={(v) => setForm((f) => ({ ...f, photoUrl: v }))} />
              <FormField label={t('admin.masters.tags')} name="tags" value={form.tags} onChange={(v) => setForm((f) => ({ ...f, tags: v }))} />
              <FormField label={t('admin.masters.instagram')} name="instagram" value={form.instagramHandle} onChange={(v) => setForm((f) => ({ ...f, instagramHandle: v }))} />

              <label className="flex items-center gap-3 font-label text-label-caps uppercase text-on-surface-variant">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                  className="h-4 w-4 accent-primary"
                />
                {t('admin.masters.status')}
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
