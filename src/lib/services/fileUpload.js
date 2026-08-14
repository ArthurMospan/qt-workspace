'use client';
import { auth } from '@/lib/firebase';
// src/lib/services/fileUpload.js

/**
 * Direct Cloudinary Upload 
 */
export async function uploadFileToCloudinary(file, folder, onProgress = null) {
  try {
    if (file.size > 25 * 1024 * 1024) throw new Error('File exceeds the 25 MB limit');
    if (!folder) throw new Error('An organization-scoped upload folder is required');
    const ext = file.name.split('.').pop()?.toLowerCase();
    const baseName = file.name.substring(0, file.name.lastIndexOf('.')).replace(/[^a-zA-Z0-9]/g, '_');
    const public_id = `${Date.now()}_${baseName}`;
    
    let resource_type = 'raw';
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'heic', 'heif', 'tiff', 'bmp'].includes(ext) || file.type.startsWith('image/')) {
      resource_type = 'image';
    } else if (
      ['mp4', 'mov', 'avi', 'mkv', 'webm', 'mp3', 'm4a', 'wav', 'ogg', 'oga', 'aac', 'flac'].includes(ext)
      || file.type.startsWith('video/')
      || file.type.startsWith('audio/')
    ) {
      // Cloudinary serves audio through the `video` resource type. Uploading
      // OGG as `raw` loses the useful audio content-type and Gemini rejects it.
      resource_type = 'video';
    }

    const token = await auth.currentUser?.getIdToken();
    if (!token) throw new Error('Authentication is required for uploads');

    const signRes = await fetch('/api/upload/sign', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ 
        params: { folder, public_id } 
      }),
    });

    if (!signRes.ok) throw new Error('Failed to get upload signature');
    const { signature, timestamp, apiKey, cloudName, overwrite, deliveryType = 'upload' } = await signRes.json();

    const formData = new FormData();
    formData.append('file', file);
    formData.append('api_key', apiKey);
    formData.append('timestamp', timestamp);
    formData.append('signature', signature);
    formData.append('folder', folder);
    formData.append('public_id', public_id);
    formData.append('overwrite', String(overwrite));
    if (deliveryType === 'authenticated') formData.append('type', deliveryType);

    // XHR rather than fetch: it is the only way to observe real upload
    // progress. The previous helper jumped straight from 20% to 100%, so every
    // progress bar in the app was decorative.
    const data = await new Promise((resolve, reject) => {
      const request = new XMLHttpRequest();
      request.open('POST', `https://api.cloudinary.com/v1_1/${cloudName}/${resource_type}/upload`);
      if (onProgress) {
        request.upload.onprogress = progressEvent => {
          if (!progressEvent.lengthComputable) return;
          onProgress(Math.round((progressEvent.loaded / progressEvent.total) * 100));
        };
      }
      request.onload = () => {
        if (request.status < 200 || request.status >= 300) {
          reject(new Error(`Cloudinary upload error: ${request.status} ${request.statusText}`));
          return;
        }
        try {
          resolve(JSON.parse(request.responseText));
        } catch {
          reject(new Error('Cloudinary returned an unreadable response'));
        }
      };
      request.onerror = () => reject(new Error('Cloudinary upload failed'));
      request.onabort = () => reject(new Error('Cloudinary upload aborted'));
      request.send(formData);
    });
    let downloadUrl = data.secure_url;
    if (data.resource_type === 'image') {
      downloadUrl = data.secure_url.replace('/upload/', '/upload/f_auto,q_auto/');
    }

    return {
      downloadUrl,
      storagePath: data.public_id,
      resourceType: data.resource_type,
      deliveryType,
      format: data.format || ext || '',
    };
  } catch (err) {
    console.error('Upload Error:', err);
    throw err;
  }
}

/**
 * Deletes a previously uploaded Cloudinary asset via the signed server route.
 * Best-effort: a failure here must not block removing the message itself, so
 * callers may swallow the rejection. Needs the attachment's storagePath
 * (Cloudinary public_id) and resourceType captured at upload time.
 */
export async function deleteFileFromCloudinary(storagePath, resourceType = 'image', deliveryType = 'upload') {
  if (!storagePath) return false;
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error('Authentication is required to delete files');

  const res = await fetch('/api/upload/delete', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ storagePath, resourceType, deliveryType }),
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    throw new Error(detail.error || `Cloudinary delete failed: ${res.statusText}`);
  }
  return true;
}
