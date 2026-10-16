import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'DocuMind — AI Knowledge Assistant',
  description:
    'Instant, reliable answers strictly grounded in your PDF and TXT documents with vector similarity retrieval and precise citations.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-sans antialiased text-slate-800 bg-slate-50 selection:bg-indigo-100 selection:text-indigo-900">
        {children}
      </body>
    </html>
  );
}
