import type { Booking, BookingService, Location, MasterProfile, Service, User } from "@prisma/client";
import { Locale } from "@prisma/client";
import { pickLocale } from "./locale";
import type { Locale as LocaleType } from "./locale";

export function serializeUser(user: User, extras?: { isOwner?: boolean; masterId?: string | null }) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    phone: user.phone,
    role: user.role,
    preferredLocale: user.preferredLocale,
    createdAt: user.createdAt,
    isOwner: extras?.isOwner ?? false,
    masterId: extras?.masterId ?? null,
  };
}

export function serializeService(service: Service, locale: LocaleType) {
  return {
    id: service.id,
    name: pickLocale(locale, service.nameEn, service.nameRu),
    description: pickLocale(locale, service.descriptionEn, service.descriptionRu),
    nameEn: service.nameEn,
    nameRu: service.nameRu,
    descriptionEn: service.descriptionEn,
    descriptionRu: service.descriptionRu,
    basePriceCents: service.basePriceCents,
    baseDurationMinutes: service.baseDurationMinutes,
    category: service.category,
    icon: service.icon,
    isActive: service.isActive,
    sortOrder: service.sortOrder,
  };
}

export function serializeServiceAdmin(service: Service) {
  return {
    id: service.id,
    nameEn: service.nameEn,
    nameRu: service.nameRu,
    descriptionEn: service.descriptionEn,
    descriptionRu: service.descriptionRu,
    basePriceCents: service.basePriceCents,
    baseDurationMinutes: service.baseDurationMinutes,
    category: service.category,
    icon: service.icon,
    isActive: service.isActive,
    sortOrder: service.sortOrder,
  };
}

export function serializeMasterPublic(
  master: MasterProfile & {
    user: User;
    masterServices?: Array<{ service: Service }>;
  },
  locale: Locale = Locale.en,
) {
  const serviceTags =
    master.masterServices?.map((link) => pickLocale(locale, link.service.nameEn, link.service.nameRu)) ?? null;

  return {
    id: master.id,
    name: pickLocale(locale, master.user.name, master.nameRu ?? master.user.name),
    nameEn: master.user.name,
    nameRu: master.nameRu ?? master.user.name,
    bio: master.bio,
    photoUrl: master.photoUrl,
    specialtyTags: serviceTags ?? master.specialtyTags,
    serviceIds: master.masterServices?.map((link) => link.service.id) ?? [],
    instagramHandle: master.instagramHandle,
    sortOrder: master.sortOrder,
  };
}

export function serializeMasterAdmin(
  master: MasterProfile & {
    user: User;
    location?: Location;
    masterServices?: Array<{ serviceId: string; service?: Service }>;
  },
) {
  return {
    id: master.id,
    userId: master.userId,
    locationId: master.locationId,
    locationName: master.location?.name,
    email: master.user.email,
    name: master.user.name,
    nameRu: master.nameRu,
    phone: master.user.phone,
    bio: master.bio,
    photoUrl: master.photoUrl,
    specialtyTags: master.specialtyTags,
    serviceIds: master.masterServices?.map((link) => link.serviceId) ?? [],
    instagramHandle: master.instagramHandle,
    isActive: master.isActive,
    isOwner: master.isOwner,
    sortOrder: master.sortOrder,
    createdAt: master.createdAt,
  };
}

type BookingServiceWithService = BookingService & { service: Service };
type BookingWithRelations = Booking & {
  services: BookingServiceWithService[];
  master: MasterProfile & { user: User; location?: Location };
  client?: User;
};

export function serializeBooking(booking: BookingWithRelations, locale: Locale, opts?: { includeClient?: boolean }) {
  return {
    id: booking.id,
    status: booking.status,
    startAt: booking.startAt,
    endAt: booking.endAt,
    totalPriceCents: booking.totalPriceCents,
    cancellationDeadlineAt: booking.cancellationDeadlineAt,
    createdAt: booking.createdAt,
    cancelledAt: booking.cancelledAt,
    master: {
      id: booking.master.id,
      name: pickLocale(locale, booking.master.user.name, booking.master.nameRu ?? booking.master.user.name),
      photoUrl: booking.master.photoUrl,
    },
    location: booking.master.location
      ? {
          name: booking.master.location.name,
          address: booking.master.location.address,
          timezone: booking.master.location.timezone,
        }
      : undefined,
    services: booking.services.map((s) => ({
      serviceId: s.serviceId,
      name: pickLocale(locale, s.service.nameEn, s.service.nameRu),
      priceAtBookingCents: s.priceAtBookingCents,
      durationAtBookingMinutes: s.durationAtBookingMinutes,
    })),
    ...(opts?.includeClient && booking.client
      ? {
          client: {
            id: booking.client.id,
            name: booking.client.name,
            email: booking.client.email,
            phone: booking.client.phone,
          },
        }
      : {}),
  };
}
