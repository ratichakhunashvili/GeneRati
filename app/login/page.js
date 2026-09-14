import { AlertTriangle, CalendarDays } from 'lucide-react';
import GoogleSignInButton from '@/components/GoogleSignInButton';

// NextAuth reports failures as an ?error= code. Spell them out, because
// "AccessDenied" on its own gives no clue that an allowlist exists.
const ERROR_MESSAGES = {
  AccessDenied:
    'That Google account is not on the administrator list for this app. Ask the owner to add your address to ADMIN_EMAILS.',
  Configuration:
    'This app is not configured correctly. Check that GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and NEXTAUTH_SECRET are all set.',
  OAuthSignin: 'Could not start sign-in with Google. Please try again.',
  OAuthCallback:
    'Google rejected the sign-in. Check that this exact address is listed as an authorised redirect URI in Google Cloud.',
  OAuthAccountNotLinked: 'That email is already linked to a different sign-in method.',
  Verification: 'That sign-in link has expired. Please try again.',
  SessionRequired: 'Please sign in to continue.',
};

/**
 * Server component: the ?error= code arrives as a prop, so the card is rendered
 * on the server rather than bailing out to client-side rendering.
 */
export default function LoginPage({ searchParams }) {
  const errorCode = searchParams?.error;
  const errorMessage =
    errorCode && (ERROR_MESSAGES[errorCode] ?? 'Sign-in failed. Please try again.');

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl">
        <div className="mb-8 text-center">
          <h1 className="mb-2 text-4xl font-bold text-gray-800">SkillWill College</h1>
          <p className="text-lg text-gray-600">Activity Calendar</p>
          <p className="mt-2 text-sm text-gray-500">Admin portal</p>
        </div>

        <div className="mb-8 flex justify-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-blue-500 text-white">
            <CalendarDays size={38} aria-hidden="true" />
          </div>
        </div>

        {errorMessage && (
          <div
            role="alert"
            className="mb-6 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800"
          >
            <AlertTriangle size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
            <span>{errorMessage}</span>
          </div>
        )}

        <p className="mb-8 text-center text-sm text-gray-700">
          Sign in with the Google account that should own the Drive folders and registration
          forms this app creates.
        </p>

        {/*
          Google is the only provider offered. A GitHub button used to sit here,
          but no GitHub provider was ever configured, and a GitHub token cannot
          authorise Google Drive or Google Forms — every action after sign-in
          would have failed.
        */}
        <GoogleSignInButton />

        <div className="mt-8 text-center text-xs text-gray-500">
          <p>Admin access only</p>
          <p className="mt-2">© {new Date().getFullYear()} SkillWill College</p>
        </div>
      </div>
    </div>
  );
}
