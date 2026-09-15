import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/api';
import { adminEmails } from '@/lib/auth';
import { comfyConfigured } from '@/lib/comfy';

export const dynamic = 'force-dynamic';

/**
 * Why the image generator is unavailable, or null when it is available.
 *
 * Returned as a sentence rather than a boolean because every reason has a
 * different fix, and a button that silently fails to appear sends the user
 * hunting through the code.
 */
function imageGenBlockedReason(session) {
  if (!comfyConfigured()) {
    return 'COMFY_URL and COMFY_API_KEY are not set on this deployment.';
  }
  const admins = adminEmails();
  if (admins.length === 0) {
    return 'ADMIN_EMAILS is empty. Image generation spends time on a GPU, so it stays off until you list who may use it.';
  }
  if (!admins.includes((session.user?.email || '').toLowerCase())) {
    return 'Your account is not in ADMIN_EMAILS.';
  }
  return null;
}

/**
 * Report which optional features this deployment actually has configured, so
 * the dashboard can hide the AI button instead of offering a button that fails,
 * and can warn when the app is open to any Google account.
 */
export async function GET() {
  const { session, error } = await requireSession();
  if (error) return error;

  const imageGenBlocked = imageGenBlockedReason(session);

  return NextResponse.json({
    aiPostersAvailable: Boolean(process.env.ANTHROPIC_API_KEY),
    imageGenAvailable: imageGenBlocked === null,
    imageGenBlockedReason: imageGenBlocked,
    adminListConfigured: adminEmails().length > 0,
    driveFolderConfigured: Boolean((process.env.GOOGLE_DRIVE_FOLDER_ID || '').trim()),
    user: {
      name: session.user?.name ?? null,
      email: session.user?.email ?? null,
      image: session.user?.image ?? null,
    },
  });
}
