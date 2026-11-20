import crypto from 'crypto';

export const EXCLUSIVE_ADMIN_PHONE_E164 = '+252636786709';

export interface CountryDialCode {
  iso: string;
  name: string;
  dialCode: string;
  example: string;
}

export const COUNTRY_DIAL_CODES: CountryDialCode[] = [
  { iso: 'SO', name: 'Somaliland / Somalia', dialCode: '+252', example: '63 678 6709' },
  { iso: 'DJ', name: 'Djibouti', dialCode: '+253', example: '77 123 456' },
  { iso: 'ET', name: 'Ethiopia', dialCode: '+251', example: '91 123 4567' },
  { iso: 'KE', name: 'Kenya', dialCode: '+254', example: '712 345 678' },
  { iso: 'AE', name: 'United Arab Emirates', dialCode: '+971', example: '50 123 4567' },
  { iso: 'SA', name: 'Saudi Arabia', dialCode: '+966', example: '50 123 4567' },
  { iso: 'GB', name: 'United Kingdom', dialCode: '+44', example: '7700 900123' },
  { iso: 'US', name: 'United States / Canada', dialCode: '+1', example: '415 555 0199' },
  { iso: 'SE', name: 'Sweden', dialCode: '+46', example: '70 123 4567' },
  { iso: 'TR', name: 'Turkey', dialCode: '+90', example: '532 123 4567' },
];

/**
 * Normalizes a raw phone number (and optional country dial code) into strict E.164 format.
 * Returns null if the number is invalid per E.164 rules (+ followed by 7 to 15 digits, first non-zero).
 */
export function normalizeToE164(rawPhone: string, rawCountryCode?: string): string | null {
  const input = String(rawPhone || '').trim();
  if (!input) return null;

  let cleaned = input.replace(/[\s\-().]/g, '');
  if (cleaned.startsWith('00')) {
    cleaned = `+${cleaned.slice(2)}`;
  }

  if (cleaned.startsWith('+')) {
    const digits = cleaned.slice(1).replace(/\D/g, '');
    if (!/^[1-9]\d{6,14}$/.test(digits)) return null;
    return `+${digits}`;
  }

  const dialDigits = String(rawCountryCode || '+252').replace(/\D/g, '');
  if (!/^[1-9]\d{0,3}$/.test(dialDigits)) return null;

  let localDigits = cleaned.replace(/\D/g, '');
  if (localDigits.startsWith(dialDigits) && localDigits.length >= dialDigits.length + 7) {
    // Already includes country code without '+'
    const candidate = localDigits;
    return /^[1-9]\d{6,14}$/.test(candidate) ? `+${candidate}` : null;
  }

  // Strip trunk leading '0' (e.g. 0636786709 -> 636786709)
  localDigits = localDigits.replace(/^0+/, '');
  if (localDigits.length < 5 || localDigits.length > 13) return null;

  const combined = `${dialDigits}${localDigits}`;
  if (!/^[1-9]\d{6,14}$/.test(combined)) return null;
  return `+${combined}`;
}

export function isExclusiveAdminPhone(phoneE164: string): boolean {
  return phoneE164 === EXCLUSIVE_ADMIN_PHONE_E164;
}

export function generateNumericOtp(digits = 6): string {
  const max = Math.pow(10, digits);
  const num = crypto.randomInt(0, max);
  return String(num).padStart(digits, '0');
}

export interface WhatsAppDeliveryResult {
  ok: boolean;
  provider: 'meta' | 'twilio' | 'unconfigured';
  messageId?: string;
  errorCode?: string;
  errorMessage?: string;
}

/**
 * Sends OTP via real WhatsApp Business Platform (Meta Cloud API) or Twilio WhatsApp API.
 * NEVER simulates delivery or suppresses upstream delivery failures.
 */
