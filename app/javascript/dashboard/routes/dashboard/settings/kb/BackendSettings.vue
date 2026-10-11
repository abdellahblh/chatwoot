<script setup>
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useStore } from 'dashboard/composables/store';
import { useAlert } from 'dashboard/composables';
import { useKnowledgeBase } from 'dashboard/composables/useKnowledgeBase';
import WebHooksAPI from 'dashboard/api/webhooks';
import SettingsLayout from '../SettingsLayout.vue';
import BaseSettingsHeader from '../components/BaseSettingsHeader.vue';
import NextButton from 'dashboard/components-next/button/Button.vue';
import Input from 'dashboard/components-next/input/Input.vue';

const { t } = useI18n();
const store = useStore();
const { config, saveConfig, testConnection } = useKnowledgeBase();

const form = ref({ baseUrl: '', token: '', pageId: '' });
const webhookUrl = ref('');
const isSaving = ref(false);
const isTesting = ref(false);
const isRegistering = ref(false);
// null = untested. Distinct from false so the UI never claims a failure the
// user has not actually seen happen.
const testResult = ref(null);

const inboxes = computed(() => store.getters['inboxes/getInboxes'] || []);

const isHttpsMismatch = computed(() => {
  // A page served over HTTPS cannot call an HTTP backend — the browser blocks
  // it as mixed content BEFORE any CORS header is considered. Catch it here,
  // because the console error for this is famously unhelpful.
  const url = form.value.baseUrl.trim();
  return window.location.protocol === 'https:' && url.startsWith('http://');
});

const onSave = async () => {
  isSaving.value = true;
  try {
    await saveConfig({
      baseUrl: form.value.baseUrl.trim().replace(/\/+$/, ''),
      token: form.value.token.trim(),
      pageId: String(form.value.pageId || ''),
    });
    useAlert(t('KB.SETTINGS.SAVED'));
  } catch (error) {
    useAlert(t('KB.SETTINGS.SAVE_ERROR'));
  } finally {
    isSaving.value = false;
  }
};

const onTest = async () => {
  isTesting.value = true;
  testResult.value = null;
  try {
    // Hits a real data endpoint, not a /health stub: this proves the URL
    // resolves, the token is accepted AND the tenant is readable.
    await testConnection(
      form.value.baseUrl.trim().replace(/\/+$/, ''),
      form.value.token.trim(),
      String(form.value.pageId || '')
    );
    testResult.value = { ok: true, message: t('KB.SETTINGS.TEST_OK') };
  } catch (error) {
    const key =
      {
        KB_BAD_TOKEN: 'KB.SETTINGS.TEST_BAD_TOKEN',
        KB_TOKEN_NOT_SET: 'KB.SETTINGS.TEST_TOKEN_NOT_SET',
        KB_UNREACHABLE: 'KB.SETTINGS.TEST_UNREACHABLE',
        KB_NOT_CONFIGURED: 'KB.SETTINGS.TEST_NOT_CONFIGURED',
      }[error?.message] || 'KB.SETTINGS.TEST_FAILED';
    testResult.value = { ok: false, message: t(key) };
  } finally {
    isTesting.value = false;
  }
};

const onRegisterWebhook = async () => {
  const url = webhookUrl.value.trim();
  if (!url) {
    useAlert(t('KB.SETTINGS.WEBHOOK_REQUIRED'));
    return;
  }
  isRegistering.value = true;
  try {
    // Chatwoot's OWN webhook API — no fork code needed for this write. The
    // bot only ever needs message_created; subscribing to everything would
    // multiply the traffic your backend has to filter out.
    await WebHooksAPI.create({
      webhook: { url, subscriptions: ['message_created'] },
    });
    useAlert(t('KB.SETTINGS.WEBHOOK_REGISTERED'));
  } catch (error) {
    const detail = error?.response?.data?.message;
    useAlert(detail || t('KB.SETTINGS.WEBHOOK_ERROR'));
  } finally {
    isRegistering.value = false;
  }
};

onMounted(() => {
  form.value = {
    baseUrl: config.value.baseUrl,
    token: config.value.token,
    pageId: config.value.pageId,
  };
  store.dispatch('inboxes/get');
});
</script>

