import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { Jimp, JimpMime } from 'jimp';

export type WatermarkPosition =
  | 'bottom-right'
  | 'bottom-left'
  | 'top-right'
  | 'top-left'
  | 'center';

export type WatermarkVariant = 'primary' | 'mark';

export interface WatermarkSettings {
  enabled: boolean;
  position: WatermarkPosition;
  opacity: number; // 0.10 - 0.70
  variant: WatermarkVariant;
  scalePercent: number; // 10 - 24
}

export const DEFAULT_WATERMARK_SETTINGS: WatermarkSettings = {
  enabled: true,
  position: 'bottom-right',
  opacity: 0.34,
  variant: 'primary',
  scalePercent: 16,
};

const DATA_ROOT = process.env.GURIHEL_UPLOAD_DIR
  ? path.resolve(process.env.GURIHEL_UPLOAD_DIR)
  : path.resolve(process.cwd(), 'data', 'uploads');
const ORIGINALS_DIR = path.join(DATA_ROOT, 'originals');
const WATERMARKED_DIR = path.join(DATA_ROOT, 'watermarked');

const LOGO_ASSETS: Record<WatermarkVariant, string> = {
  primary: path.resolve(process.cwd(), 'public/assets/aistudio/GuriHel-logo-primary_c2f3e626.png'),
  mark: path.resolve(process.cwd(), 'public/assets/aistudio/GuriHel-mark_d2d21036.png'),
};

export function ensureMediaDirectories(): void {
  fs.mkdirSync(ORIGINALS_DIR, { recursive: true });
  fs.mkdirSync(WATERMARKED_DIR, { recursive: true });
}

export function sanitizeWatermarkSettings(
  input: Partial<WatermarkSettings> | null | undefined
): WatermarkSettings {
  const validPositions: WatermarkPosition[] = [
    'bottom-right',
    'bottom-left',
    'top-right',
    'top-left',
    'center',
  ];
  const validVariants: WatermarkVariant[] = ['primary', 'mark'];

  const position =
    input?.position && validPositions.includes(input.position)
      ? input.position
      : DEFAULT_WATERMARK_SETTINGS.position;

  const variant =
    input?.variant && validVariants.includes(input.variant)
      ? input.variant
      : DEFAULT_WATERMARK_SETTINGS.variant;

  const rawOpacity = Number(input?.opacity);
  const opacity = Number.isFinite(rawOpacity)
    ? Math.max(0.1, Math.min(0.7, Number(rawOpacity.toFixed(2))))
    : DEFAULT_WATERMARK_SETTINGS.opacity;

  const rawScale = Number(input?.scalePercent);
  const scalePercent = Number.isFinite(rawScale)
    ? Math.max(10, Math.min(24, Math.round(rawScale)))
    : DEFAULT_WATERMARK_SETTINGS.scalePercent;

  const enabled =
    typeof input?.enabled === 'boolean' ? input.enabled : DEFAULT_WATERMARK_SETTINGS.enabled;

  return { enabled, position, opacity, variant, scalePercent };
}

function decodeBase64Image(dataUrlOrBase64: string): { buffer: Buffer; ext: string; mime: string } {
  const match = dataUrlOrBase64.match(/^data:(image\/(?:png|jpeg|jpg|webp));base64,(.+)$/i);
  if (match) {
    const mime = match[1].toLowerCase() === 'image/jpg' ? 'image/jpeg' : match[1].toLowerCase();
    const ext = mime === 'image/png' ? 'png' : 'jpg';
    return { buffer: Buffer.from(match[2], 'base64'), ext, mime };
  }
  throw new Error('Only PNG, JPEG, or WebP base64 image uploads are supported.');
}

/**
 * Generates a single non-destructive watermarked copy strictly from the original image path.
 * Never reads a previously watermarked image as input, preventing double-watermarking.
 */
export async function applyOfficialWatermarkFromOriginal(
  originalPath: string,
  watermarkedPath: string,
  settings: WatermarkSettings
): Promise<{ width: number; height: number; watermarked: boolean }> {
  const baseImage = await Jimp.read(originalPath);
  const width = baseImage.width;
  const height = baseImage.height;

  // Cap huge photos cleanly while keeping sharp real-estate clarity
  if (width > 1600) {
    baseImage.resize({ w: 1600 });
  }

  const finalW = baseImage.width;
  const finalH = baseImage.height;

  if (settings.enabled) {
    const logoFile = LOGO_ASSETS[settings.variant] || LOGO_ASSETS.primary;
    if (!fs.existsSync(logoFile)) {
      throw new Error(`Official GuriHel logo file missing at ${logoFile}`);
    }

    const logo = await Jimp.read(logoFile);
    const targetLogoWidth = Math.max(
      64,
      Math.min(Math.round((finalW * settings.scalePercent) / 100), Math.round(finalW * 0.28))
    );
    logo.resize({ w: targetLogoWidth });
    logo.opacity(settings.opacity);

    const padX = Math.max(14, Math.round(finalW * 0.025));
    const padY = Math.max(14, Math.round(finalH * 0.025));

    let x = finalW - logo.width - padX;
    let y = finalH - logo.height - padY;

    switch (settings.position) {
      case 'bottom-left':
        x = padX;
        y = finalH - logo.height - padY;
        break;
      case 'top-right':
        x = finalW - logo.width - padX;
        y = padY;
        break;
      case 'top-left':
        x = padX;
        y = padY;
        break;
      case 'center':
        x = Math.round((finalW - logo.width) / 2);
        y = Math.round((finalH - logo.height) / 2);
        break;
      case 'bottom-right':
      default:
        x = finalW - logo.width - padX;
        y = finalH - logo.height - padY;
        break;
    }

    baseImage.composite(logo, Math.max(0, x), Math.max(0, y));
  }

  const outBuf = await baseImage.getBuffer(JimpMime.jpeg, { quality: 86 });
  fs.writeFileSync(watermarkedPath, outBuf);

  return { width: finalW, height: finalH, watermarked: settings.enabled };
}

export async function storeUploadedPropertyImage(
  dataUrl: string,
  settings: WatermarkSettings
): Promise<{
  mediaId: string;
  originalPath: string;
  watermarkedPath: string;
  mimeType: string;
  width: number;
  height: number;
  watermarked: boolean;
}> {
  ensureMediaDirectories();
  const { buffer, mime } = decodeBase64Image(dataUrl);
  if (buffer.length > 8 * 1024 * 1024) {
    throw new Error('Image exceeds maximum upload size (8MB).');
  }

  const mediaId = `med_${Date.now().toString(36)}_${crypto.randomBytes(5).toString('hex')}`;

  // Normalize & persist clean untouched original JPEG
  const originalImg = await Jimp.read(buffer);
  const originalBuf = await originalImg.getBuffer(JimpMime.jpeg, { quality: 92 });
  const originalPath = path.join(ORIGINALS_DIR, `${mediaId}.jpg`);
  const watermarkedPath = path.join(WATERMARKED_DIR, `${mediaId}.jpg`);

  fs.writeFileSync(originalPath, originalBuf);

  const meta = await applyOfficialWatermarkFromOriginal(originalPath, watermarkedPath, settings);

  return {
    mediaId,
    originalPath,
    watermarkedPath,
    mimeType: mime === 'image/png' ? 'image/jpeg' : mime,
    width: meta.width,
    height: meta.height,
    watermarked: meta.watermarked,
  };
}
