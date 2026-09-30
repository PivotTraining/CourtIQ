export function safeNextPath(value) {
  if (!value || !value.startsWith("/") || value.startsWith("//") || /[\\\u0000-\u0020]/.test(value)) return "/dashboard";
  const target = new URL(value, "https://courtiq.invalid");
  if (target.origin !== "https://courtiq.invalid" || target.pathname.startsWith("/auth/")) return "/dashboard";
  return `${target.pathname}${target.search}${target.hash}`;
}

export function passwordError(password, confirmation) {
  if (password.length < 8) return "Use at least 8 characters for your new password.";
  if (password !== confirmation) return "Your passwords don't match.";
  return null;
}
