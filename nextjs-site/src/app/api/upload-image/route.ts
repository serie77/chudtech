import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const UPLOADS_DIR = path.join(process.cwd(), 'public', 'uploads');
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.svg', '.ico'];

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'File too large (max 10MB)' }, { status: 400 });
    }

    const ext = path.extname(file.name).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return NextResponse.json({ error: `Invalid file type: ${ext}` }, { status: 400 });
    }

    // Ensure uploads dir exists
    if (!fs.existsSync(UPLOADS_DIR)) {
      fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    }

    // Sanitize filename: remove path separators, keep it clean
    let safeName = file.name.replace(/[/\\:*?"<>|]/g, '_');

    // If file already exists, add a numeric suffix
    let finalPath = path.join(UPLOADS_DIR, safeName);
    if (fs.existsSync(finalPath)) {
      const base = path.basename(safeName, ext);
      let counter = 1;
      while (fs.existsSync(finalPath)) {
        safeName = `${base}_${counter}${ext}`;
        finalPath = path.join(UPLOADS_DIR, safeName);
        counter++;
      }
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(finalPath, buffer);

    return NextResponse.json({
      success: true,
      filename: safeName,
      name: safeName,
      nameWithoutExt: path.basename(safeName, ext),
      size: file.size,
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}

// DELETE endpoint to remove an uploaded image
export async function DELETE(request: NextRequest) {
  try {
    const { filename } = await request.json();

    if (!filename) {
      return NextResponse.json({ error: 'No filename provided' }, { status: 400 });
    }

    const safeName = path.basename(filename);
    const filePath = path.join(UPLOADS_DIR, safeName);

    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    fs.unlinkSync(filePath);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete error:', error);
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 });
  }
}
