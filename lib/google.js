import { Readable } from 'stream';
import { google } from 'googleapis';

// Files are located by an appProperties marker rather than by name, so renaming
// them in the Drive UI does not orphan them.
const INDEX_NAME = 'skillwill-activities.json';
const INDEX_KEY = 'skillwillIndex';
const INDEX_VERSION = 'v1';

const ROOT_NAME = 'SkillWill Activity Calendar';
const ROOT_KEY = 'skillwillRoot';
const ROOT_VERSION = 'v1';

const TEMPLATE_INDEX_NAME = 'skillwill-templates.json';
const TEMPLATE_INDEX_KEY = 'skillwillTemplates';
const TEMPLATE_FOLDER_NAME = 'Poster Templates';
const TEMPLATE_FOLDER_KEY = 'skillwillTemplateFolder';

function authFor(accessToken) {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return auth;
}

export function driveClient(accessToken) {
  return google.drive({ version: 'v3', auth: authFor(accessToken) });
}

export function formsClient(accessToken) {
  return google.forms({ version: 'v1', auth: authFor(accessToken) });
}

/** Pull the most useful message out of a googleapis error. */
export function googleErrorMessage(err) {
  return (
    err?.errors?.[0]?.message ||
    err?.response?.data?.error?.message ||
    err?.message ||
    'Unknown Google API error'
  );
}

/**
 * Build the upload body for the index file.
 *
 * A factory, not a value: a Node Readable can only be consumed once, and it
 * does NOT throw on a second read — it yields an empty body. Sharing one stream
 * across a create-then-retry would silently write a zero-byte index, which
 * `readActivityIndex` would then read back as "no activities" forever.
 */
function jsonMedia(payload) {
  return { mimeType: 'application/json', body: Readable.from([payload]) };
}

/** Find the newest file carrying a given appProperties marker. */
async function findByAppProperty(drive, key, value, extraQuery = '') {
  const res = await drive.files.list({
    q: `appProperties has { key='${key}' and value='${value}' } and trashed = false${extraQuery}`,
    fields: 'files(id, name, modifiedTime)',
    orderBy: 'modifiedTime desc',
    pageSize: 10,
    spaces: 'drive',
  });
  return res.data.files?.[0] ?? null;
}

/**
 * Find, or create, the app's own top-level folder.
 *
 * This exists because of the `drive.file` scope. That scope grants access only
 * to files the app itself created, so a folder id copied out of the Drive UI
 * generally cannot be used as a parent — Drive answers "File not found" for a
 * folder the app has never touched. Creating our own root folder keeps every
 * activity tidily in one place while staying inside the narrow scope, instead
 * of asking for full Drive access just to nest some folders.
 */
async function findOrCreateRootFolder(drive) {
  const existing = await findByAppProperty(
    drive,
    ROOT_KEY,
    ROOT_VERSION,
    " and mimeType = 'application/vnd.google-apps.folder'",
  );
  if (existing) return existing.id;

  const created = await drive.files.create({
    requestBody: {
      name: ROOT_NAME,
      mimeType: 'application/vnd.google-apps.folder',
      appProperties: { [ROOT_KEY]: ROOT_VERSION },
    },
    fields: 'id',
  });
  return created.data.id;
}

/**
 * Work out which folder new items belong in.
 *
 * GOOGLE_DRIVE_FOLDER_ID wins when it is set and usable, but it only works for
 * a folder this app created. When it is unset or unusable we fall back to the
 * app's own root folder.
 */
async function resolveParent(drive) {
  const configured = (process.env.GOOGLE_DRIVE_FOLDER_ID || '').trim();

  if (configured) {
    try {
      // Confirm the folder is reachable before trying to create inside it, so a
      // failure is diagnosed here rather than surfacing as a confusing 404.
      await drive.files.get({ fileId: configured, fields: 'id' });
      return { parentId: configured, usedFallback: false, fallbackReason: null };
    } catch (err) {
      return {
        parentId: await findOrCreateRootFolder(drive),
        usedFallback: true,
        fallbackReason: googleErrorMessage(err),
      };
    }
  }

  return { parentId: await findOrCreateRootFolder(drive), usedFallback: false, fallbackReason: null };
}

/** Create a folder for one activity. */
export async function createActivityFolder(drive, name) {
  const { parentId, usedFallback, fallbackReason } = await resolveParent(drive);

  const folder = await drive.files.create({
    requestBody: {
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId],
    },
    fields: 'id, webViewLink',
  });

  return { ...folder.data, usedFallback, fallbackReason };
}

/** Upload a UTF-8 text file into a folder. */
export async function uploadTextFile(drive, { name, folderId, content, mimeType = 'text/html' }) {
  const file = await drive.files.create({
    requestBody: {
      name,
      ...(folderId ? { parents: [folderId] } : {}),
      mimeType,
    },
    media: { mimeType, body: Readable.from([content]) },
    fields: 'id, webViewLink',
  });
  return file.data;
}

/**
 * Read the saved activity list back out of Drive.
 *
 * Only a JSON parse failure counts as `corrupt`. Network and permission errors
 * are rethrown, so the caller can tell "Drive says there is nothing" apart from
 * "Drive could not be reached" — the dashboard must never treat the second as
 * the first and then overwrite a good index with an empty one.
 */
