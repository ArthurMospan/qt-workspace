'use client';
// src/lib/services/fileUpload.js

/**
 * Direct Cloudinary Upload 
 */
export async function uploadFileToCloudinary(file, folder = 'quickteam/avatars') {
  try {
    const ext = file.name.split('.').pop()?.toLowerCase();
    const baseName = file.name.substring(0, file.name.lastIndexOf('.')).replace(/[^a-zA-Z0-9]/g, '_');
    const public_id = `${Date.now()}_${baseName}`;
    
    let resource_type = 'raw';
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'heic', 'heif', 'tiff', 'bmp'].includes(ext) || file.type.startsWith('image/')) {
      resource_type = 'image';
    } else if (['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(ext) || file.type.startsWith('video/')) {
      resource_type = 'video';
    }

    const signRes = await fetch('/api/upload/sign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        params: { folder, public_id } 
      }),
    });

    if (!signRes.ok) throw new Error('Failed to get upload signature');
    const { signature, timestamp, apiKey, cloudName } = await signRes.json();

    const formData = new FormData();
    formData.append('file', file);
    formData.append('api_key', apiKey);
    formData.append('timestamp', timestamp);
    formData.append('signature', signature);
    formData.append('folder', folder);
    formData.append('public_id', public_id);

    const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/${resource_type}/upload`, {
      method: 'POST',
      body: formData,
    });

    if (!res.ok) {
      throw new Error(`Cloudinary upload error: ${res.statusText}`);
    }

    const data = await res.json();
    let downloadUrl = data.secure_url;
    if (data.resource_type === 'image') {
      downloadUrl = data.secure_url.replace('/upload/', '/upload/f_auto,q_auto/');
    }

    return { downloadUrl, storagePath: data.public_id };
  } catch (err) {
    console.error('Upload Error:', err);
    throw err;
  }
}
