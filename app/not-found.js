import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-2xl">
        <p className="mb-2 text-5xl font-bold text-blue-600">404</p>
        <h1 className="mb-6 text-xl font-bold text-gray-800">Page not found</h1>
        <Link
          href="/dashboard"
          className="inline-block rounded-lg bg-blue-600 px-5 py-3 font-bold text-white transition hover:bg-blue-700"
        >
          Back to the dashboard
        </Link>
      </div>
    </div>
  );
}
