<script setup>
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useAlert } from 'dashboard/composables';
import { useKnowledgeBase } from 'dashboard/composables/useKnowledgeBase';
import SettingsLayout from '../SettingsLayout.vue';
import BaseSettingsHeader from '../components/BaseSettingsHeader.vue';
import NextButton from 'dashboard/components-next/button/Button.vue';
import Input from 'dashboard/components-next/input/Input.vue';

const { t } = useI18n();
const { isConfigured, isLoading, fetchPolicies, savePolicy, deletePolicy } =
  useKnowledgeBase();

const policies = ref([]);
const editingId = ref(null);
const form = ref({ title: '', body: '', published: true });

const isEditing = computed(() => Boolean(editingId.value));

const loadPolicies = async () => {
  if (!isConfigured.value) return;
  try {
    policies.value = await fetchPolicies();
  } catch (error) {
    useAlert(t('KB.POLICIES.LOAD_ERROR'));
  }
};

const resetForm = () => {
  editingId.value = null;
  form.value = { title: '', body: '', published: true };
};

const startEdit = policy => {
  editingId.value = policy.id;
  form.value = {
    title: policy.title,
    body: policy.body,
    published: policy.published,
  };
};

const onSubmit = async () => {
  if (!form.value.title.trim() || !form.value.body.trim()) {
    useAlert(t('KB.POLICIES.VALIDATION'));
    return;
  }
  try {
    // Policies upsert on (page_id, title) — re-saving the same title edits it
    // rather than creating a second copy the retriever could rank against
    // the first.
    await savePolicy({
      title: form.value.title.trim(),
      body: form.value.body.trim(),
      published: form.value.published,
    });
    useAlert(t('KB.POLICIES.SAVED'));
    resetForm();
    await loadPolicies();
  } catch (error) {
    useAlert(t('KB.POLICIES.SAVE_ERROR'));
  }
};

const onDelete = async policy => {
  // eslint-disable-next-line no-alert
  if (!window.confirm(t('KB.POLICIES.CONFIRM_DELETE', { title: policy.title })))
    return;
  try {
    await deletePolicy(policy.id);
    if (editingId.value === policy.id) resetForm();
    useAlert(t('KB.POLICIES.DELETED'));
    await loadPolicies();
  } catch (error) {
    useAlert(t('KB.POLICIES.DELETE_ERROR'));
  }
};

onMounted(loadPolicies);
</script>

<template>
  <SettingsLayout
    :is-loading="isLoading && !policies.length"
    :loading-message="$t('KB.POLICIES.LOADING')"
  >
    <template #header>
      <BaseSettingsHeader
        :title="$t('KB.POLICIES.TITLE')"
        :description="$t('KB.POLICIES.DESCRIPTION')"
      />
    </template>

    <template #body>
      <div v-if="!isConfigured" class="p-6 text-center text-n-slate-11">
        {{ $t('KB.NOT_CONFIGURED') }}
      </div>

      <div v-else class="flex flex-col gap-6 max-w-3xl">
        <!-- Editor -->
        <div class="p-4 rounded-lg bg-n-alpha-2 border border-n-weak">
          <div
            v-if="isEditing"
            class="flex items-center justify-between px-3 py-2 mb-3 rounded-md bg-n-blue-3 text-n-blue-11 text-sm"
          >
            <span>{{ $t('KB.POLICIES.EDITING', { title: form.title }) }}</span>
            <NextButton
              variant="ghost"
              color="slate"
              size="xs"
              :label="$t('KB.CANCEL')"
              @click="resetForm"
            />
          </div>

          <Input
            v-model="form.title"
            class="mb-3"
            :label="$t('KB.POLICIES.FORM.TITLE')"
            :placeholder="$t('KB.POLICIES.FORM.TITLE_PLACEHOLDER')"
          />

          <label
            for="kb-policy-body"
            class="block mb-1 text-sm font-medium text-n-slate-12"
          >
            {{ $t('KB.POLICIES.FORM.BODY') }}
          </label>
          <textarea
            id="kb-policy-body"
            v-model="form.body"
            rows="6"
            class="w-full px-3 py-2 mb-3 text-sm rounded-lg border border-n-weak bg-n-alpha-black2 text-n-slate-12 resize-y"
            :placeholder="$t('KB.POLICIES.FORM.BODY_PLACEHOLDER')"
          />

          <label class="flex items-center gap-2 mb-4 text-sm text-n-slate-11">
            <input v-model="form.published" type="checkbox" />
            {{ $t('KB.POLICIES.FORM.PUBLISHED') }}
          </label>

          <NextButton
            :label="$t('KB.POLICIES.SAVE')"
            :is-loading="isLoading"
            @click="onSubmit"
          />
        </div>

        <!-- List -->
        <div>
          <p
            v-if="!policies.length"
            class="py-12 text-center text-n-slate-11 text-sm"
          >
            {{ $t('KB.POLICIES.EMPTY') }}
          </p>

          <div v-else class="flex flex-col gap-2">
            <div
              v-for="policy in policies"
              :key="policy.id"
              class="flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors"
              :class="
                policy.id === editingId
                  ? 'border-n-brand bg-n-blue-2'
                  : 'border-n-weak hover:border-n-strong'
              "
              @click="startEdit(policy)"
            >
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2">
                  <span class="font-medium text-n-slate-12">
                    {{ policy.title }}
                  </span>
                  <span
                    v-if="!policy.published"
                    class="px-2 py-0.5 rounded-full text-[10px] font-medium bg-n-slate-3 text-n-slate-11"
                  >
                    {{ $t('KB.POLICIES.DRAFT') }}
                  </span>
                </div>
                <div class="mt-1 text-xs text-n-slate-11 line-clamp-2">
                  {{ policy.body }}
                </div>
              </div>

              <NextButton
                variant="ghost"
                color="ruby"
                size="xs"
                icon="i-lucide-trash-2"
                @click.stop="onDelete(policy)"
              />
            </div>
          </div>
        </div>
      </div>
    </template>
  </SettingsLayout>
</template>
