import { Inter } from "next/font/google";
import { DEFAULT_DESCRIPTION, SITE_NAME, SITE_URL, SOCIAL_IMAGE } from "@/lib/siteMetadata";
import "./globals.css";
import "./web-shell.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata = {
  metadataBase: new URL(SITE_URL),
  applicationName: SITE_NAME,
  title: {
    default: "CourtIQ | Basketball Development Intelligence",
    template: "%s | CourtIQ",
  },
  description: DEFAULT_DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: {
    title: "CourtIQ | Basketball Development Intelligence",
    description: DEFAULT_DESCRIPTION,
    url: "/",
    siteName: SITE_NAME,
    type: "website",
    images: [SOCIAL_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: "CourtIQ | Basketball Development Intelligence",
    description: DEFAULT_DESCRIPTION,
    images: [SOCIAL_IMAGE.url],
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "CourtIQ",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#FF6B35",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="apple-touch-icon" sizes="180x180" href="/brand/courtiq-v2/apple-touch-icon.png" />
        <link rel="icon" type="image/svg+xml" href="/brand/courtiq-v2/courtiq-app-icon.svg" />
        <link rel="icon" type="image/png" sizes="48x48" href="/brand/courtiq-v2/icon-48.png" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body className={`${inter.variable} font-sans w-full`}>{children}</body>
    </html>
  );
}
