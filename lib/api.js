import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from './auth';

/**
 * Resolve the session for an API route.
 *
 * Returns `{ session }` on success or `{ error }` holding a ready-to-return
 * response. Every route needs the same three checks — signed in, has a Google
 * token, token still refreshable — and previously each route did its own
 * subset, so a failed refresh surfaced as a raw Google error in some routes and
 * a friendly message in others.
 */
export async function requireSession() {
  const session = await getServerSession(authOptions);

  if (!session?.accessToken) {
    return {
      error: NextResponse.json(
        { error: 'You are not signed in. Please sign in with Google again.' },
        { status: 401 },
      ),
    };
  }

  if (session.error === 'RefreshAccessTokenError') {
    return {
      error: NextResponse.json(
        {
          error:
            'Your Google session expired and could not be renewed. Sign out and sign in again.',
          code: 'REAUTH_REQUIRED',
        },
        { status: 401 },
      ),
    };
  }

  return { session };
}

/** Parse a JSON body, turning malformed input into a 400 instead of a crash. */
export async function readJson(request) {
  try {
    return { body: await request.json() };
  } catch {
    return {
      error: NextResponse.json({ error: 'Request body was not valid JSON' }, { status: 400 }),
    };
  }
}

/** Validate that an activity has every field the posters and form need. */
export function validateActivity(activity) {
  const missing = ['title', 'date', 'time', 'location'].filter(
    (field) => !String(activity?.[field] ?? '').trim(),
  );
  return missing.length
    ? `Missing required field${missing.length > 1 ? 's' : ''}: ${missing.join(', ')}`
    : null;
}
