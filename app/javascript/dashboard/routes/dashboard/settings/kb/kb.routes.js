import { frontendURL } from '../../../../helper/URLHelper';
import SettingsWrapper from '../SettingsWrapper.vue';
import ProductManager from './ProductManager.vue';
import PolicyManager from './PolicyManager.vue';
import BackendSettings from './BackendSettings.vue';

/**
 * AI Knowledge Base settings.
 *
 * Mirrors the shape of canned.routes.js: SettingsWrapper is the parent, which
 * is what gives these pages Chatwoot's own settings chrome rather than making
 * them look bolted on.
 *
 * administrator-only on purpose. These pages hold the backend token and can
 * rewrite the catalog the bot quotes prices from — not agent-level surface.
 */
export default {
  routes: [
    {
      path: frontendURL('accounts/:accountId/settings/knowledge-base'),
      component: SettingsWrapper,
      children: [
        {
          path: '',
          redirect: to => ({ name: 'kb_products', params: to.params }),
        },
        {
          path: 'products',
          name: 'kb_products',
          meta: { permissions: ['administrator'] },
          component: ProductManager,
        },
        {
          path: 'policies',
          name: 'kb_policies',
          meta: { permissions: ['administrator'] },
          component: PolicyManager,
        },
        {
          path: 'backend',
          name: 'kb_backend',
          meta: { permissions: ['administrator'] },
          component: BackendSettings,
        },
      ],
    },
  ],
};
