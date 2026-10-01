export const SCREEN_PATHS = Object.freeze({
  home: "/dashboard",
  train: "/training",
  gametime: "/training",
  skills: "/skills",
  shots: "/sessions",
  heatmap: "/heatmap",
  journal: "/journal",
  gamelog: "/game-log",
  iq: "/iq",
  coach: "/coach",
  billing: "/billing",
});

const PATH_SCREENS = Object.freeze({
  "/dashboard": "home",
  "/training": "train",
  "/skills": "skills",
  "/sessions": "shots",
  "/heatmap": "heatmap",
  "/journal": "journal",
  "/game-log": "gamelog",
  "/iq": "iq",
  "/coach": "coach",
  "/billing": "billing",
});

export function pathForScreen(screen) {
  return SCREEN_PATHS[screen] || SCREEN_PATHS.home;
}

export function screenFromPath(pathname = "/dashboard") {
  const normalized = pathname !== "/" ? pathname.replace(/\/$/, "") : "/dashboard";
  return PATH_SCREENS[normalized] || "home";
}
