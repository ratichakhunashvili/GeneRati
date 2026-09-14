import './globals.css';
import Providers from './providers';

export const metadata = {
  title: 'SkillWill Activity Calendar',
  description:
    'Create college activities, generate printable A3 posters with a registration QR code, and file them in Google Drive.',
  // This is an internal admin tool; keep it out of search results.
  robots: { index: false, follow: false },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#3b82f6',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="bg-gray-50">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
