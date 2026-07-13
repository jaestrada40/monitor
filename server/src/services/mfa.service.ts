import { generateSecret, generateURI, verify } from 'otplib';
import QRCode from 'qrcode';

export function generateMfaSecret(email: string): { secret: string; otpauthUrl: string } {
  const secret = generateSecret();
  const otpauthUrl = generateURI({ issuer: 'MonitorPro', label: email, secret });
  return { secret, otpauthUrl };
}

export async function verifyMfaToken(secret: string, token: string): Promise<boolean> {
  try {
    const result = await verify({ secret, token });
    return result.valid;
  } catch {
    return false;
  }
}

export function generateQrCodeDataUrl(otpauthUrl: string): Promise<string> {
  return QRCode.toDataURL(otpauthUrl);
}
