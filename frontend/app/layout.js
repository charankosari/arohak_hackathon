import { Inter, Cormorant_Garamond } from 'next/font/google';
import { AuthProvider } from '@/components/AuthProvider';
import './globals.css';

const sans = Inter({ subsets: ['latin'], variable: '--font-sans', display: 'swap' });
const serif = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['600', '700'],
  variable: '--font-serif',
  display: 'swap',
});

export const metadata = {
  title: 'The Meridian Grand Mumbai | Booking & Management',
  description:
    'Reservations and hotel management for The Meridian Grand Mumbai - browse rooms, book stays, and manage the property.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${sans.variable} ${serif.variable}`}>
      <body className="font-sans antialiased">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
