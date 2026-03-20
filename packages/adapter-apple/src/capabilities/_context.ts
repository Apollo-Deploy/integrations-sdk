import type { TokenSet } from "@apollo-deploy/integrations";
import { CapabilityError } from "@apollo-deploy/integrations";
import { generateAppleJWT } from "../oauth.js";
import type { AppleAdapterConfig } from "../types.js";

const BASE_URL = "https://api.appstoreconnect.apple.com/v1";

export interface AppleListResponse<T = any> {
  data: T[];
  included?: any[];
  links?: { next?: string; self?: string };
  meta?: Record<string, unknown>;
}

export interface AppleSingleResponse<T = any> {
  data: T;
  included?: any[];
  links?: { next?: string; self?: string };
  meta?: Record<string, unknown>;
}

export interface AppleContext {
  config: AppleAdapterConfig;
  appleRequest<T = any>(
    tokens: TokenSet,
    path: string,
    init?: RequestInit,
  ): Promise<T>;
  extractCursor(nextUrl?: string): string | undefined;
}

export function createAppleContext(config: AppleAdapterConfig): AppleContext {
  async function appleRequest<T = any>(
    tokens: TokenSet,
    path: string,
    init?: RequestInit,
  ): Promise<T> {
    let accessToken = tokens.accessToken;

    // Regenerate if expired or within 60s of expiry
    if (
      tokens.expiresAt != null &&
      tokens.expiresAt.getTime() - Date.now() < 60_000
    ) {
      accessToken = generateAppleJWT(config);
    }

    const res = await fetch(`${BASE_URL}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        ...(init?.headers as Record<string, string> | undefined),
      },
    });

    if (!res.ok) {
      const body = await res.text();
      throw new CapabilityError(
        "apple",
        `Apple API ${String(res.status)}: ${body}`,
        res.status === 429 || res.status >= 500,
      );
    }

    if (res.status === 204) return null as T;
    return res.json() as Promise<T>;
  }

  function extractCursor(nextUrl?: string): string | undefined {
    if (nextUrl == null || nextUrl === "") return undefined;
    try {
      const url = new URL(nextUrl);
      return url.searchParams.get("cursor") ?? undefined;
    } catch {
      return undefined;
    }
  }

  return { config, appleRequest, extractCursor };
}
