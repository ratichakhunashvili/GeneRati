# SkillWill Activity Calendar

An admin tool for SkillWill College. Create an activity, get three printable A4
posters with a registration QR code baked in, a Google Drive folder holding
them, and a Google Form for signups — in one click.

**It costs nothing to run.** No database, no paid APIs, no paid hosting. The
posters are rendered by the app itself, so there is no AI bill unless you
deliberately opt in.

---

## What you get per activity

| Thing | Where it lands |
|---|---|
| 3 printable A4 posters (HTML, print to PDF) | A Google Drive folder named after the activity |
| A registration form in Georgian | The same Drive folder |
| A QR code pointing at that form | Printed on all three posters |

---

## How the posters are designed

The app reads the activity title and recognises **what the event actually is**,
then draws artwork to match — football gets pitch markings and a ball, chess
gets a board and a king, a quiz night gets question marks and answer bubbles.
Each activity also carries its own colour identity.

Recognised in **English and Georgian**:

| | | |
|---|---|---|
| Football / ფეხბურთი | Volleyball / ფრენბურთი | Basketball / კალათბურთი |
| Tennis / ჩოგბურთი | Table tennis / მაგიდის ჩოგბურთი | Padel / პადელი |
| Running / სირბილი | Swimming / ცურვა | Chess / ჭადრაკი |
| Darts / დარტსი | Billiards / ბილიარდი | Board games / სამაგიდო თამაშები |
| Esports / ესპორტი | Quiz / ვიქტორინა | Mystery night / მგელი, მაფია |
| Party / წვეულება, კარაოკე | Movie night / ფილმი, კინო | Hackathon / ჰაკათონი |
| Debate / დებატები | Workshop / ვორქშოპი, სემინარი | anything else → a neutral design |

Every activity produces **three different styles**, so you can pick whichever
suits the event:

- **Bold** — oversized uppercase title, diagonal colour band, high contrast.
  Readable from the far end of a corridor.
- **Premium** — centred, restrained, generous whitespace and a deep gradient.
  For talks, ceremonies and anything formal.
- **Playful** — bright background, tilted sticker-style details, chunky type.
  For winning attention on a crowded noticeboard.

All of it is drawn by the app as inline SVG and CSS: no API key, no cost, no
network, and the same activity always produces exactly the same posters.

> Adding a new sport is a small edit: add its keywords and colours to
> `lib/posters/activities.js`, and its artwork to `lib/posters/artwork.js`.

---

## Run it locally

```bash
npm install
cp .env.example .env.local     # then fill it in — see below
npm run dev                    # http://localhost:3000
```

