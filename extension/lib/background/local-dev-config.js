import { normalizeBaseUrl } from '../shared/utils.js';

export function parseLocalDevConfig(payload = {}) {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const baseUrl = typeof payload.baseUrl === 'string'
    ? normalizeBaseUrl(payload.baseUrl.trim())
    : '';
  const apiKey = typeof payload.apiKey === 'string'
    ? payload.apiKey.trim()
    : '';

  if (!baseUrl && !apiKey) {
    return null;
  }

  return {
    baseUrl,
    apiKey,
    source: typeof payload.source === 'string' ? payload.source : '',
    generatedAt: typeof payload.generatedAt === 'string' ? payload.generatedAt : '',
  };
}

export function buildLocalDevConfigPatch(config = {}, localConfig = null) {
  if (!localConfig) {
    return {};
  }

  const patch = {};

  if (localConfig.baseUrl && localConfig.baseUrl !== config.baseUrl) {
    patch.baseUrl = localConfig.baseUrl;
  }

  if (localConfig.apiKey && localConfig.apiKey !== config.apiKey) {
    patch.apiKey = localConfig.apiKey;
  }

  return patch;
}

export async function loadLocalDevConfig({
  fetchImpl = globalThis.fetch,
  runtime = globalThis.chrome?.runtime,
  path = 'local-dev-config.json',
} = {}) {
  if (typeof fetchImpl !== 'function' || typeof runtime?.getURL !== 'function') {
    return null;
  }

  try {
    const response = await fetchImpl(runtime.getURL(path), {
      cache: 'no-store',
    });

    if (!response.ok) {
      return null;
    }

    const payload = await response.json();
    return parseLocalDevConfig(payload);
  } catch (_) {
    return null;
  }
}
