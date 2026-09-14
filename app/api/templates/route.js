import { NextResponse } from 'next/server';
import { readJson, requireSession } from '@/lib/api';
import {
  deleteDriveFile,
  driveClient,
  googleErrorMessage,
  readTemplateIndex,
  uploadTemplateImage,
  writeTemplateIndex,
} from '@/lib/google';
import { defaultLayout, sanitizeKeywords, sanitizeLayout, sanitizeName } from '@/lib/templates';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// A well-prepared upload is stored exactly as supplied rather than re-encoded,
// so this has to allow a real print-resolution design through. Anything larger
// was resized by the browser before it got here.
const MAX_IMAGE_BYTES = 16 * 1024 * 1024;
const MAX_TEMPLATES = 60;

const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

/** Decode a data URI into a Buffer, rejecting anything that is not an image. */
function decodeImage(dataUri) {
  const match = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(
    String(dataUri ?? ''),
  );
  if (!match) {
    return { error: 'The image must be a PNG, JPEG or WebP data URL.' };
  }
  const [, mimeType, base64] = match;
  if (!ALLOWED_TYPES.includes(mimeType)) {
    return { error: 'Unsupported image type.' };
  }

  const buffer = Buffer.from(base64, 'base64');
  if (buffer.length === 0) return { error: 'The image was empty.' };
  if (buffer.length > MAX_IMAGE_BYTES) {
    return { error: 'That image is too large. Try a smaller or more compressed file.' };
  }
  return { buffer, mimeType };
}

/** List every saved template (metadata only — images are fetched separately). */
export async function GET() {
  const { session, error } = await requireSession();
  if (error) return error;

  try {
    const drive = driveClient(session.accessToken);
    const index = await readTemplateIndex(drive);
    return NextResponse.json({ templates: index.templates, corrupt: index.corrupt });
  } catch (err) {
    console.error('[templates] Failed to read index:', err);
    return NextResponse.json({ error: googleErrorMessage(err) }, { status: 500 });
  }
}

/** Create a template from an uploaded image. */
export async function POST(request) {
  const { session, error: authError } = await requireSession();
  if (authError) return authError;

  const { body, error: bodyError } = await readJson(request);
  if (bodyError) return bodyError;

  const decoded = decodeImage(body?.imageDataUri);
  if (decoded.error) return NextResponse.json({ error: decoded.error }, { status: 400 });

  const name = sanitizeName(body?.name);
  const keywords = sanitizeKeywords(body?.keywords);

  try {
    const drive = driveClient(session.accessToken);
    const index = await readTemplateIndex(drive);

    if (index.templates.length >= MAX_TEMPLATES) {
      return NextResponse.json(
        { error: `You can store up to ${MAX_TEMPLATES} templates. Delete one first.` },
        { status: 409 },
      );
    }

    const extension = decoded.mimeType.split('/')[1].replace('jpeg', 'jpg');
    const fileId = await uploadTemplateImage(drive, {
      name: `${name}.${extension}`,
      mimeType: decoded.mimeType,
      buffer: decoded.buffer,
    });

    const template = {
      id: `tpl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name,
      keywords,
      fileId,
      mimeType: decoded.mimeType,
      bytes: decoded.buffer.length,
      layout: sanitizeLayout(body?.layout ?? defaultLayout()),
      createdAt: new Date().toISOString(),
    };

    await writeTemplateIndex(drive, [...index.templates, template]);
    return NextResponse.json({ success: true, template });
  } catch (err) {
    console.error('[templates] Failed to create template:', err);
    return NextResponse.json({ error: googleErrorMessage(err) }, { status: 500 });
  }
}

/** Update a template's name, keywords or layout. The image is never replaced. */
export async function PUT(request) {
  const { session, error: authError } = await requireSession();
  if (authError) return authError;

  const { body, error: bodyError } = await readJson(request);
  if (bodyError) return bodyError;

  const id = String(body?.id ?? '');
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

  try {
    const drive = driveClient(session.accessToken);
    const index = await readTemplateIndex(drive);
    const existing = index.templates.find((t) => t.id === id);
    if (!existing) {
      return NextResponse.json({ error: 'That template no longer exists.' }, { status: 404 });
    }

    const updated = {
      ...existing,
      name: body.name === undefined ? existing.name : sanitizeName(body.name, existing.name),
      keywords:
        body.keywords === undefined ? existing.keywords : sanitizeKeywords(body.keywords),
      layout: body.layout === undefined ? existing.layout : sanitizeLayout(body.layout),
      updatedAt: new Date().toISOString(),
    };

    await writeTemplateIndex(
      drive,
      index.templates.map((t) => (t.id === id ? updated : t)),
    );
    return NextResponse.json({ success: true, template: updated });
  } catch (err) {
    console.error('[templates] Failed to update template:', err);
    return NextResponse.json({ error: googleErrorMessage(err) }, { status: 500 });
  }
}

/** Delete a template and the image behind it. */
export async function DELETE(request) {
  const { session, error: authError } = await requireSession();
  if (authError) return authError;

  const id = new URL(request.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

  try {
    const drive = driveClient(session.accessToken);
    const index = await readTemplateIndex(drive);
    const existing = index.templates.find((t) => t.id === id);
    if (!existing) {
      return NextResponse.json({ error: 'That template no longer exists.' }, { status: 404 });
    }

    await writeTemplateIndex(
      drive,
      index.templates.filter((t) => t.id !== id),
    );

    // Removing the index entry is what actually deletes the template; a failure
    // to bin the image would only leave an orphan file, so it must not fail the
    // request.
    try {
      await deleteDriveFile(drive, existing.fileId);
    } catch (fileErr) {
      console.warn('[templates] Could not delete image:', googleErrorMessage(fileErr));
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[templates] Failed to delete template:', err);
    return NextResponse.json({ error: googleErrorMessage(err) }, { status: 500 });
  }
}
