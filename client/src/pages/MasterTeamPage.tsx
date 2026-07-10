import { useState, type FormEvent } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import Button from '@/components/Button';
import FormField from '@/components/FormField';
import MasterAvailabilityEditor from '@/components/MasterAvailabilityEditor';
import PhotoUpload from '@/components/PhotoUpload';
import ServiceMultiSelect from '@/components/ServiceMultiSelect';
import { masterPanelApi } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { cn, initials } from '@/lib/utils';
import type { MasterProfile } from '@/types';

interface MasterFormState {
  id?: string;
  name: string;
  email: string;
  password: string;
  bio: string;
  photoUrl: string;
  serviceIds: string[];
  instagramHandle: string;
  isActive: boolean;
}

const emptyForm: MasterFormState = {
  name: '',
  email: '',
  password: '',
  bio: '',
  photoUrl: '',
  serviceIds: [],
  instagramHandle: '',
  isActive: true,
};

export default function MasterTeamPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<MasterFormState>(emptyForm);

  if (!user?.isOwner) {
    return <Navigate to="/master" replace />;
  }

  const { data: masters = [] } = useQuery({
    queryKey: ['master', 'team'],
    queryFn: () => masterPanelApi.team.list(),
  });

  const { data: services = [] } = useQuery({
    queryKey: ['master', 'team-services'],
    queryFn: () => masterPanelApi.team.services(),
  });

  const activeServices = services.filter((s) => s.isActive !== false);
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['master', 'team'] });

  const createMutation = useMutation({
    mutationFn: (payload: MasterFormState) =>
      masterPanelApi.team.create({
        name: payload.name,
        email: payload.email,
        password: payload.password,
        bio: payload.bio,
        photoUrl: payload.photoUrl || null,
        serviceIds: payload.serviceIds,
        instagramHandle: payload.instagramHandle || null,
      }),
    onSuccess: () => {
      invalidate();
      closeForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: (payload: MasterFormState) =>
      masterPanelApi.team.update(payload.id!, {
        name: payload.name,
        bio: payload.bio,
        photoUrl: payload.photoUrl || null,
        serviceIds: payload.serviceIds,
        instagramHandle: payload.instagramHandle || null,
        isActive: payload.isActive,
      }),
    onSuccess: () => {
      invalidate();
      closeForm();
    },
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => masterPanelApi.team.remove(id),
    onSuccess: invalidate,
  });

  const handleDelete = (master: MasterProfile) => {
    if (master.isOwner) {
      window.alert(t('masterPanel.teamCannotDeleteOwner'));
      return;
    }
    if (!window.confirm(t('masterPanel.teamDeleteConfirm', { name: master.name }))) return;
    removeMutation.mutate(master.id);
  };

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
      serviceIds: master.serviceIds ?? [],
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
    <div className="container-page py-section-gap">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link to="/master" className="mb-2 inline-flex items-center gap-1 font-label text-[11px] uppercase text-primary">
            <span className="material-symbols-outlined text-[16px]">arrow_back</span>
            {t('masterPanel.title')}
          </Link>
          <h1 className="font-headline text-headline-lg uppercase text-on-surface">{t('masterPanel.teamTitle')}</h1>
          <p className="mt-2 font-body text-[13px] text-on-surface-variant">{t('masterPanel.teamHint')}</p>
        </div>
        <Button variant="primary" size="sm" onClick={openCreate}>
          {t('masterPanel.teamAdd')}
        </Button>
      </div>

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
                  {master.isOwner ? t('masterPanel.teamOwner') : master.isActive ? t('common.active') : t('common.inactive')}
                </span>
              </div>
            </div>

            {master.bio && <p className="mb-4 font-body text-[13px] text-on-surface-variant line-clamp-2">{master.bio}</p>}

            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => openEdit(master)}>
                {t('common.edit')}
              </Button>
              {!master.isOwner && (
                <Button
                  variant="plain"
                  size="sm"
                  className="text-error hover:text-error"
                  disabled={removeMutation.isPending}
                  onClick={() => handleDelete(master)}
                >
                  {t('common.delete')}
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>

      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-xl border-t-2 border-primary bg-surface-container-high p-8 max-h-[90vh] overflow-y-auto">
            <h2 className="mb-6 font-headline text-headline-md uppercase text-on-surface">
              {form.id ? t('admin.masters.edit') : t('masterPanel.teamAdd')}
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
              <PhotoUpload
                value={form.photoUrl}
                nameHint={form.name}
                onChange={(photoUrl) => setForm((f) => ({ ...f, photoUrl }))}
              />
              <ServiceMultiSelect
                label={t('admin.masters.services')}
                services={activeServices}
                selectedIds={form.serviceIds}
                onChange={(serviceIds) => setForm((f) => ({ ...f, serviceIds }))}
              />

              {form.id && (
                <div className="border border-outline-variant bg-surface-container-low p-4">
                  <MasterAvailabilityEditor
                    compact
                    queryKey={`team-${form.id}`}
                    loadAvailability={() => masterPanelApi.team.getAvailability(form.id!)}
                    saveWeekly={(rules) => masterPanelApi.team.putAvailability(form.id!, { rules })}
                    setDay={(data) => masterPanelApi.team.setDayAvailability(form.id!, data)}
                  />
                </div>
              )}

              <FormField label={t('admin.masters.instagram')} name="instagram" value={form.instagramHandle} onChange={(v) => setForm((f) => ({ ...f, instagramHandle: v }))} />

              {form.id && (
                <label className="flex items-center gap-3 font-label text-label-caps uppercase text-on-surface-variant">
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                    className="h-4 w-4 accent-primary"
                  />
                  {t('admin.masters.status')}
                </label>
              )}

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
