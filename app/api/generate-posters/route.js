import { NextResponse } from 'next/server';
import { readJson, requireSession, validateActivity } from '@/lib/api';
import { getActivityKind } from '@/lib/posters/activities';
import { buildTemplatePosters } from '@/lib/posters/templates';
import { buildPosterFromTemplate } from '@/lib/posters/fromTemplate';
import { driveClient, googleErrorMessage, readTemplateImage, readTemplateIndex } from '@/lib/google';
import { matchTemplate } from '@/lib/templates';

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

// The AI variations mirror the three built-in styles, so a deployment with a
// key produces alternatives to the templates rather than a different universe.
const AI_STYLES = [
  {
    name: 'Bold',
    brief:
      'Heavy and high-contrast. Oversized uppercase title with tight leading, a ' +
      'diagonal colour band behind it, details in solid pills, QR bottom-right. ' +
      'Must read from across a corridor.',
  },
  {
    name: 'Premium',
    brief:
      'Quiet and symmetrical. Centred composition, generous whitespace, a lighter ' +
      'title weight with one bold accent, thin hairline dividers, deep gradient ' +
      'background, QR centred near the bottom. Should feel like a gallery invite.',
  },
  {
    name: 'Playful',
    brief:
      'Bright and energetic. Use the primary colour as the dominant background ' +
      'rather than a dark base, slightly rotated sticker-style detail chips with ' +
      'hard offset shadows, chunky rounded type, a tilted QR card.',
  },
];

function buildPrompt(activity, kind, style, qrCodeUrl) {
  const c = kind.palette;
  return `Design an event poster as one self-contained HTML document.

EVENT
Title: ${activity.title}
Date: ${activity.date}
Time: ${activity.time}
Location: ${activity.location}
Activity type: ${kind.label}
Organizer: SkillWill College

PALETTE
Primary ${c.primary} / Accent ${c.accent} / Deep ${c.glow} / Background ${c.dark}

CANVAS
Exactly 794x1123 CSS pixels (A4 at 96dpi), portrait. Wrap everything in a single
.poster div with those fixed dimensions. Include @page { size: A4; margin: 0 },
a @media print block, and print-color-adjust: exact so backgrounds survive
printing.

STYLE — ${style.name}
${style.brief}

SUBJECT ARTWORK (this is the important part)
Draw inline SVG artwork specific to ${kind.label}, not generic decoration. Think
about what this activity actually looks like — its playing surface, equipment,
markings, or setting — and build abstract geometric artwork from that, used as a
faint full-bleed backdrop and as one bold focal emblem. Flat shapes and strokes
only.

CONTENT, in this order
1. "SkillWill College" as a small uppercase kicker.
2. The title, very large.
3. Date, time and location, each with a small inline-SVG icon. Never use emoji.
${
  qrCodeUrl
    ? `4. The QR code — reproduce this img tag EXACTLY as given, unchanged, on a
   white rounded card:
   <img src="${qrCodeUrl}" width="212" height="212" alt="Register" />`
    : '4. No QR code for this poster; give the call to action that space instead.'
}
5. A short Georgian call to action.
6. Footer: "ორგანიზატორი: SkillWill College" in small light text.

TEXT
Reproduce Georgian text exactly as given. Use a font stack including
'Noto Sans Georgian', 'BPG Arial' and Sylfaen so Georgian renders.

CONSTRAINTS
No external images, no icon fonts, no web font imports, no scripts. Everything
must render offline from this one file.

Output the raw HTML document only. No markdown fences, no commentary.`;
}

async function generateOne(client, activity, kind, style, qrCodeUrl) {
  const message = await client.messages.create({
    model: 'claude-sonnet-5',
    // A full A4 document with hand-drawn SVG artwork runs long; too low a cap
    // truncates the document mid-element.
    max_tokens: 16000,
    // Sonnet 5 runs adaptive thinking whenever `thinking` is omitted, and those
    // tokens count against max_tokens and against the wall clock. Three of
    // these run in parallel inside a 60s function limit.
    thinking: { type: 'disabled' },
    messages: [{ role: 'user', content: buildPrompt(activity, kind, style, qrCodeUrl) }],
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
    colorScheme: `${kind.label} · ${style.name} (AI)`,
    variationNumber: AI_STYLES.indexOf(style) + 1,
    source: 'ai',
  };
}

export async function POST(request) {
  const { session, error: authError } = await requireSession();
  if (authError) return authError;

  const { body, error: bodyError } = await readJson(request);
  if (bodyError) return bodyError;

  const { activity, qrCodeUrl, mode = 'builtin', templateId } = body ?? {};

  const invalid = validateActivity(activity);
  if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });

  const qr = safeQrCodeUrl(qrCodeUrl);
  const kind = getActivityKind(activity.title);

  // A poster built from one of the user's own uploaded designs.
  if (mode === 'custom') {
    try {
      const drive = driveClient(session.accessToken);
      const { templates } = await readTemplateIndex(drive);

      // An explicit choice wins; "auto" falls back to keyword matching.
      const template =
        (templateId && templateId !== 'auto'
          ? templates.find((t) => t.id === templateId)
          : matchTemplate(templates, activity.title)) ?? null;

      if (!template) {
        return NextResponse.json(
          {
            error:
              templateId && templateId !== 'auto'
                ? 'That template no longer exists. Pick another one.'
                : 'No template matches this activity yet. Choose one, or add a template with a matching keyword.',
            code: 'TEMPLATE_NOT_FOUND',
          },
          { status: 404 },
        );
      }

      const imageDataUri = await readTemplateImage(drive, template.fileId);
      const html = buildPosterFromTemplate({ activity, template, imageDataUri, qrCodeUrl: qr });

      return NextResponse.json({
        posters: [
          {
            html,
            colorScheme: template.name,
            variationNumber: 1,
            source: 'custom',
            templateId: template.id,
          },
        ],
        failedCount: 0,
        mode: 'custom',
        activityKind: kind.label,
      });
    } catch (err) {
      console.error('[generate-posters] Template render failed:', err);
      return NextResponse.json({ error: googleErrorMessage(err) }, { status: 500 });
    }
  }

  // Default path: the built-in designs, rendered locally and instantly.
  if (mode !== 'ai') {
    return NextResponse.json({
      posters: buildTemplatePosters(activity, qr),
      failedCount: 0,
      mode: 'builtin',
      activityKind: kind.label,
    });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      {
        error:
          'AI posters are not configured on this deployment. Add ANTHROPIC_API_KEY to enable them, or use the free built-in designs.',
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
      AI_STYLES.map((style) => generateOne(client, activity, kind, style, qr)),
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
      activityKind: kind.label,
    });
  } catch (err) {
    console.error('[generate-posters] AI generation failed:', err);
    return NextResponse.json(
      { error: err.message || 'AI poster generation failed', code: 'AI_FAILED' },
      { status: 500 },
    );
  }
}
