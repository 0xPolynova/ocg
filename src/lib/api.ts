const DEV_API = "http://localhost:4000";
const PROD_API = "https://ocg-api.onrender.com";
const DEAD_API_HOSTS = ["api.launchocg.com"];

function resolveApiOrigin(fromEnv: string | undefined, fallback: string): string {
  const value = fromEnv?.replace(/\/$/, "");
  if (!value) return fallback;
  try {
    if (DEAD_API_HOSTS.includes(new URL(value).hostname)) return fallback;
  } catch {
    return fallback;
  }
  return value;
}

export function publicApiOrigin(): string {
  if (process.env.NODE_ENV === "development") {
    return resolveApiOrigin(process.env.NEXT_PUBLIC_API_URL, DEV_API);
  }
  return resolveApiOrigin(process.env.NEXT_PUBLIC_API_URL, PROD_API);
}

export function apiUrl(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${publicApiOrigin()}${normalized}`;
}

export function backendOrigin(): string {
  if (process.env.NODE_ENV === "development") {
    return resolveApiOrigin(process.env.API_URL, DEV_API);
  }
  return resolveApiOrigin(process.env.API_URL, PROD_API);
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
