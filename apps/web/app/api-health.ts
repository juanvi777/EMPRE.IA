export interface ApiHealth {
  readonly environment: string;
  readonly service: string;
  readonly status: 'ok';
  readonly timestamp: string;
  readonly uptimeSeconds: number;
  readonly version: string;
}

export type ApiHealthState =
  | { readonly available: true; readonly health: ApiHealth }
  | { readonly available: false; readonly reason: string };

function getApiBaseUrl(value = process.env.NEXT_PUBLIC_API_BASE_URL): URL {
  if (value === undefined || value.length === 0) {
    throw new Error('NEXT_PUBLIC_API_BASE_URL es obligatoria.');
  }

  const url = new URL(value);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('NEXT_PUBLIC_API_BASE_URL debe usar HTTP o HTTPS.');
  }

  return url;
}

export async function getApiHealth(
  fetcher: typeof fetch = fetch,
  apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL,
): Promise<ApiHealthState> {
  try {
    const url = new URL('/health', getApiBaseUrl(apiBaseUrl));
    const response = await fetcher(url, {
      cache: 'no-store',
      signal: AbortSignal.timeout(2_000),
    });

    if (!response.ok) {
      return { available: false, reason: `La API respondió HTTP ${response.status}.` };
    }

    const health = (await response.json()) as ApiHealth;
    if (health.service !== 'empre-api' || health.status !== 'ok') {
      return { available: false, reason: 'La API respondió un diagnóstico no válido.' };
    }

    return { available: true, health };
  } catch {
    return { available: false, reason: 'No fue posible contactar la API.' };
  }
}
