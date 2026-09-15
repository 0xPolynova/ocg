export function apiUrl(path: string): string {
  const fallback =
    process.env.NODE_ENV === "development" ? "http://localhost:4000" : "";
  const base = (process.env.NEXT_PUBLIC_API_URL ?? fallback).replace(/\/$/, "");
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalized}`;
}