export async function readActivityIndex(drive) {
  const file = await findByAppProperty(drive, INDEX_KEY, INDEX_VERSION);
  if (!file) return { activities: [], fileId: null, modifiedTime: null, corrupt: false };

  const res = await drive.files.get({ fileId: file.id, alt: 'media' }, { responseType: 'text' });

  try {
    // googleapis parses JSON responses itself, so data can already be an object.
    const parsed = typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
    const activities = Array.isArray(parsed?.activities) ? parsed.activities : [];
    return { activities, fileId: file.id, modifiedTime: file.modifiedTime, corrupt: false };
  } catch {
    return { activities: [], fileId: file.id, modifiedTime: null, corrupt: true };
  }
}

/** Write the activity list to Drive, creating the index file on first save. */
export async function writeActivityIndex(drive, activities) {
  const payload = JSON.stringify(
    { version: INDEX_VERSION, updatedAt: new Date().toISOString(), activities },
    null,
    2,
  );

  const existing = await findByAppProperty(drive, INDEX_KEY, INDEX_VERSION);

  if (existing) {
    const updated = await drive.files.update({
      fileId: existing.id,
      media: jsonMedia(payload),
      fields: 'id, modifiedTime',
    });
    return updated.data;
  }

  const { parentId } = await resolveParent(drive);

  const created = await drive.files.create({
    requestBody: {
      name: INDEX_NAME,
      mimeType: 'application/json',
      appProperties: { [INDEX_KEY]: INDEX_VERSION },
      parents: [parentId],
    },
    // A fresh stream per attempt — see jsonMedia.
    media: jsonMedia(payload),
    fields: 'id, modifiedTime',
  });
  return created.data;
}

/* ------------------------------------------------------- poster templates -- */

/** The folder holding uploaded template images, created on first use. */
async function templateFolder(drive) {
  const existing = await findByAppProperty(
    drive,
    TEMPLATE_FOLDER_KEY,
    ROOT_VERSION,
    " and mimeType = 'application/vnd.google-apps.folder'",
  );
  if (existing) return existing.id;

  const { parentId } = await resolveParent(drive);
  const created = await drive.files.create({
    requestBody: {
      name: TEMPLATE_FOLDER_NAME,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId],
      appProperties: { [TEMPLATE_FOLDER_KEY]: ROOT_VERSION },
    },
    fields: 'id',
  });
  return created.data.id;
}

/** Read the saved template list. Only a parse failure counts as corrupt. */
export async function readTemplateIndex(drive) {
  const file = await findByAppProperty(drive, TEMPLATE_INDEX_KEY, INDEX_VERSION);
  if (!file) return { templates: [], corrupt: false };

  const res = await drive.files.get({ fileId: file.id, alt: 'media' }, { responseType: 'text' });
  try {
    const parsed = typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
    return { templates: Array.isArray(parsed?.templates) ? parsed.templates : [], corrupt: false };
  } catch {
    return { templates: [], corrupt: true };
  }
}

/** Write the template list, creating the index on first save. */
export async function writeTemplateIndex(drive, templates) {
  const payload = JSON.stringify(
    { version: INDEX_VERSION, updatedAt: new Date().toISOString(), templates },
    null,
    2,
  );

  const existing = await findByAppProperty(drive, TEMPLATE_INDEX_KEY, INDEX_VERSION);
  if (existing) {
    const updated = await drive.files.update({
      fileId: existing.id,
      media: jsonMedia(payload),
      fields: 'id, modifiedTime',
    });
    return updated.data;
  }

  const { parentId } = await resolveParent(drive);
  const created = await drive.files.create({
    requestBody: {
      name: TEMPLATE_INDEX_NAME,
      mimeType: 'application/json',
      appProperties: { [TEMPLATE_INDEX_KEY]: INDEX_VERSION },
      parents: [parentId],
    },
    media: jsonMedia(payload),
    fields: 'id, modifiedTime',
  });
  return created.data;
}

/** Store a template background image and return its Drive file id. */
export async function uploadTemplateImage(drive, { name, mimeType, buffer }) {
  const folderId = await templateFolder(drive);
  const file = await drive.files.create({
    requestBody: { name, parents: [folderId], mimeType },
    media: { mimeType, body: Readable.from([buffer]) },
    fields: 'id',
  });
  return file.data.id;
}

/**
 * Fetch a template image back as a base64 data URI.
 *
 * Generated posters embed the image rather than linking it, so this runs once
 * per poster render.
 */
export async function readTemplateImage(drive, fileId) {
  const meta = await drive.files.get({ fileId, fields: 'mimeType' });
  const res = await drive.files.get({ fileId, alt: 'media' }, { responseType: 'arraybuffer' });
  const base64 = Buffer.from(res.data).toString('base64');
  return `data:${meta.data.mimeType};base64,${base64}`;
}

/** Delete a file. Used when a template is removed. */
export async function deleteDriveFile(drive, fileId) {
  await drive.files.delete({ fileId });
}
