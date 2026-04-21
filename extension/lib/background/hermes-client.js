import {
  DEFAULT_CONFIG,
  HEALTH_TIMEOUT_MS,
  RESPONSE_TIMEOUT_MS,
} from '../shared/constants.js';
import { normalizeBaseUrl } from '../shared/utils.js';

export function extractOutputText(payload) {
  const output = Array.isArray(payload?.output) ? payload.output : [];
  const chunks = [];

  for (const item of output) {
    if (item?.type !== 'message') {
      continue;
    }

    const content = Array.isArray(item.content) ? item.content : [];
    for (const block of content) {
      if (block?.type === 'output_text' && block.text) {
        chunks.push(block.text);
      }
    }
  }

  if (chunks.length) {
    return chunks.join('\n\n').trim();
  }

  return payload?.output_text || payload?.content || '';
}

export function createHermesClient({
  fetchImpl = globalThis.fetch,
} = {}) {
  function authHeaders(config, extra = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...extra,
    };
    if (config.apiKey) {
      headers.Authorization = `Bearer ${config.apiKey}`;
    }
    return headers;
  }

  async function fetchWithTimeout(url, options = {}, timeoutMs = RESPONSE_TIMEOUT_MS) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      return await fetchImpl(url, {
        ...options,
        signal: controller.signal,
      });
    } catch (error) {
      if (error?.name === 'AbortError') {
        throw new Error(`Hermes did not respond within ${Math.round(timeoutMs / 1000)}s.`);
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  async function checkHealth(config = DEFAULT_CONFIG) {
    const baseUrl = normalizeBaseUrl(config.baseUrl);

    try {
      const response = await fetchWithTimeout(`${baseUrl}/health`, {
        method: 'GET',
        headers: authHeaders(config),
      }, HEALTH_TIMEOUT_MS);
      if (!response.ok) {
        return {
          ok: false,
          status: response.status,
          message: `Hermes returned HTTP ${response.status}`,
          baseUrl,
        };
      }

      const data = await response.json().catch(() => ({ status: 'ok' }));
      return {
        ok: true,
        status: data.status || 'ok',
        baseUrl,
      };
    } catch (error) {
      return {
        ok: false,
        status: 'offline',
        message: error.message || 'Unable to reach Hermes',
        baseUrl,
      };
    }
  }

  async function callResponse(config, { prompt, instructions, conversation }) {
    const response = await fetchWithTimeout(`${normalizeBaseUrl(config.baseUrl)}/v1/responses`, {
      method: 'POST',
      headers: authHeaders(config),
      body: JSON.stringify({
        model: config.model,
        input: prompt,
        instructions,
        conversation,
        store: true,
      }),
    }, RESPONSE_TIMEOUT_MS);

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Hermes API ${response.status}: ${body.slice(0, 200)}`);
    }

    const payload = await response.json();
    return {
      raw: payload,
      text: extractOutputText(payload),
    };
  }

  return {
    authHeaders,
    checkHealth,
    callResponse,
    fetchWithTimeout,
  };
}
