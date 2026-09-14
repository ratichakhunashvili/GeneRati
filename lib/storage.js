'use client';

// Browser-side persistence. This is the fast, always-available half of the
// storage story; Drive is the half that follows the user to another machine.

const KEY = 'skillwill.activities.v1';

/** Read the cached activity list. Never throws — storage can be unavailable. */
export function loadLocalActivities() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    // Private windows and blocked site data both throw here.
    return [];
  }
}

/** Cache the activity list. Silently does nothing when storage is unavailable. */
export function saveLocalActivities(activities) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(activities));
  } catch {
    /* Quota exceeded or storage blocked — Drive remains the durable copy. */
  }
}

/**
 * Merge the browser copy with the Drive copy.
 *
 * Both sides can hold activities the other has never seen: Drive carries what
 * another machine published, the browser carries drafts that were never
 * published. Union them by id, and when the same id exists on both sides keep
 * the record that got further through publishing, since that one knows the
 * folder and form links.
 */
export function mergeActivities(local, remote) {
  const score = (activity) =>
    (activity?.formLink ? 2 : 0) + (activity?.folderLink ? 1 : 0);

  const byId = new Map();
  for (const activity of [...local, ...remote]) {
    if (!activity?.id) continue;
    const existing = byId.get(activity.id);
    if (!existing) {
      byId.set(activity.id, activity);
      continue;
    }
    // Prefer the more complete record, then merge in any fields it lacks.
    const winner = score(activity) >= score(existing) ? activity : existing;
    const loser = winner === activity ? existing : activity;
    byId.set(activity.id, { ...loser, ...winner });
  }

  return [...byId.values()].sort((a, b) =>
    String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? '')),
  );
}
