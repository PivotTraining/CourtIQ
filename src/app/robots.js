import { SITE_URL } from "@/lib/siteMetadata";

export default function robots() {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/support", "/privacy", "/terms"],
      // Index only public marketing/legal documents, not player records or auth flows.
      disallow: [
        "/api/", "/auth/", "/dev/",
        "/dashboard", "/training", "/skills", "/sessions", "/heatmap",
        "/journal", "/game-log", "/iq", "/coach", "/billing",
        "/family", "/settings", "/film", "/development-profile",
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