export async function sendWhatsAppOtp(
  phoneE164: string,
  otpCode: string,
  expiryMinutes = 5
): Promise<WhatsAppDeliveryResult> {
  const preferredProvider = (process.env.WHATSAPP_PROVIDER || 'meta').trim().toLowerCase();

  const metaToken = process.env.WHATSAPP_ACCESS_TOKEN?.trim() || '';
  const metaPhoneId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim() || '';
  const metaTemplate = process.env.WHATSAPP_OTP_TEMPLATE_NAME?.trim() || '';
  const metaTemplateLang = process.env.WHATSAPP_OTP_TEMPLATE_LANG?.trim() || 'en_US';

  const twilioSid = process.env.TWILIO_ACCOUNT_SID?.trim() || '';
  const twilioToken = process.env.TWILIO_AUTH_TOKEN?.trim() || '';
  const twilioFrom = process.env.TWILIO_WHATSAPP_FROM?.trim() || '';

  const useTwilio =
    preferredProvider === 'twilio'
      ? Boolean(twilioSid && twilioToken && twilioFrom)
      : !metaToken && !metaPhoneId && Boolean(twilioSid && twilioToken && twilioFrom);

  const useMeta = !useTwilio && Boolean(metaToken && metaPhoneId);

  if (!useMeta && !useTwilio) {
    return {
      ok: false,
      provider: 'unconfigured',
      errorCode: 'WHATSAPP_PROVIDER_NOT_CONFIGURED',
      errorMessage:
        'WhatsApp OTP delivery failed: WhatsApp Business API credentials are not configured on the server.',
    };
  }

  if (useMeta) {
    const recipient = phoneE164.replace(/^\+/, '');
    const endpoint = `https://graph.facebook.com/v21.0/${encodeURIComponent(metaPhoneId)}/messages`;

    const payload = metaTemplate
      ? {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: recipient,
          type: 'template',
          template: {
            name: metaTemplate,
            language: { code: metaTemplateLang },
            components: [
              {
                type: 'body',
                parameters: [{ type: 'text', text: otpCode }],
              },
              {
                type: 'button',
                sub_type: 'url',
                index: '0',
                parameters: [{ type: 'text', text: otpCode }],
              },
            ],
          },
        }
      : {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: recipient,
          type: 'text',
          text: {
            preview_url: false,
            body: `GuriHel verification code: ${otpCode}. This code expires in ${expiryMinutes} minutes. Do not share it with anyone.`,
          },
        };

    try {
      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${metaToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = (await resp.json().catch(() => ({}))) as {
        messages?: Array<{ id?: string }>;
        error?: { message?: string; code?: number; error_subcode?: number };
      };

      if (!resp.ok || !data.messages?.[0]?.id) {
        return {
          ok: false,
          provider: 'meta',
          errorCode: data.error?.code ? `META_${data.error.code}` : `HTTP_${resp.status}`,
          errorMessage:
            data.error?.message ||
            `WhatsApp Cloud API rejected OTP delivery (HTTP ${resp.status}).`,
        };
      }

      return {
        ok: true,
        provider: 'meta',
        messageId: data.messages[0].id,
      };
    } catch (err) {
      return {
        ok: false,
        provider: 'meta',
        errorCode: 'WHATSAPP_NETWORK_ERROR',
        errorMessage:
          err instanceof Error
            ? `Failed to reach WhatsApp Cloud API: ${err.message}`
            : 'Failed to reach WhatsApp Cloud API.',
      };
    }
  }

  // Twilio WhatsApp Provider
  try {
    const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(
      twilioSid
    )}/Messages.json`;
    const fromFormatted = twilioFrom.startsWith('whatsapp:') ? twilioFrom : `whatsapp:${twilioFrom}`;
    const toFormatted = `whatsapp:${phoneE164}`;

    const form = new URLSearchParams({
      From: fromFormatted,
      To: toFormatted,
      Body: `GuriHel verification code: ${otpCode}. Valid for ${expiryMinutes} minutes. Never share this code.`,
    });

    const authHeader = Buffer.from(`${twilioSid}:${twilioToken}`).toString('base64');
    const resp = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${authHeader}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: form.toString(),
    });

    const data = (await resp.json().catch(() => ({}))) as {
      sid?: string;
      message?: string;
      code?: number;
    };

    if (!resp.ok || !data.sid) {
      return {
        ok: false,
        provider: 'twilio',
        errorCode: data.code ? `TWILIO_${data.code}` : `HTTP_${resp.status}`,
        errorMessage:
          data.message || `Twilio WhatsApp API failed to send OTP (HTTP ${resp.status}).`,
      };
    }

    return {
      ok: true,
      provider: 'twilio',
      messageId: data.sid,
    };
  } catch (err) {
    return {
      ok: false,
      provider: 'twilio',
      errorCode: 'TWILIO_NETWORK_ERROR',
      errorMessage:
        err instanceof Error
          ? `Failed to reach Twilio WhatsApp API: ${err.message}`
          : 'Failed to reach Twilio WhatsApp API.',
    };
  }
}

export function getWhatsAppProviderStatus(): {
  configured: boolean;
  provider: 'meta' | 'twilio' | 'unconfigured';
} {
  const preferred = (process.env.WHATSAPP_PROVIDER || 'meta').trim().toLowerCase();
  const hasMeta = Boolean(
    process.env.WHATSAPP_ACCESS_TOKEN?.trim() && process.env.WHATSAPP_PHONE_NUMBER_ID?.trim()
  );
  const hasTwilio = Boolean(
    process.env.TWILIO_ACCOUNT_SID?.trim() &&
      process.env.TWILIO_AUTH_TOKEN?.trim() &&
      process.env.TWILIO_WHATSAPP_FROM?.trim()
  );

  if (preferred === 'twilio' && hasTwilio) return { configured: true, provider: 'twilio' };
  if (hasMeta) return { configured: true, provider: 'meta' };
  if (hasTwilio) return { configured: true, provider: 'twilio' };
  return { configured: false, provider: 'unconfigured' };
}
