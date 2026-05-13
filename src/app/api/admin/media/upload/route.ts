import { auth } from '@/server/auth/nextauth';
import { env } from '@/server/env';
import { getMediaStorage, publicUrlFor } from '@/server/media/factory';
import { extFromContentType } from '@/server/media/content-type';
import { requireOwner, AuthorizationError } from '@/server/auth/guards';

const ACCEPTED_IMAGE = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
]);
const ACCEPTED_VIDEO = new Set([
  'video/mp4',
  'video/webm',
  'video/quicktime',
]);
// Per-kind size limits — images stay tight (Next/Image optimises further),
// videos get more headroom because hero loops at 1080p easily land in the
// 5–15MB range even with sane bitrates.
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_VIDEO_BYTES = 20 * 1024 * 1024;

/**
 * Admin-only multipart upload. Validates MIME + size per file, generates
 * content-hashed keys (`<prefix>/<nanoid>.<ext>`), and returns a partition
 * of `{uploaded, rejected}` so the client can surface per-file errors
 * without aborting the whole batch.
 */
export async function POST(req: Request): Promise<Response> {
  try {
    const session = await auth();
    requireOwner(session);
  } catch (e) {
    if (e instanceof AuthorizationError) return new Response('Forbidden', { status: 403 });
    throw e;
  }

  const url = new URL(req.url);
  const prefix = (url.searchParams.get('prefix') ?? 'misc').replace(/[^a-z0-9/_-]/gi, '');
  const form = await req.formData();
  const files = form.getAll('files').filter((f): f is File => f instanceof File);

  // Read storage env from process.env so tests can swap MEDIA_STORAGE_PATH
  // per-case (matches the Phase 7a test pattern; see media/factory.ts).
  const storage = getMediaStorage({
    MEDIA_STORAGE: process.env.MEDIA_STORAGE ?? 'local',
    MEDIA_STORAGE_PATH: process.env.MEDIA_STORAGE_PATH ?? env.MEDIA_STORAGE_PATH,
  });
  const uploaded: Array<{ key: string; url: string; originalFilename: string }> = [];
  const rejected: Array<{ filename: string; reason: string }> = [];

  for (const file of files) {
    const isImage = ACCEPTED_IMAGE.has(file.type);
    const isVideo = ACCEPTED_VIDEO.has(file.type);
    if (!isImage && !isVideo) {
      rejected.push({ filename: file.name, reason: `Unsupported MIME type: ${file.type}` });
      continue;
    }
    const limit = isVideo ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
    if (file.size > limit) {
      const mb = Math.round(limit / 1024 / 1024);
      rejected.push({ filename: file.name, reason: `File exceeds ${mb}MB limit` });
      continue;
    }
    const ext = extFromContentType(file.type);
    const id = randomId(12);
    const key = `${prefix}/${id}${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    await storage.put(key, buffer, file.type);
    uploaded.push({
      key,
      url: publicUrlFor(key, {
        NEXT_PUBLIC_SITE_URL: env.NEXT_PUBLIC_SITE_URL,
        MEDIA_PUBLIC_BASE_URL: env.MEDIA_PUBLIC_BASE_URL,
      }),
      originalFilename: file.name,
    });
  }

  return Response.json({ uploaded, rejected });
}

const ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
function randomId(n: number): string {
  let out = '';
  for (let i = 0; i < n; i++) out += ALPHA[Math.floor(Math.random() * ALPHA.length)];
  return out;
}
