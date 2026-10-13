import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import type { UploadImage } from '@/api/endpoints';
import { UPLOAD_JPEG_QUALITY, uploadSize } from '@/domain/images';

/**
 * Re-encode a picked or captured photo as a JPEG the server accepts
 * (under 8 MiB and 20 megapixels; HEIC is not accepted at all).
 */
export async function prepareUpload(asset: { uri: string; width: number; height: number },
  highDetail = false): Promise<UploadImage & { dispose: () => void }> {
  const context = ImageManipulator.manipulate(asset.uri);
  const size = uploadSize(asset.width, asset.height, highDetail ? 2048 : undefined);
  if (size && (size.width !== asset.width || size.height !== asset.height)) context.resize(size);
  const rendered = await context.renderAsync();
  const saved = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: highDetail ? 0.9 : UPLOAD_JPEG_QUALITY });
  const file = new File(saved.uri);
  return {
    name: 'photo.jpg',
    type: 'image/jpeg',
    bytes: async () => new Uint8Array(await file.arrayBuffer()),
    dispose: () => { try { if (file.exists) file.delete(); } catch { /* Cache cleanup is best effort. */ } },
  };
}
