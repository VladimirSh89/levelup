import nodemailer, { type Transporter } from "nodemailer";
import { formatInTimeZone } from "date-fns-tz";
import { ru } from "date-fns/locale";
import { SHOP_TIME_ZONE } from "./slots";

export type EmailLocale = "en" | "ru";

export interface BookingEmailService {
  name: string;
  durationMinutes: number;
  priceCents: number;
}

export interface BookingEmailData {
  toEmail: string;
  toName: string;
  masterName: string;
  services: BookingEmailService[];
  startAt: Date;
  businessName: string;
  address: string;
  bookingId: string;
  locale: EmailLocale;
}

let cachedTransporter: Transporter | null = null;

function isDevMailMode(): boolean {
  return !process.env.SMTP_HOST;
}

/** Real SMTP transport in prod; a `jsonTransport` stub (no network calls) in dev. */
function getTransporter(): Transporter {
  if (cachedTransporter) return cachedTransporter;

  if (process.env.SMTP_HOST) {
    cachedTransporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: process.env.SMTP_SECURE === "true",
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
    });
  } else {
    cachedTransporter = nodemailer.createTransport({ jsonTransport: true });
  }
  return cachedTransporter;
}

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatUsd(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

const COPY: Record<
  EmailLocale,
  {
    subject: (biz: string) => string;
    heading: string;
    greeting: (name: string) => string;
    intro: string;
    dateTimeLabel: string;
    masterLabel: string;
    servicesLabel: string;
    totalLabel: string;
    addressLabel: string;
    manageCta: string;
    footer: (biz: string) => string;
    minutesSuffix: string;
  }
> = {
  en: {
    subject: (biz) => `Your appointment at ${biz} is confirmed`,
    heading: "APPOINTMENT CONFIRMED",
    greeting: (name) => `Hi ${name},`,
    intro: "Your appointment has been booked. Here are the details:",
    dateTimeLabel: "Date & Time",
    masterLabel: "Barber",
    servicesLabel: "Services",
    totalLabel: "Total",
    addressLabel: "Location",
    manageCta: "Manage Appointment",
    footer: (biz) => `${biz} — see you soon.`,
    minutesSuffix: "min",
  },
  ru: {
    subject: (biz) => `Ваша запись в ${biz} подтверждена`,
    heading: "ЗАПИСЬ ПОДТВЕРЖДЕНА",
    greeting: (name) => `Привет, ${name}!`,
    intro: "Ваша запись успешно создана. Детали ниже:",
    dateTimeLabel: "Дата и время",
    masterLabel: "Мастер",
    servicesLabel: "Услуги",
    totalLabel: "Итого",
    addressLabel: "Адрес",
    manageCta: "Управление записью",
    footer: (biz) => `${biz} — ждём вас.`,
    minutesSuffix: "мин",
  },
};

function manageUrl(bookingId: string): string {
  const base = process.env.CLIENT_URL ?? "http://localhost:5173";
  return `${base.replace(/\/$/, "")}/bookings/${bookingId}`;
}

/** Dark background, gold-accent HTML confirmation email — matches the site's design system. */
export function renderBookingConfirmationEmail(data: BookingEmailData): {
  subject: string;
  html: string;
  text: string;
} {
  const t = COPY[data.locale];
  const dateLabel = formatInTimeZone(
    data.startAt,
    SHOP_TIME_ZONE,
    data.locale === "ru" ? "d MMMM yyyy, HH:mm" : "EEEE, MMMM d, yyyy 'at' h:mm a",
    data.locale === "ru" ? { locale: ru } : undefined,
  );
  const totalCents = data.services.reduce((sum, s) => sum + s.priceCents, 0);
  const manage = manageUrl(data.bookingId);

  const servicesRows = data.services
    .map(
      (s) => `
        <tr>
          <td style="padding:6px 0;color:#F5F5F5;font-family:Arial,Helvetica,sans-serif;font-size:15px;">
            ${esc(s.name)} <span style="color:#A8A8A8;font-size:12px;">(${s.durationMinutes} ${t.minutesSuffix})</span>
          </td>
          <td style="padding:6px 0;text-align:right;color:#f2ca50;font-family:'Courier New',Courier,monospace;font-size:14px;">
            ${formatUsd(s.priceCents)}
          </td>
        </tr>`,
    )
    .join("");

  const html = `<!DOCTYPE html>
<html lang="${data.locale}">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1.0" />
<title>${esc(t.subject(data.businessName))}</title>
</head>
<body style="margin:0;padding:0;background-color:#0D0D0D;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#0D0D0D;">
  <tr>
    <td align="center" style="padding:40px 20px;">
      <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;">

        <tr><td style="height:3px;background-color:#f2ca50;font-size:1px;line-height:1px;">&nbsp;</td></tr>

        <tr>
          <td style="background-color:#0D0D0D;padding:32px 40px 8px 40px;">
            <div style="font-family:Arial,Helvetica,sans-serif;font-size:20px;font-weight:700;letter-spacing:0.08em;color:#f2ca50;text-transform:uppercase;">
              ${esc(data.businessName)}
            </div>
          </td>
        </tr>

        <tr>
          <td style="background-color:#1A1A1A;padding:32px 40px;border-top:2px solid #f2ca50;">
            <div style="font-family:Arial,Helvetica,sans-serif;font-size:22px;font-weight:700;letter-spacing:0.05em;color:#F5F5F5;text-transform:uppercase;margin:0 0 16px 0;">
              ${t.heading}
            </div>
            <p style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#F5F5F5;margin:0 0 4px 0;">${esc(t.greeting(data.toName))}</p>
            <p style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#A8A8A8;margin:0 0 24px 0;">${t.intro}</p>

            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;">
              <tr><td style="font-family:'Courier New',Courier,monospace;font-size:11px;letter-spacing:0.1em;color:#A8A8A8;text-transform:uppercase;padding-bottom:4px;">${t.dateTimeLabel}</td></tr>
              <tr><td style="font-family:Arial,Helvetica,sans-serif;font-size:16px;color:#F5F5F5;font-weight:600;padding-bottom:16px;border-bottom:1px solid #333333;">${esc(dateLabel)}</td></tr>
            </table>

            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;">
              <tr><td style="font-family:'Courier New',Courier,monospace;font-size:11px;letter-spacing:0.1em;color:#A8A8A8;text-transform:uppercase;padding-bottom:4px;">${t.masterLabel}</td></tr>
              <tr><td style="font-family:Arial,Helvetica,sans-serif;font-size:16px;color:#F5F5F5;font-weight:600;padding-bottom:16px;border-bottom:1px solid #333333;">${esc(data.masterName)}</td></tr>
            </table>

            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;">
              <tr><td colspan="2" style="font-family:'Courier New',Courier,monospace;font-size:11px;letter-spacing:0.1em;color:#A8A8A8;text-transform:uppercase;padding-bottom:8px;">${t.servicesLabel}</td></tr>
              ${servicesRows}
              <tr><td colspan="2" style="border-top:1px solid #333333;padding-top:8px;font-size:1px;line-height:1px;">&nbsp;</td></tr>
              <tr>
                <td style="padding:6px 0;color:#F5F5F5;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:700;">${t.totalLabel}</td>
                <td style="padding:6px 0;text-align:right;color:#f2ca50;font-family:'Courier New',Courier,monospace;font-size:16px;font-weight:700;">${formatUsd(totalCents)}</td>
              </tr>
            </table>

            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr><td style="font-family:'Courier New',Courier,monospace;font-size:11px;letter-spacing:0.1em;color:#A8A8A8;text-transform:uppercase;padding-bottom:4px;">${t.addressLabel}</td></tr>
              <tr><td style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#A8A8A8;">${esc(data.address)}</td></tr>
            </table>
          </td>
        </tr>

        <tr>
          <td align="center" style="background-color:#0D0D0D;padding:32px 40px;">
            <a href="${esc(manage)}"
               style="display:inline-block;background-color:#f2ca50;color:#0D0D0D;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;text-decoration:none;padding:14px 32px;">
              ${t.manageCta} &rarr;
            </a>
          </td>
        </tr>

        <tr>
          <td style="background-color:#0D0D0D;padding:0 40px 32px 40px;text-align:center;">
            <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#666666;line-height:1.6;">${esc(t.footer(data.businessName))}</p>
          </td>
        </tr>

        <tr><td style="height:3px;background-color:#f2ca50;font-size:1px;line-height:1px;">&nbsp;</td></tr>

      </table>
    </td>
  </tr>
</table>
</body>
</html>`;

  const text = [
    t.heading,
    t.greeting(data.toName),
    t.intro,
    `${t.dateTimeLabel}: ${dateLabel}`,
    `${t.masterLabel}: ${data.masterName}`,
    `${t.servicesLabel}: ${data.services.map((s) => s.name).join(", ")}`,
    `${t.totalLabel}: ${formatUsd(totalCents)}`,
    `${t.addressLabel}: ${data.address}`,
    `${t.manageCta}: ${manage}`,
  ].join("\n");

  return { subject: t.subject(data.businessName), html, text };
}

/**
 * Sends the booking confirmation email. In dev (no `SMTP_HOST`) this uses nodemailer's
 * `jsonTransport`, which never touches the network — the send is logged to the console instead.
 * Errors are swallowed (logged) so a flaky mail provider never fails a booking request.
 */
export async function sendBookingConfirmationEmail(data: BookingEmailData): Promise<void> {
  const { subject, html, text } = renderBookingConfirmationEmail(data);
  const from = process.env.MAIL_FROM ?? `"${data.businessName}" <no-reply@levelupbarbershop.local>`;

  if (isDevMailMode()) {
    // eslint-disable-next-line no-console
    console.log(`[email:dev] → ${data.toEmail} :: ${subject} (booking ${data.bookingId})`);
  }

  try {
    await getTransporter().sendMail({ from, to: data.toEmail, subject, html, text });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[email] failed to send booking confirmation", err);
  }
}
