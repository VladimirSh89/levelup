export type Role = 'client' | 'master' | 'admin';
export type Locale = 'en' | 'ru';
export type BookingStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'no_show';

export interface User {
  id: string;
  email: string;
  name: string;
  phone?: string | null;
  role: Role;
  preferredLocale: Locale;
  createdAt?: string;
  isOwner?: boolean;
  masterId?: string | null;
}

export interface Service {
  id: string;
  name?: string;
  description?: string;
  nameEn?: string;
  nameRu?: string;
  descriptionEn?: string;
  descriptionRu?: string;
  basePriceCents: number;
  baseDurationMinutes: number;
  /** Effective price when returned from master services */
  priceCents?: number;
  durationMinutes?: number;
  category: string;
  icon?: string | null;
  isActive?: boolean;
  sortOrder?: number;
}

export interface MasterProfile {
  id: string;
  userId?: string;
  name: string;
  nameEn?: string;
  nameRu?: string;
  bio?: string | null;
  photoUrl?: string | null;
  specialtyTags: string[];
  serviceIds?: string[];
  instagramHandle?: string | null;
  isActive?: boolean;
  isOwner?: boolean;
  sortOrder?: number;
  services?: Service[];
  rating?: number;
  email?: string;
}

export interface BookingServiceItem {
  serviceId: string;
  name?: string;
  priceAtBookingCents: number;
  durationAtBookingMinutes: number;
}

export interface Booking {
  id: string;
  clientUserId?: string;
  masterId?: string;
  master?: { id: string; name: string; photoUrl?: string | null };
  client?: User;
  status: BookingStatus;
  startAt: string;
  endAt: string;
  totalPriceCents: number;
  cancellationDeadlineAt: string;
  services: BookingServiceItem[];
  createdAt: string;
  cancelledAt?: string | null;
}

export interface ShopSettings {
  id?: string;
  businessName: string;
  address: string;
  timezone: string;
  cancellationCutoffHours: number;
  contactPhone?: string | null;
  contactEmail?: string | null;
  defaultLocale: Locale;
}

export interface DashboardStats {
  bookingsToday?: number;
  bookingsThisWeek?: number;
  todayCount?: number;
  weekCount?: number;
  revenueThisMonthCents?: number;
  activeMasters?: number;
  pendingBookings?: number;
}

export interface AuthResponse {
  user: User;
  token: string;
}
