import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'Punto Bianco · Coordonarea vizitelor',
  description: 'Platformă internă de coordonare a vizitelor pacienților Punto Bianco.',
  robots: { index: false, follow: false },
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ro">
      <body>{children}</body>
    </html>
  );
}
