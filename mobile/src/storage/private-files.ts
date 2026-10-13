import { Directory, File, Paths } from 'expo-file-system';

/** Private temporary copies in our sandbox; never the user's photo library. */
export function clearPrivateFiles() {
  for (const item of Paths.cache.list()) {
    const exportCsv = /^(?:foodlogger|biteflow)-\d{4}-\d{2}-\d{2}\.csv$/.test(item.name);
    // Some iOS ImagePicker versions put UUID-named copies directly in Caches.
    const pickedImage = /^[\da-f]{8}(-[\da-f]{4}){3}-[\da-f]{12}\.(jpe?g|png|heic|webp)$/i.test(item.name);
    const imageDirectory = item instanceof Directory && ['ImagePicker', 'ImageManipulator'].includes(item.name);
    if (imageDirectory || (item instanceof File && (exportCsv || pickedImage))) item.delete();
  }
}
