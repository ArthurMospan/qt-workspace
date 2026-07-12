// src/app/api/upload/sign/route.js
import { NextResponse } from 'next/server';
import { v2 as cloudinary } from 'cloudinary';
import { authenticateRequest, enforceRateLimit } from '@/lib/server/firebaseAdmin';

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

    const { params } = await req.json();
    const folder = params?.folder;
    const publicId = params?.public_id;
    if (
      typeof folder !== 'string' ||
      !/^quickteam\/[a-zA-Z0-9/_-]{1,180}$/.test(folder) ||
      typeof publicId !== 'string' ||
      !/^[a-zA-Z0-9_-]{1,160}$/.test(publicId)
    ) {
      return NextResponse.json({ error: 'Invalid upload parameters' }, { status: 400 });
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
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
