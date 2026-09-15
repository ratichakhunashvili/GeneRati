import { NextResponse } from 'next/server';
import { readJson, requireAdmin, validateActivity } from '@/lib/api';
import { comfyConfigured, queuePoster } from '@/lib/comfy';
import { buildPosterPrompt } from '@/lib/posterPrompt';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Queueing is a single fast round trip; the render happens after this returns.
export const maxDuration = 30;

/**
 * POST /api/generate-image  { activity, variation? }
 *   -> 202 { jobId }
 *
 * The prompt is built here from the activity's own fields rather than accepted
 * from the client. There is no design brief to supply — the activity data is
 * the whole input — and building it server-side keeps one definition of what a
 * poster looks like instead of trusting whatever the browser sends.
 *
 * Returns the moment ComfyUI accepts the job. The browser then polls
 * GET /api/generate-image/<jobId>. That split is what keeps the feature inside
 * Vercel's 60s function cap: a render takes about a minute on its own.
 */
export async function POST(request) {
  const { error: authError } = await requireAdmin();
  if (authError) return authError;

  if (!comfyConfigured()) {
    return NextResponse.json(
      {
        error:
          'The poster generator is not configured on this deployment. Set COMFY_URL and ' +
          'COMFY_API_KEY in the server environment.',
        code: 'COMFY_NOT_CONFIGURED',
      },
      { status: 501 },
    );
  }

  const { body, error: bodyError } = await readJson(request);
  if (bodyError) return bodyError;

  const { activity, variation } = body ?? {};

  const invalid = validateActivity(activity);
  if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });

  try {
    const prompt = buildPosterPrompt(activity, variation);
    const { jobId } = await queuePoster(prompt);
    return NextResponse.json({ jobId }, { status: 202 });
  } catch (err) {
    console.error('[generate-image] Queueing failed:', err);
    return NextResponse.json(
      {
        error:
          'The poster generator is unreachable. Check that ComfyUI, Caddy and cloudflared are ' +
          'running, and that COMFY_URL still matches the current tunnel address.',
        code: 'COMFY_UNAVAILABLE',
      },
      { status: 503 },
    );
  }
}
