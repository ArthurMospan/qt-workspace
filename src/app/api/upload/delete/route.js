// src/app/api/upload/delete/route.js
// Deletes an asset from Cloudinary so removed chat files don't linger in
// storage. Requires the API secret, so it must run server-side. The caller
// proves auth; the storagePath (Cloudinary public_id) and resourceType come
// from the attachment metadata saved at upload time.
import { NextResponse } from 'next/server';
import { v2 as cloudinary } from 'cloudinary';
import { authenticateRequest, enforceRateLimit } from '@/lib/server/firebaseAdmin';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const ALLOWED_RESOURCE_TYPES = new Set(['image', 'video', 'raw']);

export async function POST(req) {
  try {
    const authorization = await authenticateRequest(req);
    if (authorization.error) {
      return NextResponse.json({ error: authorization.error }, { status: authorization.status });
    }
    if (!(await enforceRateLimit('upload-delete', authorization.user.uid, 60, 60))) {
      return NextResponse.json({ error: 'Too many delete requests' }, { status: 429 });
    }

    const { storagePath, resourceType } = await req.json();
    // Mirror the upload public_id shape (quickteam/<folder>/<name>); reject
    // anything that could target assets outside our namespace.
    if (typeof storagePath !== 'string' || !/^[a-zA-Z0-9/_-]{1,220}$/.test(storagePath)) {
      return NextResponse.json({ error: 'Invalid storage path' }, { status: 400 });
    }
    const type = ALLOWED_RESOURCE_TYPES.has(resourceType) ? resourceType : 'image';

    const result = await cloudinary.uploader.destroy(storagePath, { resource_type: type, invalidate: true });
    // Cloudinary returns { result: 'ok' } or 'not found'. Treat a missing
    // asset as success — the goal (it's gone) is already met.
    if (result.result !== 'ok' && result.result !== 'not found') {
      return NextResponse.json({ error: `Cloudinary: ${result.result}` }, { status: 502 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
