import { Router } from "express";
import { prisma } from "../lib/prisma";
import { parseLocale } from "../lib/locale";
import { serializeService } from "../lib/serialize";

const router = Router();

router.get("/shop-settings", async (_req, res) => {
  const settings = await prisma.shopSettings.findFirst({ include: { location: true } });
  if (!settings) {
    res.status(404).json({ error: "Shop settings have not been configured" });
    return;
  }
  res.json({
    shopSettings: {
      businessName: settings.businessName,
      address: settings.address,
      timezone: settings.timezone,
      cancellationCutoffHours: settings.cancellationCutoffHours,
      contactPhone: settings.contactPhone,
      contactEmail: settings.contactEmail,
      defaultLocale: settings.defaultLocale,
      location: {
        id: settings.location.id,
        slug: settings.location.slug,
        name: settings.location.name,
      },
    },
  });
});

router.get("/services", async (req, res) => {
  const locale = parseLocale(req);
  const services = await prisma.service.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  res.json({ services: services.map((s) => serializeService(s, locale)) });
});

export default router;
