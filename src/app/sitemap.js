import { SITE_URL } from "@/lib/siteMetadata";

// Search engines should only discover public content. Authenticated screens are
// intentionally excluded even when they have usable deep links for real users.
export default function sitemap() {
  return [
    { url: SITE_URL, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/privacy`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${SITE_URL}/terms`, changeFrequency: "yearly", priority: 0.2 },
  ];
}
