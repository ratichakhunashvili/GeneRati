import { NextResponse } from 'next/server';
import { readJson, requireSession } from '@/lib/api';
import {
  createActivityFolder,
  driveClient,
  googleErrorMessage,
  uploadTextFile,
} from '@/lib/google';
import { slugify } from '@/lib/format';

export const maxDuration = 60;

// A built-in poster is ~10KB, but one built from a user template embeds its
// background image as base64 and runs to a couple of megabytes. This has to
// clear that comfortably while still refusing anything absurd.
const MAX_FILE_BYTES = 12 * 1024 * 1024;

export async function POST(request) {
  const { session, error: authError } = await requireSession();
  if (authError) return authError;

  const { body, error: bodyError } = await readJson(request);
  if (bodyError) return bodyError;

  const drive = driveClient(session.accessToken);
  const { action } = body ?? {};

  try {
    if (action === 'createFolder') {
      const title = String(body.activityTitle ?? '').trim();
      if (!title) {
        return NextResponse.json({ error: 'activityTitle is required' }, { status: 400 });
      }

      const folder = await createActivityFolder(drive, slugify(title));
      return NextResponse.json({
        success: true,
        folderId: folder.id,
        folderLink: folder.webViewLink,
        usedFallback: Boolean(folder.usedFallback),
        fallbackReason: folder.fallbackReason ?? null,
      });
    }

    if (action === 'uploadFile') {
      const { fileName, folderId, fileContent } = body;

      if (!String(fileName ?? '').trim()) {
        return NextResponse.json({ error: 'fileName is required' }, { status: 400 });
      }
      if (!String(folderId ?? '').trim()) {
        return NextResponse.json({ error: 'folderId is required' }, { status: 400 });
      }
      if (typeof fileContent !== 'string' || fileContent.length === 0) {
        return NextResponse.json({ error: 'fileContent must be a non-empty string' }, { status: 400 });
      }
      if (Buffer.byteLength(fileContent, 'utf8') > MAX_FILE_BYTES) {
        return NextResponse.json({ error: 'File is too large to upload' }, { status: 413 });
      }

      const file = await uploadTextFile(drive, {
        name: slugify(fileName).endsWith('.html') ? slugify(fileName) : `${slugify(fileName)}.html`,
        folderId,
        content: fileContent,
      });

      return NextResponse.json({
        success: true,
        fileId: file.id,
        fileLink: file.webViewLink,
      });
    }

    return NextResponse.json(
      { error: `Unknown action: ${action ?? '(none)'}` },
      { status: 400 },
    );
  } catch (err) {
    console.error('[drive-integration] Drive call failed:', err);
    return NextResponse.json({ error: googleErrorMessage(err) }, { status: 500 });
  }
}
