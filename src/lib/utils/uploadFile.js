import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage } from '@/lib/firebase';

/**
 * Uploads a file to Firebase Storage.
 * @param {File} file - The file to upload
 * @param {string} path - The path in storage (e.g. `organizations/orgId/attachments/fileName`)
 * @param {Function} onProgress - Optional callback for upload progress (0 to 100)
 * @returns {Promise<Object>} Object containing file metadata (name, url, size, type)
 */
export async function uploadFile(file, path, onProgress = null) {
  if (!file) throw new Error('No file provided');

  const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
  const uniqueName = `${Date.now()}_${safeName}`;
  const fullPath = `${path}/${uniqueName}`;
  
  const storageRef = ref(storage, fullPath);
  const uploadTask = uploadBytesResumable(storageRef, file);

  return new Promise((resolve, reject) => {
    uploadTask.on(
      'state_changed',
      (snapshot) => {
        if (onProgress) {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          onProgress(progress);
        }
      },
      (error) => {
        reject(error);
      },
      async () => {
        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
        resolve({
          name: file.name,
          url: downloadURL,
          size: file.size,
          type: file.type
        });
      }
    );
  });
}
