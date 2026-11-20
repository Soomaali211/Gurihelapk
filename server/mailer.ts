import nodemailer from 'nodemailer';

export interface EmailOtpDeliveryResult {
  provider: 'resend' | 'smtp';
  messageId?: string;
}

export function isEmailProviderConfigured(): boolean {
  const hasResend = Boolean(process.env.RESEND_API_KEY?.trim());
  const hasSmtp = Boolean(process.env.SMTP_HOST?.trim());
  return hasResend || hasSmtp;
}

function getFromAddress(): string {
  return (
    process.env.EMAIL_FROM?.trim() ||
    process.env.SMTP_USER?.trim() ||
    'GuriHel <no-reply@gurihel.com>'
  );
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
  const expiresMinutes = params.expiresMinutes ?? 5;
  const from = getFromAddress();
  const { subject, text, html } = buildOtpEmailContent(params.code, expiresMinutes);

  const resendKey = process.env.RESEND_API_KEY?.trim();
  if (resendKey) {
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [params.to],
        subject,
        text,
        html,
      }),
    });

    if (!resp.ok) {
      const errBody = await resp.text().catch(() => '');
      throw new Error(`Email provider error (${resp.status}): ${errBody.slice(0, 200)}`);
    }

    const data = (await resp.json().catch(() => ({}))) as { id?: string };
    return { provider: 'resend', messageId: data.id };
  }

  const smtpHost = process.env.SMTP_HOST?.trim();
  if (smtpHost) {
    const port = Number(process.env.SMTP_PORT || 587);
    const secure =
      process.env.SMTP_SECURE !== undefined
        ? process.env.SMTP_SECURE.toLowerCase() === 'true'
        : port === 465;
    const smtpUser = process.env.SMTP_USER?.trim();
    const smtpPass = process.env.SMTP_PASS || '';

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: Number.isFinite(port) && port > 0 ? port : 587,
      secure,
      auth: smtpUser ? { user: smtpUser, pass: smtpPass } : undefined,
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
    });

    const info = await transporter.sendMail({
      from,
      to: params.to,
      subject,
      text,
      html,
    });

    return { provider: 'smtp', messageId: info.messageId };
  }

  throw new Error(
    'Email delivery provider is not configured. Configure RESEND_API_KEY or SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS.'
  );
}
