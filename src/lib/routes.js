export const SCREEN_PATHS = Object.freeze({
  home: "/dashboard",
  train: "/training",
  gametime: "/training",
  skills: "/skills",
  iq: "/iq",
  shots: "/sessions",
  heatmap: "/heatmap",
  journal: "/journal",
  gamelog: "/game-log",
  "pro-upgrade": "/pro",
  "teamiq-upgrade": "/team-iq",
});

const PATH_SCREENS = Object.freeze({
  "/": "home",
  "/dashboard": "home",
  "/training": "train",
  "/skills": "skills",
  "/iq": "iq",
  "/sessions": "shots",
  "/heatmap": "heatmap",
  "/journal": "journal",
  "/game-log": "gamelog",
  "/pro": "pro-upgrade",
  "/team-iq": "teamiq-upgrade",
});

export function pathForScreen(screen) {
  return SCREEN_PATHS[screen] || SCREEN_PATHS.home;
}

export function screenFromPath(pathname = "/") {
  const normalized = pathname !== "/" ? pathname.replace(/\/$/, "") : "/";
  return PATH_SCREENS[normalized] || "home";
}
