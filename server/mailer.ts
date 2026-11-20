import nodemailer from 'nodemailer';

export interface EmailOtpDeliveryResult {
  provider: 'gmail_smtp';
  messageId?: string;
}

export interface SmtpTransportConfig {
  host: string;
  port: number;
  secure: boolean;
  requireTLS: boolean;
  user: string;
  pass: string;
  from: string;
}

function normalizeAppPassword(rawPass: string): string {
  const trimmed = rawPass.trim();
  if (/^[a-z]{4}(?:\s[a-z]{4}){3}$/i.test(trimmed)) {
    return trimmed.replace(/\s+/g, '');
  }
  return rawPass;
}

export function getSmtpConfig(): SmtpTransportConfig | null {
  const user = process.env.SMTP_USER?.trim() || '';
  const pass = normalizeAppPassword(process.env.SMTP_PASS || '');
  if (!user || !pass) {
    return null;
  }

  const host = process.env.SMTP_HOST?.trim() || 'smtp.gmail.com';
  const parsedPort = Number(process.env.SMTP_PORT || 587);
  const port = Number.isFinite(parsedPort) && parsedPort > 0 ? parsedPort : 587;
  const secure =
    process.env.SMTP_SECURE !== undefined
      ? process.env.SMTP_SECURE.trim().toLowerCase() === 'true'
      : port === 465;

  const isLocalRelay = host === '127.0.0.1' || host === 'localhost';
  const requireTLS = !secure && port === 587 && !isLocalRelay;
  const from = process.env.EMAIL_FROM?.trim() || `GuriHel <${user}>`;

  return {
    host,
    port,
    secure,
    requireTLS,
    user,
    pass,
    from,
  };
}

export function isEmailProviderConfigured(): boolean {
  return Boolean(getSmtpConfig());
}

function createSmtpTransporter(cfg: SmtpTransportConfig) {
  return nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    requireTLS: cfg.requireTLS,
    auth: {
      user: cfg.user,
      pass: cfg.pass,
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });
}

export async function verifySmtpTransport(): Promise<{ ok: boolean; error?: string }> {
  const cfg = getSmtpConfig();
  if (!cfg) {
    return {
      ok: false,
      error: 'Gmail SMTP credentials (SMTP_USER and SMTP_PASS) are not configured.',
    };
  }
  try {
    const transporter = createSmtpTransporter(cfg);
    await transporter.verify();
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'SMTP verification failed.',
    };
  }
}

function buildOtpEmailContent(code: string, expiresMinutes: number) {
  const subject = `${code} is your GuriHel verification code`;
  const text = [
    'GuriHel Verification Code',
    '',
    `Your verification code is: ${code}`,
    '',
    `This code expires in ${expiresMinutes} minutes and can only be used once.`,
    'If you did not request this code, you can safely ignore this email.',
  ].join('\n');

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; background: #ffffff; color: #18211C; border: 1px solid #E2E8F0; border-radius: 16px;">
      <div style="font-size: 18px; font-weight: 800; color: #0B7A3E; margin-bottom: 12px;">GuriHel</div>
      <p style="font-size: 14px; line-height: 1.5; margin: 0 0 16px;">Use the verification code below to complete your sign in:</p>
      <div style="background: #F4F6F8; border: 1px solid #CBD5E1; border-radius: 12px; padding: 16px; text-align: center; font-size: 28px; font-weight: 800; letter-spacing: 6px; color: #0F3D2A; font-family: monospace; margin-bottom: 16px;">
        ${code}
      </div>
      <p style="font-size: 12px; color: #64748B; line-height: 1.5; margin: 0;">
        This code expires in ${expiresMinutes} minutes and can only be used once. If you did not request this email, please ignore it.
      </p>
    </div>
  `.trim();

  return { subject, text, html };
}

export async function sendVerificationOtpEmail(params: {
  to: string;
  code: string;
  expiresMinutes?: number;
}): Promise<EmailOtpDeliveryResult> {
  const cfg = getSmtpConfig();
  if (!cfg) {
    throw new Error(
      'Gmail SMTP delivery is not configured. Configure SMTP_USER and SMTP_PASS.'
    );
  }

  const expiresMinutes = params.expiresMinutes ?? 5;
  const { subject, text, html } = buildOtpEmailContent(params.code, expiresMinutes);
  const transporter = createSmtpTransporter(cfg);

  const info = await transporter.sendMail({
    from: cfg.from,
    to: params.to,
    subject,
    text,
    html,
  });

  return {
    provider: 'gmail_smtp',
    messageId: info.messageId,
  };
}
