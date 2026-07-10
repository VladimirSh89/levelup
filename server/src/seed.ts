import "dotenv/config";
import bcrypt from "bcryptjs";
import { Locale, Role } from "@prisma/client";
import { prisma } from "./lib/prisma";

const BCRYPT_ROUNDS = 10;

async function hash(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

async function main() {
  console.log("[seed] Seeding Level Up Barbershop defaults…");

  /* ── Location ── */
  const location = await prisma.location.upsert({
    where: { slug: "cincinnati" },
    update: {},
    create: {
      slug: "cincinnati",
      name: "Level Up Barbershop — Cincinnati",
      address: "1234 Vine St, Cincinnati, OH 45202",
      timezone: "America/New_York",
      isActive: true,
    },
  });

  /* ── Shop settings ── */
  await prisma.shopSettings.upsert({
    where: { locationId: location.id },
    update: {},
    create: {
      locationId: location.id,
      businessName: "Level Up Barbershop",
      address: "1234 Vine St, Cincinnati, OH 45202",
      timezone: "America/New_York",
      cancellationCutoffHours: 24,
      contactPhone: "+1 (513) 555-0142",
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
      icon: "scissors",
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
      icon: "razor",
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
      icon: "combo",
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

  /* ── Masters ── */
  const masterDefs = [
    {
      email: "marcus@levelup.local",
      name: "Marcus Webb",
      phone: "+1 (513) 555-0110",
      bio: "10+ years behind the chair, specializing in precision fades and classic cuts.",
      specialtyTags: ["fades", "classic cuts", "hot towel shaves"],
      instagramHandle: "@marcus.levelup",
      sortOrder: 1,
    },
    {
      email: "tony@levelup.local",
      name: "Tony Alvarez",
      phone: "+1 (513) 555-0121",
      bio: "Beard specialist and barbering instructor with an eye for sharp lines.",
      specialtyTags: ["beard sculpting", "skin fades", "straight razor"],
      instagramHandle: "@tony.levelup",
      sortOrder: 2,
    },
  ];

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
        bio: def.bio,
        specialtyTags: def.specialtyTags,
        instagramHandle: def.instagramHandle,
        sortOrder: def.sortOrder,
        isActive: true,
      },
      create: {
        userId: user.id,
        locationId: location.id,
        bio: def.bio,
        specialtyTags: def.specialtyTags,
        instagramHandle: def.instagramHandle,
        sortOrder: def.sortOrder,
      },
    });

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
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
