import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/api';
import { checkJob, fetchImage, isValidJobId } from '@/lib/comfy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/**
 * GET /api/generate-image/[id]/image -> the rendered image bytes.
 *
 * This route is the reason the browser never needs the tunnel address or the
 * Bearer key: an <img src> points here, and this handler makes the authenticated
 * fetch and pipes the bytes through.
 *
 * It serves the raw artwork for on-screen preview. The poster that gets printed
 * and uploaded to Drive embeds the same image as a data URI instead — see
 * /api/generate-posters — because a linked image would print blank on a machine
 * that cannot reach this app.
 */
export async function GET(_request, { params }) {
  const { error: authError } = await requireAdmin();
  if (authError) return authError;

  const { id } = params;
  if (!isValidJobId(id)) {
    return NextResponse.json({ error: 'Bad job id.' }, { status: 400 });
  }

  try {
    const job = await checkJob(id);
    if (job.state === 'error') {
      return NextResponse.json({ error: job.message }, { status: 502 });
    }
    if (job.state !== 'done') {
      return NextResponse.json({ error: 'That image is not ready yet.' }, { status: 409 });
    }

    const upstream = await fetchImage(job.image);

    return new Response(upstream.body, {
      status: 200,
      headers: {
        'Content-Type': upstream.headers.get('content-type') || 'image/png',
        // A job id renders exactly one image and never changes, so this is safe
        // to keep forever. Private, because it is not meant for a shared cache.
        'Cache-Control': 'private, max-age=31536000, immutable',
        'Content-Disposition': `inline; filename="${job.image.filename.replace(/["\r\n]/g, '')}"`,
      },
    });
  } catch (err) {
    console.error('[generate-image/:id/image] Download failed:', err);
    return NextResponse.json(
      { error: 'Could not load the generated image.', code: 'COMFY_UNAVAILABLE' },
      { status: 503 },
    );
  }
}
