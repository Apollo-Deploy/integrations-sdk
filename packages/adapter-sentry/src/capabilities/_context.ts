import type { TokenSet, Paginated } from "@apollo-deploy/integrations";
import type { SentryAdapterConfig } from "../types.js";

export interface SentryContext {
  config: SentryAdapterConfig;
  get(
    tokens: TokenSet,
    path: string,
    params?: Record<string, string | number | boolean | string[] | undefined>,
  ): Promise<Response>;
  post(tokens: TokenSet, path: string, body: unknown): Promise<Response>;
  put(tokens: TokenSet, path: string, body: unknown): Promise<Response>;
  del(tokens: TokenSet, path: string): Promise<Response>;
  paginate<T>(
    resp: Response,
    mapper: (raw: Record<string, unknown>) => T,
  ): Promise<Paginated<T>>;
  parseLinkCursor(linkHeader: string | null): string | undefined;
  toDate(value: string | number | null | undefined): Date;
}

export function createSentryContext(
  config: SentryAdapterConfig,
): SentryContext {
  const base =
    (config.baseUrl?.replace(/\/$/, "") ?? "https://sentry.io") + "/api/0";

  function headers(tokens: TokenSet): Record<string, string> {
    const token =
      tokens.accessToken !== "" ? tokens.accessToken : config.authToken;
    return {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };
  }

  function parseLinkCursor(linkHeader: string | null): string | undefined {
    if (linkHeader == null || linkHeader === "") return undefined;
    // Sentry Link: <url>; rel="next"; results="true"; cursor="..."
    const match = /cursor="([^"]+)"[^>]*rel="next"/.exec(linkHeader);
    return match?.[1];
  }

  function toDate(value: string | number | null | undefined): Date {
    if (value == null || value === 0 || value === "") return new Date(0);
    return new Date(value);
  }

  function applyParam(
    search: URLSearchParams,
    k: string,
    v: string | number | boolean | string[],
  ): void {
    if (Array.isArray(v)) {
      v.forEach((item) => { search.append(k, item); });
    } else {
      search.set(k, String(v));
    }
  }

  async function get(
    tokens: TokenSet,
    path: string,
    params?: Record<string, string | number | boolean | string[] | undefined>,
  ): Promise<Response> {
    const url = new URL(`${base}${path}`);
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined) applyParam(url.searchParams, k, v);
      }
    }
    return fetch(url.toString(), { headers: headers(tokens) });
  }

  async function post(
    tokens: TokenSet,
    path: string,
    body: unknown,
  ): Promise<Response> {
    return fetch(`${base}${path}`, {
      method: "POST",
      headers: headers(tokens),
      body: JSON.stringify(body),
    });
  }

  async function put(
    tokens: TokenSet,
    path: string,
    body: unknown,
  ): Promise<Response> {
    return fetch(`${base}${path}`, {
      method: "PUT",
      headers: headers(tokens),
      body: JSON.stringify(body),
    });
  }

  async function del(tokens: TokenSet, path: string): Promise<Response> {
    return fetch(`${base}${path}`, {
      method: "DELETE",
      headers: headers(tokens),
    });
  }

  async function paginate<T>(
    resp: Response,
    mapper: (raw: Record<string, unknown>) => T,
  ): Promise<Paginated<T>> {
    const data = (await resp.json()) as Record<string, unknown>[];
    const link = resp.headers.get("link");
    const cursor = parseLinkCursor(link);
    return {
      items: data.map(mapper),
      hasMore: cursor !== undefined,
      cursor,
    };
  }

  return { config, get, post, put, del, paginate, parseLinkCursor, toDate };
}
