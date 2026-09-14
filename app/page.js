'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Loader2 } from 'lucide-react';

/** Entry point: send people to the dashboard or the login screen. */
export default function Home() {
  const { status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'authenticated') {
      // replace, not push, so Back does not return to this redirect shim.
      router.replace('/dashboard');
    } else if (status === 'unauthenticated') {
      router.replace('/login');
    }
  }, [status, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="text-center">
        <Loader2 size={44} className="mx-auto mb-4 animate-spin text-blue-600" aria-hidden="true" />
        <p className="text-gray-600">Loading…</p>
      </div>
    </div>
  );
}
