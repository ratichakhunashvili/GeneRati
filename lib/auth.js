import GoogleProvider from 'next-auth/providers/google';

// drive.file keeps the app to files it created itself — it can never read the
// rest of the signed-in user's Drive. forms.body is what lets it build the
// registration form.
const SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/forms.body',
].join(' ');

/** Parse ADMIN_EMAILS into a lowercase list. Empty means "allow anyone". */
export function adminEmails() {
  return (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

async function refreshAccessToken(token) {
  try {
    if (!token.refreshToken) throw new Error('No refresh token on this session');

    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        grant_type: 'refresh_token',
        refresh_token: token.refreshToken,
      }),
    });

    const refreshed = await res.json();
    if (!res.ok) throw new Error(refreshed.error_description || refreshed.error || 'Refresh failed');

    return {
      ...token,
      accessToken: refreshed.access_token,
      expiresAt: Date.now() + (Number(refreshed.expires_in) || 3600) * 1000,
      // Google only returns a new refresh token when it rotates one.
      refreshToken: refreshed.refresh_token ?? token.refreshToken,
      error: undefined,
    };
  } catch (err) {
    console.error('[auth] Token refresh failed:', err.message);
    // Push expiry forward so a permanently revoked token does not make every
    // single request hammer Google's token endpoint. Routes gate on
    // `session.error`, so the session is still correctly treated as broken.
    return {
      ...token,
      expiresAt: Date.now() + 5 * 60_000,
      error: 'RefreshAccessTokenError',
    };
  }
}

export const authOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      authorization: {
        // access_type=offline + prompt=consent is what makes Google hand back a
        // refresh token, without which the session dies after one hour.
        params: { scope: SCOPES, access_type: 'offline', prompt: 'consent' },
      },
    }),
  ],
  pages: { signIn: '/login', error: '/login' },
  session: { strategy: 'jwt' },
  callbacks: {
    async signIn({ user }) {
      const admins = adminEmails();
      if (admins.length === 0) return true;
      return admins.includes((user.email || '').toLowerCase());
    },
    async jwt({ token, account }) {
      if (account) {
        return {
          ...token,
          accessToken: account.access_token,
          refreshToken: account.refresh_token,
          // expires_at is seconds since epoch, and is absent on some responses.
          expiresAt: account.expires_at
            ? account.expires_at * 1000
            : Date.now() + 3600 * 1000,
        };
      }

      // Refresh a minute early so an in-flight Drive call cannot race expiry.
      if (Date.now() < (token.expiresAt ?? 0) - 60_000) return token;
      return refreshAccessToken(token);
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken;
      session.error = token.error;
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};
