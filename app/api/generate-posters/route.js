import { NextResponse } from 'next/server';
import { readJson, requireAdmin, validateActivity } from '@/lib/api';
import { checkJob, fetchImageDataUri, isValidJobId } from '@/lib/comfy';
import { getActivityKind } from '@/lib/posters/activities';
import { composePoster } from '@/lib/posters/compose';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Reject anything but an embedded image for the QR.
 *
 * The value is interpolated into poster HTML that gets uploaded to Drive and
 * opened elsewhere, so a remote URL here would turn every printed poster into a
 * callback to a third-party host.
 */
function safeQrCodeUrl(value) {
  const url = String(value ?? '');
  return /^data:image\/(png|jpeg|gif|webp|svg\+xml);base64,[A-Za-z0-9+/=]+$/.test(url)
    ? url
    : null;
}

/**
 * POST /api/generate-posters  { activity, qrCodeUrl, jobId }
 *   -> { posters: [{ html, ... }] }
 *
 * The render already happened — the browser queued it through /api/generate-image
 * and waited. This fetches the finished poster and lays the QR code and the
 * college name over it, which is fast enough to redo on every publish. That
 * matters: publishing rewrites the QR to point at the registration form, and
 * re-composing from the same job id gets a correct QR without spending the GPU
 * again.
 */
export async function POST(request) {
  const { error: authError } = await requireAdmin();
  if (authError) return authError;

  const { body, error: bodyError } = await readJson(request);
  if (bodyError) return bodyError;

  const { activity, qrCodeUrl, jobId } = body ?? {};

  const invalid = validateActivity(activity);
  if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });

  if (!isValidJobId(jobId)) {
    return NextResponse.json({ error: 'A valid poster job id is required.' }, { status: 400 });
  }

  const qr = safeQrCodeUrl(qrCodeUrl);
  const kind = getActivityKind(activity.title);

  try {
    const job = await checkJob(jobId);

    if (job.state === 'error') {
      return NextResponse.json({ error: job.message, code: 'COMFY_JOB_FAILED' }, { status: 502 });
    }
    if (job.state !== 'done') {
      // Also what a job that has aged out of ComfyUI's history looks like —
      // that history is in memory, so restarting ComfyUI loses it. The client
      // treats this as "render it again".
      return NextResponse.json(
        {
          error:
            'That poster is no longer available — ComfyUI may have been restarted. ' +
            'Generate it again.',
          code: 'COMFY_JOB_MISSING',
        },
        { status: 409 },
      );
    }

    const imageDataUri = await fetchImageDataUri(job.image);
    const html = composePoster({ activity, imageDataUri, qrCodeUrl: qr });

    return NextResponse.json({
      posters: [
        {
          html,
          colorScheme: 'AI poster',
          variationNumber: 1,
          source: 'comfy',
          jobId,
        },
      ],
      failedCount: 0,
      mode: 'comfy',
      activityKind: kind.label,
    });
  } catch (err) {
    console.error('[generate-posters] Compose failed:', err);
    return NextResponse.json(
      { error: 'Could not fetch the generated poster.', code: 'COMFY_UNAVAILABLE' },
      { status: 503 },
    );
  }
}
