import { computed, ref } from 'vue';
import { useUISettings } from 'dashboard/composables/useUISettings';
import { createKbClient } from 'dashboard/api/kb';

/**
 * Shared state and calls for the AI Knowledge Base settings pages.
 *
 * WHERE CONFIG LIVES
 *   The backend URL and token are stored in uiSettings — Chatwoot's existing
 *   per-user JSON blob, persisted server-side on the user profile. That avoids
 *   a Rails migration entirely.
 *
 *   Known limitation, surfaced in the UI: uiSettings is PER USER. A second
 *   agent logging in sees an unconfigured panel. Making this per-account is the
 *   one change that would require touching Rails.
 *
 * WHICH TENANT
 *   page_id is the Chatwoot inbox id — the same tenant key the bot's webhook
 *   adapter derives from `conversation.inbox_id`. Products and policies are
 *   scoped by it end to end, so two stores on one Chatwoot never see each
 *   other's catalog.
 */
export function useKnowledgeBase() {
  const { uiSettings, updateUISettings } = useUISettings();

  const isLoading = ref(false);
  const error = ref('');

  const config = computed(() => ({
    baseUrl: uiSettings.value?.kb_backend_url || '',
    token: uiSettings.value?.kb_admin_token || '',
    pageId: String(uiSettings.value?.kb_page_id || ''),
  }));

  const isConfigured = computed(
    () => Boolean(config.value.baseUrl) && Boolean(config.value.token)
  );

  const saveConfig = async ({ baseUrl, token, pageId }) =>
    updateUISettings({
      kb_backend_url: baseUrl,
      kb_admin_token: token,
      kb_page_id: pageId,
    });

  /**
   * Every call funnels through here so loading and error state stay in one
   * place and no page has to remember to reset them.
   */
  const run = async fn => {
    isLoading.value = true;
    error.value = '';
    try {
      const client = createKbClient(config.value);
      return await fn(client, config.value.pageId);
    } catch (err) {
      error.value = err?.message || 'KB_UNKNOWN_ERROR';
      throw err;
    } finally {
      isLoading.value = false;
    }
  };

  const scoped = (path, params = {}) => {
    const query = new URLSearchParams({ page_id: params.pageId, ...params.extra });
    return `${path}?${query.toString()}`;
  };

  return {
    config,
    isConfigured,
    isLoading,
    error,
    saveConfig,

    // ── products ──────────────────────────────────────────────────────────
    fetchProducts: (search = '') =>
      run((client, pageId) =>
        client.get(
          scoped('/products', {
            pageId,
            extra: search ? { q: search } : {},
          })
        )
      ),

    createProduct: payload =>
      run((client, pageId) =>
        client.post('/products', { ...payload, page_id: pageId })
      ),

    // PUT by id, not POST: POST upserts on (page_id, name), so renaming a
    // product through it leaves the OLD row behind for the bot to quote.
    updateProduct: (id, payload) =>
      run((client, pageId) =>
        client.put(`/products/${id}`, { ...payload, page_id: pageId })
      ),

    deleteProduct: id => run(client => client.del(`/products/${id}`)),

    // ── policies ──────────────────────────────────────────────────────────
    fetchPolicies: () =>
      run((client, pageId) => client.get(scoped('/policies', { pageId }))),

    savePolicy: payload =>
      run((client, pageId) =>
        client.post('/policies', { ...payload, page_id: pageId })
      ),

    deletePolicy: id => run(client => client.del(`/policies/${id}`)),

    // ── connection test ───────────────────────────────────────────────────
    // Uses the products endpoint rather than a dedicated /health so it proves
    // the whole path: URL reachable, token valid, tenant readable.
    testConnection: (baseUrl, token, pageId) => {
      const client = createKbClient({ baseUrl, token });
      return client.get(scoped('/products', { pageId }));
    },
  };
}

export default useKnowledgeBase;