<template>
  <SettingsLayout>
    <template #header>
      <BaseSettingsHeader
        :title="$t('KB.SETTINGS.TITLE')"
        :description="$t('KB.SETTINGS.DESCRIPTION')"
      />
    </template>

    <template #body>
      <div class="flex flex-col gap-6 max-w-3xl">
        <!-- Backend connection -->
        <section class="p-4 rounded-lg bg-n-alpha-2 border border-n-weak">
          <h3 class="mb-1 text-sm font-medium text-n-slate-12">
            {{ $t('KB.SETTINGS.BACKEND_TITLE') }}
          </h3>
          <p class="mb-4 text-xs text-n-slate-11">
            {{ $t('KB.SETTINGS.BACKEND_HELP') }}
          </p>

          <Input
            v-model="form.baseUrl"
            class="mb-3"
            :label="$t('KB.SETTINGS.BASE_URL')"
            placeholder="https://bot.example.com"
          />

          <p
            v-if="isHttpsMismatch"
            class="mb-3 px-3 py-2 rounded-md text-xs bg-n-amber-3 text-n-amber-11"
          >
            {{ $t('KB.SETTINGS.MIXED_CONTENT') }}
          </p>

          <Input
            v-model="form.token"
            type="password"
            class="mb-3"
            :label="$t('KB.SETTINGS.TOKEN')"
            :placeholder="$t('KB.SETTINGS.TOKEN_PLACEHOLDER')"
          />

          <label class="block mb-1 text-sm font-medium text-n-slate-12">
            {{ $t('KB.SETTINGS.INBOX') }}
          </label>
          <select
            v-model="form.pageId"
            class="w-full mb-1 px-3 py-2 text-sm rounded-lg border border-n-weak bg-n-alpha-black2 text-n-slate-12"
          >
            <option value="">{{ $t('KB.SETTINGS.INBOX_NONE') }}</option>
            <option v-for="inbox in inboxes" :key="inbox.id" :value="String(inbox.id)">
              {{ inbox.name }} (id {{ inbox.id }})
            </option>
          </select>
          <p class="mb-4 text-xs text-n-slate-11">
            {{ $t('KB.SETTINGS.INBOX_HELP') }}
          </p>

          <div class="flex items-center gap-2">
            <NextButton
              :label="$t('KB.SETTINGS.SAVE')"
              :is-loading="isSaving"
              @click="onSave"
            />
            <NextButton
              variant="outline"
              color="slate"
              :label="$t('KB.SETTINGS.TEST')"
              :is-loading="isTesting"
              @click="onTest"
            />
            <span
              v-if="testResult"
              class="text-xs"
              :class="testResult.ok ? 'text-n-teal-11' : 'text-n-ruby-11'"
            >
              {{ testResult.message }}
            </span>
          </div>
        </section>

        <!-- Bot webhook -->
        <section class="p-4 rounded-lg bg-n-alpha-2 border border-n-weak">
          <h3 class="mb-1 text-sm font-medium text-n-slate-12">
            {{ $t('KB.SETTINGS.WEBHOOK_TITLE') }}
          </h3>
          <p class="mb-4 text-xs text-n-slate-11">
            {{ $t('KB.SETTINGS.WEBHOOK_HELP') }}
          </p>

          <Input
            v-model="webhookUrl"
            class="mb-3"
            :label="$t('KB.SETTINGS.WEBHOOK_URL')"
            placeholder="https://bot.example.com/chatwoot/<secret>"
          />

          <p class="mb-3 px-3 py-2 rounded-md text-xs bg-n-slate-3 text-n-slate-11">
            {{ $t('KB.SETTINGS.WEBHOOK_SECRET_TIP') }}
          </p>

          <NextButton
            variant="outline"
            :label="$t('KB.SETTINGS.WEBHOOK_REGISTER')"
            :is-loading="isRegistering"
            @click="onRegisterWebhook"
          />
        </section>

        <p class="text-xs text-n-slate-10">
          {{ $t('KB.SETTINGS.PER_USER_NOTE') }}
        </p>
      </div>
    </template>
  </SettingsLayout>
</template>
