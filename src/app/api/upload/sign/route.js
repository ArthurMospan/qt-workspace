// src/app/api/upload/sign/route.js
import { NextResponse } from 'next/server';
import { v2 as cloudinary } from 'cloudinary';
import { authenticateRequest, enforceRateLimit } from '@/lib/server/firebaseAdmin';
import { readJsonBody, routeErrorResponse } from '@/lib/server/apiErrors';
import {
  callerBelongsToPathOrganization,
  isSafeUploadFolder,
  organizationIdFromPath,
} from '@/lib/server/uploadPaths';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function POST(req) {
  try {
    const authorization = await authenticateRequest(req);
    if (authorization.error) {
      return NextResponse.json({ error: authorization.error }, { status: authorization.status });
    }
    if (!(await enforceRateLimit('upload', authorization.user.uid, 30, 60))) {
      return NextResponse.json({ error: 'Too many upload requests' }, { status: 429 });
    }

    const { params } = await readJsonBody(req);
    const folder = params?.folder;
    const publicId = params?.public_id;
    if (
      !isSafeUploadFolder(folder) ||
      typeof publicId !== 'string' ||
      !/^[a-zA-Z0-9_-]{1,160}$/.test(publicId)
    ) {
      return NextResponse.json({ error: 'Invalid upload parameters' }, { status: 400 });
    }

    // Signing an organization folder for a non-member would let one tenant
    // write into another tenant's namespace, which the delete route then
    // treats as owned by that other tenant.
    const organizationId = organizationIdFromPath(folder);
    if (!organizationId) {
      return NextResponse.json({ error: 'Upload folder is not organization-scoped' }, { status: 403 });
    }
    if (!(await callerBelongsToPathOrganization(authorization.user.uid, organizationId))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const timestamp = Math.round(new Date().getTime() / 1000);
    
    const signature = cloudinary.utils.api_sign_request(
      { folder, public_id: publicId, overwrite: false, timestamp },
      process.env.CLOUDINARY_API_SECRET
    );

    return NextResponse.json({
      signature,
      timestamp,
      overwrite: false,
      apiKey: process.env.CLOUDINARY_API_KEY,
      cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    });
  } catch (error) {
    return routeErrorResponse(error, {
      context: 'upload-sign',
      fallbackMessage: 'Не вдалося підготувати завантаження',
    });
  }
}
