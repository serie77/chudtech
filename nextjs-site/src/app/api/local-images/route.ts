import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.svg', '.ico'];

// Universal uploads directory — shared across all users
const UPLOADS_DIR = path.join(process.cwd(), 'public', 'uploads');

export async function GET(request: NextRequest) {
  const filter = request.nextUrl.searchParams.get('filter') || '';

  try {
    // Ensure uploads dir exists
    if (!fs.existsSync(UPLOADS_DIR)) {
      fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    }

    const entries = fs.readdirSync(UPLOADS_DIR, { withFileTypes: true });

    let imageFiles = entries
      .filter(entry => entry.isFile())
      .filter(entry => {
        const ext = path.extname(entry.name).toLowerCase();
        return IMAGE_EXTENSIONS.includes(ext);
      })
      .map(entry => {
        const filePath = path.join(UPLOADS_DIR, entry.name);
        const fileStat = fs.statSync(filePath);
        return {
          name: entry.name,
          nameWithoutExt: path.basename(entry.name, path.extname(entry.name)),
          filename: entry.name,
          size: fileStat.size,
          modifiedAt: fileStat.mtime.toISOString(),
          extension: path.extname(entry.name).toLowerCase(),
        };
      });

    if (filter.trim()) {
      const filterLower = filter.toLowerCase();
      imageFiles = imageFiles.filter(f =>
        f.nameWithoutExt.toLowerCase().includes(filterLower)
      );
    }

    imageFiles.sort((a, b) =>
      new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime()
    );

    return NextResponse.json({
      images: imageFiles,
      total: imageFiles.length,
    });
  } catch (error) {
    console.error('Local images error:', error);
    return NextResponse.json({ error: 'Failed to read uploads folder' }, { status: 500 });
  }
}
