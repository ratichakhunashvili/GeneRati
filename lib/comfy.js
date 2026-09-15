// Client for a self-hosted ComfyUI instance running FLUX.1-schnell.
//
// SERVER ONLY. COMFY_API_KEY is the single secret standing between the public
// internet and a GPU on a home machine, so it must never reach the browser:
//
//   * never import this module from a file carrying 'use client'
//   * never rename these env vars to NEXT_PUBLIC_*, which would inline the key
//     into the client bundle
//   * the browser never sees COMFY_URL either — image bytes are proxied through
//     this app's own API routes
//
// The guard below turns a mistake into an immediate, obvious crash rather than
// a silently published key.
//
// Nothing here ever waits for a render. ComfyUI takes about a minute per poster
// and a Vercel function is capped at 60s, so /prompt queues and returns a job
// id and the browser polls. ComfyUI's own history is the job store, so there is
// no database.

import crypto from 'node:crypto';
import workflowTemplate from './workflow_flux.json';

if (typeof window !== 'undefined') {
  throw new Error(
    'lib/comfy.js was imported into client code. It holds the ComfyUI API key and must stay server-side.',
  );
}

// Node ids from workflow_flux.json. ComfyUI renumbers nodes when a workflow is
// re-exported from its UI, so check these first if generation starts failing
// after someone edits the workflow there.
const PROMPT_NODE = '20';
const LATENT_NODE = '30';
const SAMPLER_NODE = '40';

const MAX_PROMPT_CHARS = 2000;

/**
 * Render size.
 *
 * FLUX is trained around 1 megapixel in multiples of 64. 896x1280 is 1.15 MP at
 * a 0.700 ratio, against A3's 0.708 — close enough that the poster needs no
 * cropping. Larger would be better for print but this card has 6 GB of VRAM.
 */
const DEFAULT_WIDTH = 896;
const DEFAULT_HEIGHT = 1280;

/**
 * FLUX.1-schnell is step-distilled: 4 steps is what it was trained for, and
 * more steps make it worse rather than better, unlike ordinary diffusion models.
 */
const DEFAULT_STEPS = 4;

/** A render outlives a poll, but a dead tunnel must not hang a function. */
const REQUEST_TIMEOUT_MS = 20_000;

function config() {
  const baseUrl = (process.env.COMFY_URL || '').trim().replace(/\/+$/, '');
  const apiKey = (process.env.COMFY_API_KEY || '').trim();
  if (!baseUrl || !apiKey) {
    throw new Error('COMFY_URL and COMFY_API_KEY must be set in the server environment.');
  }
  return { baseUrl, apiKey };
}

/** Whether this deployment has the image service configured at all. */
export function comfyConfigured() {
  return Boolean((process.env.COMFY_URL || '').trim() && (process.env.COMFY_API_KEY || '').trim());
}

function authHeaders(apiKey, extra = {}) {
  return { Authorization: `Bearer ${apiKey}`, ...extra };
}

/**
 * Queue a poster render. Returns ComfyUI's prompt_id, which is our job id.
 *
 * Returns as soon as the job is queued — it does not wait for the image.
 */
export async function queuePoster(prompt) {
  const text = String(prompt ?? '').trim();
  if (!text) throw new Error('The poster prompt was empty.');
  if (text.length > MAX_PROMPT_CHARS) {
    throw new Error(`The poster prompt is too long (max ${MAX_PROMPT_CHARS} characters).`);
  }

  const { baseUrl, apiKey } = config();

  // structuredClone, not a spread: the imported JSON is a module-level object
  // shared by every request, and a shallow copy would let one request's prompt
  // leak into the next.
  const workflow = structuredClone(workflowTemplate);

  workflow[PROMPT_NODE].inputs.text = text;
  // A fresh seed per request. Re-rolling a poster whose date came out wrong is
  // the expected workflow, so an identical result would make the button useless.
  workflow[SAMPLER_NODE].inputs.seed = crypto.randomInt(0, 2 ** 31 - 1);
  workflow[SAMPLER_NODE].inputs.steps = DEFAULT_STEPS;
  workflow[LATENT_NODE].inputs.width = DEFAULT_WIDTH;
  workflow[LATENT_NODE].inputs.height = DEFAULT_HEIGHT;

  const res = await fetch(`${baseUrl}/prompt`, {
    method: 'POST',
    headers: authHeaders(apiKey, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({ prompt: workflow, client_id: crypto.randomUUID() }),
    cache: 'no-store',
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (res.status === 401) {
    // Almost always the key: Caddy was rotated but COMFY_API_KEY was not, or
    // the request hit a path outside the Caddyfile's allowlist.
    throw new Error('The image service rejected the credentials.');
  }
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    console.error('[comfy] /prompt failed', res.status, detail.slice(0, 800));
    throw new Error('The image service refused the request.');
  }

  const data = await res.json();
  if (!data?.prompt_id) throw new Error('The image service returned no job id.');
  return { jobId: data.prompt_id };
}

/**
 * Check a job.
 *
 * Returns `{ state: 'pending' }` both while queued and while the history entry
 * has not appeared yet — from the caller's side those are the same thing.
 */
export async function checkJob(jobId) {
  const { baseUrl, apiKey } = config();

  const res = await fetch(`${baseUrl}/history/${encodeURIComponent(jobId)}`, {
    headers: authHeaders(apiKey),
    cache: 'no-store',
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error('Could not reach the image service.');

  const history = await res.json();
  const entry = history?.[jobId];
  if (!entry) return { state: 'pending' };

  if (entry.status?.status_str === 'error') {
    const messages = entry.status?.messages ?? [];
    const failure = messages.find(([type]) => type === 'execution_error');
    console.error('[comfy] job failed', jobId, JSON.stringify(entry.status).slice(0, 800));
    return {
      state: 'error',
      message: failure?.[1]?.exception_message || 'The render failed on the GPU.',
    };
  }

  for (const output of Object.values(entry.outputs ?? {})) {
    const img = output?.images?.[0];
    if (img?.filename) {
      return {
        state: 'done',
        image: {
          filename: img.filename,
          subfolder: img.subfolder ?? '',
          type: img.type ?? 'output',
        },
      };
    }
  }
  return { state: 'pending' };
}

/** Download the rendered poster. Only ever called server-side. */
export async function fetchImage(image) {
  const { baseUrl, apiKey } = config();
  const url =
    `${baseUrl}/view?` +
    new URLSearchParams({
      filename: image.filename,
      subfolder: image.subfolder,
      type: image.type,
    });

  const res = await fetch(url, {
    headers: authHeaders(apiKey),
    cache: 'no-store',
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error('Could not download the generated poster.');
  return res;
}

/**
 * Download the rendered poster as a data URI, ready to embed.
 *
 * The finished poster embeds its image rather than linking it, because the file
 * is uploaded to Drive and later opened on machines that cannot reach this app —
 * or the tunnel. A linked image would print blank.
 */
export async function fetchImageDataUri(image) {
  const res = await fetchImage(image);
  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.length === 0) throw new Error('The generated poster was empty.');
  const mimeType = res.headers.get('content-type')?.split(';')[0] || 'image/png';
  return `data:${mimeType};base64,${buffer.toString('base64')}`;
}

/** A job id is a UUID from ComfyUI; anything else is not worth a round trip. */
export function isValidJobId(id) {
  return /^[a-zA-Z0-9-]{8,64}$/.test(String(id ?? ''));
}
