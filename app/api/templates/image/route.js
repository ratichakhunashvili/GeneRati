import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/api';
import { driveClient, googleErrorMessage, readTemplateIndex } from '@/lib/google';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/**
 * Serve a template's background image for on-screen previews.
 *
 * Takes the template id and looks the Drive file id up in the index, rather
 * than accepting a Drive file id directly — otherwise this route would proxy
 * arbitrary files from the signed-in user's Drive.
 */
export async function GET(request) {
  const { session, error } = await requireSession();
  if (error) return error;

  const id = new URL(request.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

  try {
    const drive = driveClient(session.accessToken);
    const { templates } = await readTemplateIndex(drive);
    const template = templates.find((t) => t.id === id);
    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    const res = await drive.files.get(
      { fileId: template.fileId, alt: 'media' },
      { responseType: 'arraybuffer' },
    );

    return new Response(Buffer.from(res.data), {
      headers: {
        'Content-Type': template.mimeType || 'image/jpeg',
        // Private: this is the signed-in user's own file, so it must never be
        // held in a shared cache. Immutable because a template's image is never
        // replaced — editing only changes the layout.
        'Cache-Control': 'private, max-age=86400, immutable',
      },
    });
  } catch (err) {
    console.error('[templates/image] Failed to read image:', err);
    return NextResponse.json({ error: googleErrorMessage(err) }, { status: 500 });
  }
}
