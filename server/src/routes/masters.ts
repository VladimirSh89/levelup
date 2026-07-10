import { Router } from "express";
import { parseLocale } from "../lib/locale";
import { prisma } from "../lib/prisma";
import { serializeMasterPublic, serializeService } from "../lib/serialize";
import { getAvailableSlots, getBookableDaysForMonth } from "../services/slots";

const router = Router();

const MONTH_RE = /^\d{4}-\d{2}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

router.get("/", async (req, res) => {
  const locale = parseLocale(req);
  const masters = await prisma.masterProfile.findMany({
    where: { isActive: true },
    include: {
      user: true,
      masterServices: {
        where: { service: { isActive: true } },
        include: { service: true },
        orderBy: { service: { sortOrder: "asc" } },
      },
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  res.json({ masters: masters.map((m) => serializeMasterPublic(m, locale)) });
});

router.get("/:id/services", async (req, res) => {
  const locale = parseLocale(req);
  const master = await prisma.masterProfile.findFirst({
    where: { id: req.params.id, isActive: true },
  });
  if (!master) {
    res.status(404).json({ error: "Master not found" });
    return;
  }

  const links = await prisma.masterService.findMany({
    where: { masterId: master.id, service: { isActive: true } },
    include: { service: true },
    orderBy: { service: { sortOrder: "asc" } },
  });

  const services = links.map((link) => ({
    masterServiceId: link.id,
    ...serializeService(link.service, locale),
    priceCents: link.priceOverrideCents ?? link.service.basePriceCents,
    durationMinutes: link.durationOverrideMinutes ?? link.service.baseDurationMinutes,
  }));

  res.json({ services });
});

router.get("/:id/availability", async (req, res) => {
  const month = typeof req.query.month === "string" ? req.query.month : undefined;
  if (!month || !MONTH_RE.test(month)) {
    res.status(400).json({ error: "Query param `month` is required in YYYY-MM format" });
    return;
  }

  const master = await prisma.masterProfile.findFirst({ where: { id: req.params.id, isActive: true } });
  if (!master) {
    res.status(404).json({ error: "Master not found" });
    return;
  }

  const days = await getBookableDaysForMonth(master.id, month);
  res.json({ days });
});

router.get("/:id/slots", async (req, res) => {
  const date = typeof req.query.date === "string" ? req.query.date : undefined;
  if (!date || !DATE_RE.test(date)) {
    res.status(400).json({ error: "Query param `date` is required in YYYY-MM-DD format" });
    return;
  }
  const serviceIdsRaw = typeof req.query.serviceIds === "string" ? req.query.serviceIds : "";
  const serviceIds = serviceIdsRaw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (!serviceIds.length) {
    res.status(400).json({ error: "Query param `serviceIds` (comma-separated) is required" });
    return;
  }

  const master = await prisma.masterProfile.findFirst({ where: { id: req.params.id, isActive: true } });
  if (!master) {
    res.status(404).json({ error: "Master not found" });
    return;
  }

  const slots = await getAvailableSlots(master.id, date, serviceIds);
  res.json({ slots });
});

export default router;
