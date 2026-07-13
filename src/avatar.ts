/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Deterministic initials avatar rendered as an inline SVG data URI — no network call,
// no third-party service, works offline. Used whenever a user has no uploaded photo.
const PALETTE = ['#4f46e5', '#0891b2', '#059669', '#d97706', '#dc2626', '#7c3aed', '#db2777'];

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function generateInitialsAvatar(seed: string): string {
  const initials = getInitials(seed);
  const color = PALETTE[hashString(seed) % PALETTE.length];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80">
    <rect width="80" height="80" rx="40" fill="${color}" />
    <text x="50%" y="50%" dy=".35em" text-anchor="middle" font-family="-apple-system,Segoe UI,Roboto,sans-serif" font-size="30" font-weight="700" fill="#ffffff">${initials}</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export function resolveAvatarUrl(user: { avatarUrl?: string; username: string }): string {
  return user.avatarUrl || generateInitialsAvatar(user.username);
}

// Resizes and compresses an uploaded image client-side before it's sent to the server —
// keeps the stored data URL small regardless of the original file size.
export function resizeImageToDataUrl(file: File, size = 128): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('read_failed'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('decode_failed'));
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('canvas_unavailable'));
          return;
        }
        // Cover-crop to a square so non-square uploads don't get squashed.
        const scale = Math.max(size / img.width, size / img.height);
        const w = img.width * scale;
        const h = img.height * scale;
        ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}
