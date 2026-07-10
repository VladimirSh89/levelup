import { useSyncExternalStore } from 'react';

export interface BookingDraft {
  step: 1 | 2 | 3 | 4;
  masterId: string | null;
  serviceIds: string[];
  date: string | null;
  time: string | null;
  /** ISO UTC start from slot API */
  startAt: string | null;
}

const STORAGE_KEY = 'levelup.bookingDraft';

const defaultDraft: BookingDraft = {
  step: 1,
  masterId: null,
  serviceIds: [],
  date: null,
  time: null,
  startAt: null,
};

function readFromStorage(): BookingDraft {
  if (typeof window === 'undefined') return { ...defaultDraft };
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...defaultDraft };
    const parsed = JSON.parse(raw);
    return { ...defaultDraft, ...parsed };
  } catch {
    return { ...defaultDraft };
  }
}

function writeToStorage(draft: BookingDraft): void {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
}

let draft: BookingDraft = readFromStorage();
const listeners = new Set<() => void>();

function notify(): void {
  listeners.forEach((listener) => listener());
}

export function getDraft(): BookingDraft {
  return draft;
}

export function setDraft(update: Partial<BookingDraft> | ((current: BookingDraft) => Partial<BookingDraft>)): void {
  const patch = typeof update === 'function' ? update(draft) : update;
  draft = { ...draft, ...patch };
  writeToStorage(draft);
  notify();
}

export function clearDraft(): void {
  draft = { ...defaultDraft };
  if (typeof window !== 'undefined') {
    window.sessionStorage.removeItem(STORAGE_KEY);
  }
  notify();
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useBookingDraft(): BookingDraft {
  return useSyncExternalStore(subscribe, getDraft, () => defaultDraft);
}

export function hasDraftProgress(d: BookingDraft): boolean {
  return Boolean(d.masterId || d.serviceIds.length > 0 || d.date || d.time || d.startAt);
}
