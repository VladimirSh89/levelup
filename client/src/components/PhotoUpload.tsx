import { useId, useRef, useState, type ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';

import Button from '@/components/Button';
import { uploadPhoto } from '@/lib/api';
import { cn, initials } from '@/lib/utils';

export const PHOTO_SIZES = [
  { value: 256, labelKey: 'admin.masters.photoSizeSm' },
  { value: 512, labelKey: 'admin.masters.photoSizeMd' },
  { value: 800, labelKey: 'admin.masters.photoSizeLg' },
  { value: 1200, labelKey: 'admin.masters.photoSizeXl' },
] as const;

interface PhotoUploadProps {
  value: string;
  onChange: (url: string) => void;
  nameHint?: string;
}

export default function PhotoUpload({ value, onChange, nameHint }: PhotoUploadProps) {
  const { t } = useTranslation();
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [size, setSize] = useState(512);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const displaySrc = preview || value || null;

  const handleFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setError(null);
    const localUrl = URL.createObjectURL(file);
    setPreview(localUrl);
    setUploading(true);

    try {
      const { url } = await uploadPhoto(file, size);
      onChange(url);
      setPreview(null);
      URL.revokeObjectURL(localUrl);
    } catch (err) {
      setPreview(null);
      URL.revokeObjectURL(localUrl);
      setError(err instanceof Error ? err.message : t('admin.masters.photoUploadFailed'));
    } finally {
      setUploading(false);
    }
  };

  const clearPhoto = () => {
    setPreview(null);
    setError(null);
    onChange('');
  };

  return (
    <div className="space-y-3">
      <span className="block font-label text-label-caps uppercase text-on-surface-variant">
        {t('admin.masters.photo')}
      </span>

      <div className="flex flex-wrap items-start gap-4">
        <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-primary/70 bg-surface-container-highest font-headline text-headline-md text-on-surface">
          {displaySrc ? (
            <img src={displaySrc} alt="" className="h-full w-full object-cover" />
          ) : (
            <span>{initials(nameHint || '?')}</span>
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <span className="mb-2 block font-label text-[10px] uppercase tracking-[0.1em] text-on-surface-variant">
              {t('admin.masters.photoSize')}
            </span>
            <div className="flex flex-wrap gap-2">
              {PHOTO_SIZES.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  disabled={uploading}
                  onClick={() => setSize(opt.value)}
                  className={cn(
                    'border px-3 py-1.5 font-label text-[10px] uppercase tracking-[0.1em] transition-colors',
                    size === opt.value
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-outline-variant text-on-surface-variant hover:border-primary/50',
                  )}
                >
                  {t(opt.labelKey)}
                </button>
              ))}
            </div>
            <p className="mt-1.5 font-body text-[12px] text-on-surface-variant">
              {t('admin.masters.photoSizeHint', { size })}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <input
              ref={inputRef}
              id={inputId}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="sr-only"
              onChange={handleFile}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={uploading}
              onClick={() => inputRef.current?.click()}
            >
              {uploading ? t('admin.masters.photoUploading') : t('admin.masters.photoChoose')}
            </Button>
            {value && (
              <Button type="button" variant="plain" size="sm" disabled={uploading} onClick={clearPhoto}>
                {t('admin.masters.photoRemove')}
              </Button>
            )}
          </div>

          {error && <p className="font-body text-[13px] text-error">{error}</p>}
        </div>
      </div>
    </div>
  );
}
