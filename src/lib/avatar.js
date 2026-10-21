export const AVATAR_BUCKET = 'cadet-avatars';
export const MAX_AVATAR_SIZE = 2 * 1024 * 1024;

export function validateAvatarFile(file) {
  if (!file || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    throw new Error('Choose a JPG, PNG, or WebP photo.');
  }
  if (!file.size || file.size > MAX_AVATAR_SIZE) throw new Error('Choose a photo smaller than 2 MB.');
}

export async function prepareAvatar(file) {
  validateAvatarFile(file);
  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('This photo could not be opened. Please choose another image.'));
      img.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 256;
    const ctx = canvas.getContext('2d');
    if (!ctx || !image.naturalWidth || !image.naturalHeight) throw new Error('This photo could not be processed. Please try another image.');
    const side = Math.min(image.naturalWidth, image.naturalHeight);
    ctx.drawImage(image, (image.naturalWidth - side) / 2, (image.naturalHeight - side) / 2, side, side, 0, 0, 256, 256);
    return await new Promise((resolve, reject) => canvas.toBlob(blob => {
      if (blob?.type === 'image/webp') resolve(blob);
      else reject(new Error('Photo processing is unavailable. Try a current browser.'));
    }, 'image/webp', 0.85));
  } finally { URL.revokeObjectURL(url); }
}
