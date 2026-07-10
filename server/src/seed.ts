import "dotenv/config";
import bcrypt from "bcryptjs";
import { Locale, Role } from "@prisma/client";
import { prisma } from "./lib/prisma";

const BCRYPT_ROUNDS = 10;

async function hash(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

async function main() {
  console.log("[seed] Seeding Level Up Barbershop defaults (admin, services, Shaxzod — no clients)…");

  /* ── Location ── */
  const location = await prisma.location.upsert({
    where: { slug: "cincinnati" },
    update: {
      name: "Level Up Barbershop — Cincinnati",
      address: "9536 Cincinnati Columbus Rd, Suite 19, Cincinnati, OH",
    },
    create: {
      slug: "cincinnati",
      name: "Level Up Barbershop — Cincinnati",
      address: "9536 Cincinnati Columbus Rd, Suite 19, Cincinnati, OH",
      timezone: "America/New_York",
      isActive: true,
    },
  });

  /* ── Shop settings ── */
  await prisma.shopSettings.upsert({
    where: { locationId: location.id },
    update: {
      address: "9536 Cincinnati Columbus Rd, Suite 19, Cincinnati, OH",
      contactPhone: "(513) 668-3522",
      contactEmail: "hello@levelupbarbershop.local",
      businessName: "Level Up Barbershop",
    },
    create: {
      locationId: location.id,
      businessName: "Level Up Barbershop",
      address: "9536 Cincinnati Columbus Rd, Suite 19, Cincinnati, OH",
      timezone: "America/New_York",
      cancellationCutoffHours: 24,
      contactPhone: "(513) 668-3522",
      contactEmail: "hello@levelupbarbershop.local",
      defaultLocale: Locale.en,
    },
  });

  /* ── Admin ── */
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? "admin@levelup.local";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "Admin123!";
  await prisma.user.upsert({
    where: { email: adminEmail },
    update: { role: Role.admin },
    create: {
      email: adminEmail,
      passwordHash: await hash(adminPassword),
      name: "Level Up Admin",
      role: Role.admin,
      preferredLocale: Locale.en,
    },
  });
  console.log(`[seed] Admin: ${adminEmail} / ${adminPassword}`);

  /* ── Services ── */
  const serviceDefs = [
    {
      nameEn: "Classic Haircut",
      nameRu: "Классическая стрижка",
      descriptionEn: "Precision cut, tailored to your style, finished with a hot towel and styling.",
      descriptionRu: "Точная стрижка по вашему стилю, с горячим полотенцем и укладкой.",
      basePriceCents: 3500,
      baseDurationMinutes: 30,
      category: "haircut",
      icon: "content_cut",
      sortOrder: 1,
    },
    {
      nameEn: "Beard Trim & Shape",
      nameRu: "Оформление бороды",
      descriptionEn: "Sharp beard lineup and shaping with straight-razor detailing.",
      descriptionRu: "Чёткое оформление и моделирование бороды с обработкой опасной бритвой.",
      basePriceCents: 2000,
      baseDurationMinutes: 20,
      category: "beard",
      icon: "face",
      sortOrder: 2,
    },
    {
      nameEn: "Haircut & Beard Combo",
      nameRu: "Стрижка + борода",
      descriptionEn: "Our signature full package — haircut and beard trim in one visit.",
      descriptionRu: "Наш фирменный комплекс — стрижка и оформление бороды за один визит.",
      basePriceCents: 5000,
      baseDurationMinutes: 45,
      category: "combo",
      icon: "auto_awesome",
      sortOrder: 3,
    },
  ];

  const services = [];
  for (const def of serviceDefs) {
    const existing = await prisma.service.findFirst({ where: { nameEn: def.nameEn } });
    const service = existing
      ? await prisma.service.update({ where: { id: existing.id }, data: def })
      : await prisma.service.create({ data: def });
    services.push(service);
  }

  /* ── Masters: only Shaxzod for now ── */
  const masterDefs = [
    {
      email: "shaxzod@levelup.local",
      name: "Shaxzod Asliev",
      nameRu: "Шахзод Аслиев",
      phone: "(513) 668-3522",
      bio: "Owner barber at Level Up — precision cuts, fades, and beard work.",
      specialtyTags: ["fades", "classic cuts", "beard"],
      instagramHandle: "@shaxa__24",
      sortOrder: 1,
      isOwner: true,
    },
  ];

  const keepEmails = new Set(masterDefs.map((d) => d.email));
  const staleMasters = await prisma.masterProfile.findMany({
    include: { user: true },
  });
  for (const stale of staleMasters) {
    if (keepEmails.has(stale.user.email)) continue;
    await prisma.$transaction(async (tx) => {
      const bookings = await tx.booking.findMany({ where: { masterId: stale.id }, select: { id: true } });
      const bookingIds = bookings.map((b) => b.id);
      if (bookingIds.length) {
        await tx.bookingService.deleteMany({ where: { bookingId: { in: bookingIds } } });
        await tx.booking.deleteMany({ where: { id: { in: bookingIds } } });
      }
      await tx.masterProfile.delete({ where: { id: stale.id } });
      await tx.user.delete({ where: { id: stale.userId } });
    });
    console.log(`[seed] Removed master: ${stale.user.email}`);
  }

  const masterPassword = process.env.SEED_MASTER_PASSWORD ?? "Master123!";
  const masters = [];
  for (const def of masterDefs) {
    const user = await prisma.user.upsert({
      where: { email: def.email },
      update: { role: Role.master, name: def.name, phone: def.phone },
      create: {
        email: def.email,
        passwordHash: await hash(masterPassword),
        name: def.name,
        phone: def.phone,
        role: Role.master,
        preferredLocale: Locale.en,
      },
    });

    const master = await prisma.masterProfile.upsert({
      where: { userId: user.id },
      update: {
        locationId: location.id,
        nameRu: def.nameRu,
        bio: def.bio,
        specialtyTags: def.specialtyTags,
        instagramHandle: def.instagramHandle,
        sortOrder: def.sortOrder,
        isActive: true,
        isOwner: def.isOwner ?? false,
      },
      create: {
        userId: user.id,
        locationId: location.id,
        nameRu: def.nameRu,
        bio: def.bio,
        specialtyTags: def.specialtyTags,
        instagramHandle: def.instagramHandle,
        sortOrder: def.sortOrder,
        isOwner: def.isOwner ?? false,
      },
    });

    if (def.isOwner) {
      await prisma.masterProfile.updateMany({
        where: { id: { not: master.id }, isOwner: true },
        data: { isOwner: false },
      });
    }

    masters.push(master);
    console.log(`[seed] Master: ${def.email} / ${masterPassword}`);
  }

  /* ── Availability: Tue–Sat, 10:00–18:30 (dayOfWeek: 2=Tue … 6=Sat) ── */
  const WORK_DAYS = [2, 3, 4, 5, 6];
  for (const master of masters) {
    await prisma.availabilityRule.deleteMany({ where: { masterId: master.id } });
    await prisma.availabilityRule.createMany({
      data: WORK_DAYS.map((dayOfWeek) => ({
        masterId: master.id,
        dayOfWeek,
        startTime: "10:00",
        endTime: "18:30",
      })),
    });
  }

  /* ── Assign all services to both masters ── */
  for (const master of masters) {
    for (const service of services) {
      await prisma.masterService.upsert({
        where: { masterId_serviceId: { masterId: master.id, serviceId: service.id } },
        update: {},
        create: { masterId: master.id, serviceId: service.id },
      });
    }
  }

  console.log("[seed] Done.");

  /* ── Optional: purge client accounts (prod catalog-only) ── */
  if (process.env.SEED_PURGE_CLIENTS === "1") {
    const clients = await prisma.user.findMany({ where: { role: Role.client }, select: { id: true, email: true } });
    if (clients.length) {
      const ids = clients.map((c) => c.id);
      const bookings = await prisma.booking.findMany({ where: { clientId: { in: ids } }, select: { id: true } });
      const bookingIds = bookings.map((b) => b.id);
      if (bookingIds.length) {
        await prisma.bookingService.deleteMany({ where: { bookingId: { in: bookingIds } } });
        await prisma.booking.deleteMany({ where: { id: { in: bookingIds } } });
      }
      await prisma.user.deleteMany({ where: { id: { in: ids } } });
      console.log(`[seed] Purged ${clients.length} client(s): ${clients.map((c) => c.email).join(", ")}`);
    } else {
      console.log("[seed] No client accounts to purge.");
    }
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
