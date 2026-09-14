import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/api';
import { adminEmails } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * Report which optional features this deployment actually has configured, so
 * the dashboard can hide the AI button instead of offering a button that fails,
 * and can warn when the app is open to any Google account.
 */
export async function GET() {
  const { session, error } = await requireSession();
  if (error) return error;

  return NextResponse.json({
    aiPostersAvailable: Boolean(process.env.ANTHROPIC_API_KEY),
    adminListConfigured: adminEmails().length > 0,
    driveFolderConfigured: Boolean((process.env.GOOGLE_DRIVE_FOLDER_ID || '').trim()),
    user: {
      name: session.user?.name ?? null,
      email: session.user?.email ?? null,
      image: session.user?.image ?? null,
    },
  });
}
