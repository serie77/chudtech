import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

// Settings stored as JSON files in data/settings/{hash}.json
const SETTINGS_DIR = path.join(process.cwd(), "data", "settings");

/** Same hash algorithm as the client store.ts */
function hashKey(apiKey: string): string {
  let hash = 0;
  for (let i = 0; i < apiKey.length; i++) {
    hash = ((hash << 5) - hash + apiKey.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(36);
}

function getApiKey(request: NextRequest): string | null {
  // Check cookie first, then Authorization header
  const cookie = request.cookies.get("chud-api-key")?.value;
  if (cookie) return cookie;
  const auth = request.headers.get("authorization");
  if (auth) return auth.replace("Bearer ", "");
  return null;
}

async function ensureDir() {
  await fs.mkdir(SETTINGS_DIR, { recursive: true });
}

/** GET /api/settings — load user settings */
export async function GET(request: NextRequest) {
  const apiKey = getApiKey(request);
  if (!apiKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const hash = hashKey(apiKey);
  const filePath = path.join(SETTINGS_DIR, `${hash}.json`);

  try {
    const data = await fs.readFile(filePath, "utf-8");
    return NextResponse.json(JSON.parse(data));
  } catch {
    // No settings saved yet
    return NextResponse.json({});
  }
}

/** POST /api/settings — save user settings */
export async function POST(request: NextRequest) {
  const apiKey = getApiKey(request);
  if (!apiKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const settings = await request.json();
    if (!settings || typeof settings !== "object") {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }

    const hash = hashKey(apiKey);
    await ensureDir();
    const filePath = path.join(SETTINGS_DIR, `${hash}.json`);
    await fs.writeFile(filePath, JSON.stringify(settings), "utf-8");

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  }
}
