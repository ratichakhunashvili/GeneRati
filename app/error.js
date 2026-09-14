'use client';

import { useEffect } from 'react';
import { RotateCw } from 'lucide-react';

/** Catches render errors so a crash shows a recovery button, not a blank page. */
export default function Error({ error, reset }) {
  useEffect(() => {
    console.error('Unhandled error:', error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-2xl">
        <h1 className="mb-2 text-2xl font-bold text-gray-800">Something went wrong</h1>
        <p className="mb-6 text-sm text-gray-600">
          The page hit an unexpected error. Your saved activities are safe — they are stored in
          this browser and in your Google Drive.
        </p>
        <button
          type="button"
          onClick={reset}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-3 font-bold text-white transition hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
        >
          <RotateCw size={18} aria-hidden="true" /> Try again
        </button>
      </div>
    </div>
  );
}
