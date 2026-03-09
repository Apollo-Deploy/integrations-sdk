import type { TokenSet, VitalMetricType } from '@apollo-deploy/integrations';
import { CapabilityError } from '@apollo-deploy/integrations';
import type { GooglePlayAdapterConfig } from '../types.js';

const BASE_URL = 'https://androidpublisher.googleapis.com/androidpublisher/v3';
const UPLOAD_BASE_URL = 'https://androidpublisher.googleapis.com/upload/androidpublisher/v3';
const REPORTING_URL = 'https://playdeveloperreporting.googleapis.com/v1beta1';

export { BASE_URL, UPLOAD_BASE_URL, REPORTING_URL };

export const ALL_TRACKS = ['production', 'beta', 'alpha', 'internal'] as const;

export interface GooglePlayContext {
  config: GooglePlayAdapterConfig;
  gpRequest<T = any>(tokens: TokenSet, url: string, init?: RequestInit): Promise<T>;
  gpUpload<T = any>(
    tokens: TokenSet,
    path: string,
    file: Blob,
    contentType: string,
    query?: Record<string, string>,
  ): Promise<T>;
  withEdit<T>(
    tokens: TokenSet,
    packageName: string,
    fn: (editId: string) => Promise<T>,
    opts?: { commit?: boolean },
  ): Promise<T>;
  vitalsMetricSet(metric: VitalMetricType): string;
}

export function createGooglePlayContext(config: GooglePlayAdapterConfig): GooglePlayContext {
  async function gpRequest<T = any>(
    tokens: TokenSet,
    url: string,
    init?: RequestInit,
  ): Promise<T> {
    const res = await fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${tokens.accessToken}`,
        'Content-Type': 'application/json',
        ...(init?.headers as Record<string, string> | undefined),
      },
    });

    if (!res.ok) {
      const body = await res.text();
      throw new CapabilityError(
        'google-play',
        `Google Play API ${res.status}: ${body}`,
        res.status === 429 || res.status >= 500,
      );
    }

    if (res.status === 204) return null as T;
    return res.json() as Promise<T>;
  }

  async function gpUpload<T = any>(
    tokens: TokenSet,
    path: string,
    file: Blob,
    contentType: string,
    query?: Record<string, string>,
  ): Promise<T> {
    const params = new URLSearchParams({ uploadType: 'media', ...query });
    const url = `${UPLOAD_BASE_URL}${path}?${params}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokens.accessToken}`,
        'Content-Type': contentType,
        'Content-Length': String(file.size),
      },
      body: file,
    });

    if (!res.ok) {
      const body = await res.text();
      throw new CapabilityError(
        'google-play',
        `Google Play Upload API ${res.status}: ${body}`,
        res.status === 429 || res.status >= 500,
      );
    }

    return res.json() as Promise<T>;
  }

  async function withEdit<T>(
    tokens: TokenSet,
    packageName: string,
    fn: (editId: string) => Promise<T>,
    opts: { commit?: boolean } = {},
  ): Promise<T> {
    const edit = await gpRequest<{ id: string }>(
      tokens,
      `${BASE_URL}/applications/${packageName}/edits`,
      { method: 'POST' },
    );
    const editId = edit.id;
    try {
      const result = await fn(editId);
      if (opts.commit) {
        await gpRequest(
          tokens,
          `${BASE_URL}/applications/${packageName}/edits/${editId}:commit`,
          { method: 'POST' },
        );
      } else {
        await gpRequest(
          tokens,
          `${BASE_URL}/applications/${packageName}/edits/${editId}`,
          { method: 'DELETE' },
        ).catch(() => {});
      }
      return result;
    } catch (err) {
      await gpRequest(
        tokens,
        `${BASE_URL}/applications/${packageName}/edits/${editId}`,
        { method: 'DELETE' },
      ).catch(() => {});
      throw err;
    }
  }

  function vitalsMetricSet(metric: VitalMetricType): string {
    switch (metric) {
      case 'crash_rate': return 'crashRateMetricSet';
      case 'anr_rate': return 'anrRateMetricSet';
      case 'launch_time': return 'slowStartRateMetricSet';
      case 'excessive_wakeups': return 'excessiveWakeupRateMetricSet';
      case 'stuck_background_worker': return 'stuckBackgroundWakelockRateMetricSet';
      default: return 'crashRateMetricSet';
    }
  }

  return { config, gpRequest, gpUpload, withEdit, vitalsMetricSet };
}
