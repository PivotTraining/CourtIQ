// Public website metadata. Signed-in player pages must never be indexed.
export const SITE_URL = "https://getcourtiq.com";
export const SITE_NAME = "CourtIQ";
export const DEFAULT_DESCRIPTION =
  "Track basketball games, review shooting and performance trends, and use structured skill training to decide what to work on next.";
export const SOCIAL_IMAGE = {
  url: "/product-desktop.jpg",
  alt: "CourtIQ basketball performance tracking application preview",
};

export function publicPageMetadata({ title, description, path = "/" }) {
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      title: title.includes("CourtIQ") ? title : `${title} | CourtIQ`,
      description,
      url: path,
      siteName: SITE_NAME,
      type: "website",
      images: [SOCIAL_IMAGE],
    },
    twitter: {
      card: "summary_large_image",
      title: title.includes("CourtIQ") ? title : `${title} | CourtIQ`,
      description,
      images: [SOCIAL_IMAGE.url],
    },
  };
}
