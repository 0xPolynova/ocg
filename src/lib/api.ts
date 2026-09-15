export function apiUrl(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return normalized;
}

export function backendOrigin(): string {
  const fromEnv = process.env.API_URL?.replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  if (process.env.NODE_ENV === "development") return "http://localhost:4000";
  return "https://ocg-api.onrender.com";
}
