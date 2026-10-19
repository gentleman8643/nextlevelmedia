import './globals.css';
import type { Metadata } from 'next';
import { headers } from 'next/headers';

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = headers();
  const host = requestHeaders.get('x-forwarded-host') ?? requestHeaders.get('host');
  const protocol = requestHeaders.get('x-forwarded-proto') ?? (host?.startsWith('localhost') ? 'http' : 'https');
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || (host ? `${protocol}://${host}` : undefined);

  return {
    metadataBase: siteUrl ? new URL(siteUrl) : undefined,
    title: { default: 'Next Level Media | News that moves you forward', template: '%s | Next Level Media' },
    description: 'Independent Nigerian news and public-interest reporting, with a focus on Oyo, Osun, Lagos, Ekiti and national affairs.',
    applicationName: 'Next Level Media',
    keywords: ['Nigeria news', 'Oyo news', 'Osun news', 'Lagos news', 'Ekiti news', 'Nigerian politics', 'Nigerian sports'],
    robots: { index: true, follow: true, googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1, 'max-video-preview': -1 } },
    openGraph: {
      type: 'website',
      locale: 'en_NG',
      siteName: 'Next Level Media',
      title: 'Next Level Media | News that moves you forward',
      description: 'Independent Nigerian news and public-interest reporting.',
      images: [{ url: '/hero.jpg', alt: 'Next Level Media' }],
    },
    twitter: {
      card: 'summary_large_image',
      title: 'Next Level Media | News that moves you forward',
      description: 'Independent Nigerian news and public-interest reporting.',
      images: ['/hero.jpg'],
    },
    icons: { icon: '/hero.jpg', apple: '/hero.jpg' },
  };
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en-NG"><body>{children}</body></html>;
}
