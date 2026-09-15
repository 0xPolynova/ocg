const DEV_API = "http://localhost:4000";
const PROD_API = "https://api.launchocg.com";

export function publicApiOrigin(): string {
  const fromEnv = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  if (process.env.NODE_ENV === "development") return DEV_API;
  return PROD_API;
}

export function apiUrl(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${publicApiOrigin()}${normalized}`;
}

export function backendOrigin(): string {
  const fromEnv = process.env.API_URL?.replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  if (process.env.NODE_ENV === "development") return DEV_API;
  return PROD_API;
}

export async function readJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error("The game API returned an empty response. Try again in a moment.");
  }
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    throw new Error(
      trimmed.startsWith("<")
        ? "The game API returned a web page instead of JSON. It may still be deploying — wait a minute and send the prompt again."
        : `The game API returned invalid JSON (${response.status}).`,
    );
  }
}
