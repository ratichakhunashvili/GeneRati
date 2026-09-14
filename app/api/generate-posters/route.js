import { NextResponse } from 'next/server';
import { readJson, requireSession, validateActivity } from '@/lib/api';
import { getSchemes } from '@/lib/posters/schemes';
import { buildTemplatePosters } from '@/lib/posters/templates';

// Vercel's free Hobby plan caps a function at 60s. The template path returns in
// milliseconds; only the optional AI path comes close to this.
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

function buildPrompt(activity, scheme, variation, qrCodeUrl) {
  return `Design a single event poster as one self-contained HTML document.

EVENT
Title: ${activity.title}
Date: ${activity.date}
Time: ${activity.time}
Location: ${activity.location}
Organizer: SkillWill College

PALETTE (${scheme.name})
Primary ${scheme.primary} / Accent ${scheme.accent} / Background ${scheme.secondary}

CANVAS
Exactly 794x1123 CSS pixels (A4 at 96dpi), portrait. Wrap everything in a single
.poster div with those fixed dimensions. Include @page { size: A4; margin: 0 }
and a @media print block so it prints edge to edge with no scaling.

LAYOUT, top to bottom
1. Title — very large, heavy weight, primary color, 1-2 lines, tight leading.
2. A thin accent rule or brush shape beneath it.
3. An info row: date, time, location. Each in a rounded pill with a small
   inline-SVG icon (calendar, clock, map pin). Never use emoji.
${
  qrCodeUrl
    ? `4. QR code — the exact img tag below, unchanged, on a white rounded card
   with a ${scheme.primary} border about 12px thick, horizontally centered:
   <img src="${qrCodeUrl}" width="220" height="220" alt="Register" />`
    : '4. Skip the QR code for this poster; leave the space for the call to action.'
}
5. A short call-to-action line under the QR in ${scheme.accent}.
6. Footer: "ორგანიზატორი: SkillWill College" in small light text.

TEXT
Georgian text must be reproduced exactly as given. Use a font stack that
includes 'Noto Sans Georgian', 'BPG Arial' and Sylfaen so Georgian renders.

STYLE
Dark ${scheme.secondary} base with a subtle CSS gradient and a few soft radial
glows in ${scheme.primary}. Depth via box-shadow and layering only — no external
images, no icon fonts, no web font imports. Use system sans-serif stacks.
Everything must render offline from this file alone.

This is variation ${variation} of 3 — give it a distinct composition from a plain
centered stack: try an offset title, a diagonal accent band, or an asymmetric
info row. Keep it legible at arm's length on a wall.

Output the raw HTML document only. No markdown fences, no commentary.`;
}

async function generateOne(client, activity, scheme, variation, qrCodeUrl) {
  const message = await client.messages.create({
    model: 'claude-sonnet-5',
    // A full A4 document runs several thousand tokens; 8000 left almost no
    // headroom and truncated posters mid-document.
    max_tokens: 16000,
    // Sonnet 5 runs adaptive thinking whenever `thinking` is omitted, and those
    // tokens count against max_tokens and against the wall clock. Three of
    // these run in parallel inside a 60s function limit, and laying out a
    // poster does not need deliberation, so opt out explicitly.
    thinking: { type: 'disabled' },
    messages: [
      { role: 'user', content: buildPrompt(activity, scheme, variation, qrCodeUrl) },
    ],
  });

  if (message.stop_reason === 'refusal') {
    throw new Error('The model declined to generate this poster.');
  }
  if (message.stop_reason === 'max_tokens') {
    throw new Error('The poster was cut off before it finished generating.');
  }

  const text = message.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('\n');

  // Strip a markdown fence if the model added one despite being told not to.
  const html = text
    .replace(/^\s*```(?:html)?\s*/i, '')
    .replace(/```\s*$/, '')
    .trim();

  const lower = html.toLowerCase();
  if (!lower.includes('<html')) {
    throw new Error('The model returned something that was not an HTML document.');
  }
  // Truncation shows up at the end, so an opening tag alone proves nothing.
  if (!lower.includes('</html>')) {
    throw new Error('The generated poster was incomplete and has been discarded.');
  }

  return {
    html,
    colorScheme: scheme.name,
    variationNumber: variation,
    source: 'ai',
  };
}

export async function POST(request) {
  const { error: authError } = await requireSession();
  if (authError) return authError;

  const { body, error: bodyError } = await readJson(request);
  if (bodyError) return bodyError;

  const { activity, qrCodeUrl, mode = 'template' } = body ?? {};

  const invalid = validateActivity(activity);
  if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });

  const schemes = getSchemes(activity.title);
  const qr = safeQrCodeUrl(qrCodeUrl);

  // Default path: rendered locally, instantly, at no cost.
  if (mode !== 'ai') {
    return NextResponse.json({
      posters: buildTemplatePosters(activity, schemes, qr),
      failedCount: 0,
      mode: 'template',
    });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      {
        error:
          'AI posters are not configured on this deployment. Add ANTHROPIC_API_KEY to enable them, or use the free template posters.',
        code: 'AI_NOT_CONFIGURED',
      },
      { status: 501 },
    );
  }

  try {
    // Imported lazily so a deployment with no API key never loads the SDK.
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    // In parallel because three sequential generations would exceed the 60s cap.
    const results = await Promise.allSettled(
      schemes.map((scheme, index) =>
        generateOne(client, activity, scheme, index + 1, qr),
      ),
    );

    const posters = results
      .filter((result) => result.status === 'fulfilled')
      .map((result) => result.value);
    const failures = results.filter((result) => result.status === 'rejected');

    if (posters.length === 0) {
      const reason = failures[0]?.reason?.message || 'Unknown error';
      return NextResponse.json(
        { error: `Every AI generation failed: ${reason}`, code: 'AI_FAILED' },
        { status: 502 },
      );
    }

    return NextResponse.json({
      posters,
      failedCount: failures.length,
      mode: 'ai',
    });
  } catch (err) {
    console.error('[generate-posters] AI generation failed:', err);
    return NextResponse.json(
      { error: err.message || 'AI poster generation failed', code: 'AI_FAILED' },
      { status: 500 },
    );
  }
}
