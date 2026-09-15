import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { adminEmails, authOptions } from './auth';

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

/**
 * Resolve the session for a route that must be restricted to named admins.
 *
 * Signing in is not enough here. This gates the image generator, which spends
 * time on a GPU in someone's house, reached through a tunnel whose only lock is
 * one shared key — so unlike the Drive routes, where the worst case is a user
 * making folders in their own Drive, the cost of a loose gate lands on the
 * machine owner.
 *
 * It therefore fails CLOSED on an empty ADMIN_EMAILS. Everywhere else in the
 * app an empty list means "allow anyone", which is a reasonable default for a
 * feature that only touches the caller's own account and a deliberately unsafe
 * one for this.
 */
export async function requireAdmin() {
  const { session, error } = await requireSession();
  if (error) return { error };

  const admins = adminEmails();
  if (admins.length === 0) {
    return {
      error: NextResponse.json(
        {
          error:
            'Image generation is switched off because ADMIN_EMAILS is empty. Set it to the ' +
            'addresses allowed to use the GPU, then restart the app.',
          code: 'ADMIN_LIST_EMPTY',
        },
        { status: 403 },
      ),
    };
  }

  if (!admins.includes((session.user?.email || '').toLowerCase())) {
    return {
      error: NextResponse.json(
        { error: 'Your account is not allowed to generate images.', code: 'NOT_ADMIN' },
        { status: 403 },
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
