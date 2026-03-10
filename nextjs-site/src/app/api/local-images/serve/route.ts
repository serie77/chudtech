import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const MIME_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

const UPLOADS_DIR = path.join(process.cwd(), 'public', 'uploads');

export async function GET(request: NextRequest) {
  const filename = request.nextUrl.searchParams.get('file');

  // Support legacy ?path= param by extracting just the filename
  const legacyPath = request.nextUrl.searchParams.get('path');
  const resolvedFilename = filename || (legacyPath ? path.basename(legacyPath) : null);

  if (!resolvedFilename) {
    return NextResponse.json({ error: 'No filename provided' }, { status: 400 });
  }

  try {
    // Sanitize: only allow the basename (no directory traversal)
    const safeName = path.basename(resolvedFilename);
    const filePath = path.join(UPLOADS_DIR, safeName);

    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    const imageBuffer = fs.readFileSync(filePath);

    return new NextResponse(imageBuffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error) {
    console.error('Serve image error:', error);
    return NextResponse.json({ error: 'Failed to serve image' }, { status: 500 });
  }
}
