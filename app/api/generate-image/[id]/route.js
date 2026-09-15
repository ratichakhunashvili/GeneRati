import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/api';
import { checkJob, isValidJobId } from '@/lib/comfy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/**
 * GET /api/generate-image/[id]
 *   -> { status: 'pending' }
 *   -> { status: 'done', imageUrl: '/api/generate-image/<id>/image' }
 *   -> { status: 'error', message }
 *
 * imageUrl points back at this app, never at the tunnel: the tunnel address and
 * the Bearer key stay on the server.
 *
 * On Next 14 `params` is a plain object. It becomes a Promise in Next 15, so
 * this destructuring needs an `await` if the project is ever upgraded.
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

    if (job.state === 'done') {
      return NextResponse.json({ status: 'done', imageUrl: `/api/generate-image/${id}/image` });
    }
    if (job.state === 'error') {
      return NextResponse.json({ status: 'error', message: job.message });
    }
    return NextResponse.json({ status: 'pending' });
  } catch (err) {
    console.error('[generate-image/:id] Poll failed:', err);
    return NextResponse.json(
      { error: 'Lost contact with the image service mid-render.', code: 'COMFY_UNAVAILABLE' },
      { status: 503 },
    );
  }
}
