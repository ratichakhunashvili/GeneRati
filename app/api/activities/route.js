import { NextResponse } from 'next/server';
import { readJson, requireSession } from '@/lib/api';
import { driveClient, googleErrorMessage, readActivityIndex, writeActivityIndex } from '@/lib/google';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// Only these fields are persisted. Whitelisting keeps generated poster HTML —
// which is large and reproducible — out of the index file.
const PERSISTED_FIELDS = [
  'id',
  'title',
  'date',
  'time',
  'location',
  'createdAt',
  'folderId',
  'folderLink',
  'formId',
  'formLink',
  'formEditLink',
  'posterCount',
  'posterSource',
];

function pickPersisted(activity) {
  const clean = {};
  for (const field of PERSISTED_FIELDS) {
    if (activity?.[field] !== undefined) clean[field] = activity[field];
  }
  return clean;
}

/** Load the activity list saved in the signed-in user's Drive. */
export async function GET() {
  const { session, error } = await requireSession();
  if (error) return error;

  try {
    const drive = driveClient(session.accessToken);
    const index = await readActivityIndex(drive);
    return NextResponse.json({
      activities: index.activities.map(pickPersisted),
      modifiedTime: index.modifiedTime,
      corrupt: Boolean(index.corrupt),
    });
  } catch (err) {
    console.error('[activities] Failed to read index:', err);
    return NextResponse.json({ error: googleErrorMessage(err) }, { status: 500 });
  }
}

/** Replace the saved activity list in Drive. */
export async function PUT(request) {
  const { session, error: authError } = await requireSession();
  if (authError) return authError;

  const { body, error: bodyError } = await readJson(request);
  if (bodyError) return bodyError;

  if (!Array.isArray(body?.activities)) {
    return NextResponse.json({ error: 'activities must be an array' }, { status: 400 });
  }
  if (body.activities.length > 500) {
    return NextResponse.json({ error: 'Too many activities to save' }, { status: 413 });
  }

  try {
    const drive = driveClient(session.accessToken);
    const saved = await writeActivityIndex(drive, body.activities.map(pickPersisted));
    return NextResponse.json({ success: true, modifiedTime: saved.modifiedTime ?? null });
  } catch (err) {
    console.error('[activities] Failed to write index:', err);
    return NextResponse.json({ error: googleErrorMessage(err) }, { status: 500 });
  }
}