You need [Node.js](https://nodejs.org) 18.17 or newer (Node 20+ recommended).

---

## Setting up Google (the only required setup)

This is the part that takes 10 minutes. Everything here is free.

### 1. Create a Google Cloud project

1. Go to [console.cloud.google.com](https://console.cloud.google.com).
2. Click the project dropdown in the top bar → **New Project**.
3. Name it anything (`skillwill-calendar` is fine) → **Create**.
4. Make sure that new project is selected in the top bar before continuing.

Google Cloud requires no credit card for any of the APIs this app uses.

### 2. Enable the two APIs

**APIs & Services → Library**, then search for and **Enable** each of:

- **Google Drive API**
- **Google Forms API**

Both must be enabled in the *same* project. Missing either one causes a
"has not been used in project…" error the first time you publish an activity.

### 3. Configure the OAuth consent screen

**APIs & Services → OAuth consent screen**:

1. User type: **External** → **Create**.
2. App name: `SkillWill Activity Calendar`. Add your email as both the support
   email and the developer contact. → **Save and continue**.
3. **Scopes** — you can skip this screen; the app requests its scopes at
   sign-in time. → **Save and continue**.
4. **Test users** — click **Add users** and add **your own Google address**,
   plus anyone else who will sign in.

> **This step is not optional.** While the consent screen is in *Testing* mode,
> Google refuses sign-in for any account not listed as a test user. If you see
> "Access blocked: app has not completed the Google verification process", this
> is why.

Testing mode is fine forever for an internal tool. You only need Google's
verification review if you want the public to sign in, which you do not.

### 4. Create the OAuth client ID

**APIs & Services → Credentials → Create credentials → OAuth client ID**:

- Application type: **Web application**
- Name: anything
- **Authorised redirect URIs** — add this one now:
  ```
  http://localhost:3000/api/auth/callback/google
  ```
  and after you deploy (see below), come back and add:
  ```
  https://YOUR-APP.vercel.app/api/auth/callback/google
  ```

Click **Create** and copy the **Client ID** and **Client secret** into
`.env.local`.

> The redirect URI must match *character for character*, including `https`
> and no trailing slash. A mismatch gives `Error 400: redirect_uri_mismatch`.

### 5. Drive folders — nothing to do

**Leave `GOOGLE_DRIVE_FOLDER_ID` blank.** The first time you publish, the app
creates a folder called **SkillWill Activity Calendar** in your Drive and puts
every activity folder inside it. You do not need to make a folder or copy an id.

<details>
<summary>Why you cannot just paste a folder id from Drive</summary>

The app requests the `drive.file` scope, which grants access **only to files the
app itself created**. That is what stops it reading the rest of your Drive — but
it also means a folder you made by hand in the Drive UI is invisible to the app,
and using it as a parent fails with "File not found".

Pointing at an existing folder would require the much broader `drive` scope,
which can read your entire Drive and needs a Google verification review. Having
the app create its own folder gets the same tidy result with none of that, so
that is what it does.

`GOOGLE_DRIVE_FOLDER_ID` is kept as an override for the one case where it works:
a folder this app created. If you set it to anything else, the app detects that
it is unusable, tells you so, and falls back to its own folder rather than
failing.

</details>

### 6. Lock down who can sign in

Set `ADMIN_EMAILS` to your own Google address:

```
ADMIN_EMAILS=you@skillwill.edu.ge
```

While this is **blank, any Google account can sign in** and create folders in
your Drive. The dashboard shows a warning banner until you set it.

---

## Environment variables

| Variable | Required | What it does |
|---|---|---|
| `NEXTAUTH_URL` | yes | The app's own URL. `http://localhost:3000` locally. |
| `NEXTAUTH_SECRET` | yes | Signs the login cookie. Any long random string. |
| `GOOGLE_CLIENT_ID` | yes | From step 4. |
| `GOOGLE_CLIENT_SECRET` | yes | From step 4. |
| `ADMIN_EMAILS` | strongly advised | Comma-separated allowlist. Blank = anyone can sign in. |
| `GOOGLE_DRIVE_FOLDER_ID` | no — leave blank | Override parent folder. Only works for a folder this app created (see step 5). |
| `ANTHROPIC_API_KEY` | no | Enables optional AI posters. **Costs money.** Leave blank. |

Generate `NEXTAUTH_SECRET` with either:

```bash
openssl rand -base64 32
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

---

## Deploying free on Vercel

Vercel's Hobby plan is free and is all this app needs.

1. Push this repo to GitHub.
2. Go to [vercel.com/new](https://vercel.com/new), import the repo.
3. Before clicking Deploy, add every variable from your `.env.local` under
   **Environment Variables**, with two changes:
   - `NEXTAUTH_URL` must be your deployed URL, e.g.
     `https://skillwill-calendar.vercel.app`
   - leave `ANTHROPIC_API_KEY` out entirely unless you want the paid AI posters
4. Deploy.
5. Go back to Google Cloud → Credentials → your OAuth client, and add
   `https://YOUR-APP.vercel.app/api/auth/callback/google` as a second
   authorised redirect URI.

If you set `NEXTAUTH_URL` after the first deploy, redeploy so it takes effect.

---

## How it works

### Order of operations

Publishing runs in the order that makes the QR code correct:

```
Drive folder  →  Google Form  →  QR code of the form URL  →  posters  →  upload
```

The form must exist before the posters are rendered, because the QR code has to
contain the form's URL. If you only preview posters without publishing, the QR
carries the event details as plain text instead.

### Access and ownership

Drive and Forms are accessed with **your** Google token from sign-in, not a
service account. A service account has no storage quota of its own and cannot
own Drive files, so everything the app creates is owned by whoever signed in.

The app requests the `drive.file` scope, which means **it can only ever see
files it created itself**. It cannot read the rest of your Drive.

### Where your activity list is stored

Two places, both free:

- **Your browser** (`localStorage`) — instant, works offline, per-browser.
- **Your Google Drive** — a small `skillwill-activities.json` file inside the
  app's folder, so the list follows you to another computer or browser.

On load, the app reads the browser copy first so the page paints immediately,
then merges in whatever Drive has. Closing the app and reopening it — even on a
different machine — restores your activities.

If Drive cannot be reached on load, the app says so and **stops writing to
Drive for that session**, working from the browser copy only. This is
deliberate: writing a possibly-empty local list over a good Drive index would
destroy activities saved from another machine. Reload once Drive is reachable
and everything syncs.

Deleting an activity removes it from the list only. Its Drive folder and form
are left alone; delete those in Drive if you want them gone.

---

## Optional: AI poster variants (not free)

The three built-in poster templates need no API key and cost nothing. If you
also want AI-designed variants, add an `ANTHROPIC_API_KEY` from
[console.anthropic.com](https://console.anthropic.com) and an extra **AI
variants** button appears on each activity.

Roughly $0.02 per activity (three posters, Claude Sonnet). Without the key the
button is hidden and nothing else changes.

---

## Troubleshooting

| Symptom | Cause |
|---|---|
| `Access blocked: app has not completed verification` | Add your address under OAuth consent screen → Test users. |
| `Error 400: redirect_uri_mismatch` | The redirect URI in Google Cloud does not exactly match the app URL. |
| `Google Drive API has not been used in project…` | Enable the Drive and Forms APIs (step 2). |
| "That Google account is not on the administrator list" | Your address is not in `ADMIN_EMAILS`. |
| "Your Google sign-in expired" | Sign out and back in; the refresh token was revoked. |
| Posters upload but the form is missing | The Forms API is not enabled, or the account lacks Forms access. |
| Activity list is empty on another computer | Sign in with the same Google account — the list lives in that account's Drive. |

---

## Project layout

```
app/
  api/
    activities/route.js          read + write the Drive-backed activity list
    auth/[...nextauth]/route.js  NextAuth handler
    config/route.js              which optional features are configured
    create-form/route.js         builds the Google Form
    drive-integration/route.js   creates folders, uploads posters
    generate-posters/route.js    templates by default, AI when a key is set
  dashboard/page.js              the whole admin UI
  login/page.js                  Google sign-in
  error.js  not-found.js  layout.js  page.js  providers.js  globals.css
components/
  ActivityCard.js   one activity and its actions
  ActivityForm.js   the create form
  PosterPreview.js  sandboxed, correctly scaled A4 previews
  Toast.js          non-blocking notifications
lib/
  api.js            shared route guards and validation
  auth.js           NextAuth config, admin allowlist, token refresh
  format.js         date/time formatting and HTML escaping
  google.js         Drive + Forms clients, activity index
  storage.js        browser persistence and merge logic
  posters/
    schemes.js      colour palettes and activity-type detection
    templates.js    the three offline poster designs
```

---

## Printing a poster

Posters download as `.html`. Open one in a browser and print it (`Ctrl/Cmd+P`),
choosing **A4**, **Portrait**, margins **None**, and enable **Background
graphics** so the colours print. Or "Save as PDF" from the same dialog.
