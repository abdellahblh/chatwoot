<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useAlert } from 'dashboard/composables';
import { useKnowledgeBase } from 'dashboard/composables/useKnowledgeBase';
import SettingsLayout from '../SettingsLayout.vue';
import BaseSettingsHeader from '../components/BaseSettingsHeader.vue';
import NextButton from 'dashboard/components-next/button/Button.vue';
import Input from 'dashboard/components-next/input/Input.vue';

const { t } = useI18n();
const {
  isConfigured,
  isLoading,
  fetchProducts,
  createProduct,
  updateProduct,
  deleteProduct,
} = useKnowledgeBase();

// Below this, the owner should reorder. Surfaced as a distinct amber state
// rather than lumping "2 left" in with "in stock".
const LOW_STOCK = 3;

const products = ref([]);
const searchQuery = ref('');
const editingId = ref(null);
const form = ref({ name: '', price: '', stock: 0, description: '' });

let searchTimer = null;

const stockState = stock => {
  if (stock === 0) return 'out';
  return stock <= LOW_STOCK ? 'low' : 'ok';
};

const stockClass = stock =>
  ({
    out: 'text-n-ruby-11',
    low: 'text-n-amber-11',
    ok: 'text-n-teal-11',
  })[stockState(stock)];

// Stats describe the FILTERED list, so the numbers always agree with what is
// on screen. Counting the whole catalog under a filtered list is the kind of
// mismatch that makes an owner stop trusting the panel.
const stats = computed(() => ({
  total: products.value.length,
  inStock: products.value.filter(p => p.stock > LOW_STOCK).length,
  low: products.value.filter(p => p.stock > 0 && p.stock <= LOW_STOCK).length,
  out: products.value.filter(p => p.stock === 0).length,
  units: products.value.reduce((sum, p) => sum + (p.stock || 0), 0),
}));

const isEditing = computed(() => Boolean(editingId.value));

const loadProducts = async () => {
  if (!isConfigured.value) return;
  try {
    products.value = await fetchProducts(searchQuery.value);
  } catch (error) {
    useAlert(t('KB.PRODUCTS.LOAD_ERROR'));
  }
};

// Debounced: one request per pause, not one per keystroke.
watch(searchQuery, () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(loadProducts, 250);
});

const resetForm = () => {
  editingId.value = null;
  form.value = { name: '', price: '', stock: 0, description: '' };
};

const startEdit = product => {
  editingId.value = product.id;
  form.value = {
    name: product.name,
    price: product.price,
    stock: product.stock,
    description: product.description || '',
  };
};

const onSubmit = async () => {
  if (!form.value.name.trim() || !form.value.price.trim()) {
    useAlert(t('KB.PRODUCTS.VALIDATION'));
    return;
  }
  const payload = {
    name: form.value.name.trim(),
    price: form.value.price.trim(),
    stock: Number(form.value.stock) || 0,
    description: form.value.description.trim() || null,
  };
  try {
    // PUT by id when editing. POST upserts on (page_id, name), so renaming
    // through POST would leave the OLD product for the bot to keep quoting.
    if (editingId.value) await updateProduct(editingId.value, payload);
    else await createProduct(payload);
    useAlert(t(editingId.value ? 'KB.PRODUCTS.UPDATED' : 'KB.PRODUCTS.ADDED'));
    resetForm();
    await loadProducts();
  } catch (error) {
    useAlert(t('KB.PRODUCTS.SAVE_ERROR'));
  }
};

const onDelete = async product => {
  // eslint-disable-next-line no-alert
  if (!window.confirm(t('KB.PRODUCTS.CONFIRM_DELETE', { name: product.name })))
    return;
  try {
    await deleteProduct(product.id);
    if (editingId.value === product.id) resetForm();
    useAlert(t('KB.PRODUCTS.DELETED'));
    await loadProducts();
  } catch (error) {
    useAlert(t('KB.PRODUCTS.DELETE_ERROR'));
  }
};

onMounted(loadProducts);
</script>

<template>
  <SettingsLayout
    :is-loading="isLoading && !products.length"
    :loading-message="$t('KB.PRODUCTS.LOADING')"
  >
    <template #header>
      <BaseSettingsHeader
        v-model:search-query="searchQuery"
        :title="$t('KB.PRODUCTS.TITLE')"
        :description="$t('KB.PRODUCTS.DESCRIPTION')"
        :search-placeholder="$t('KB.PRODUCTS.SEARCH_PLACEHOLDER')"
      />
    </template>

    <template #body>
      <div v-if="!isConfigured" class="p-6 text-center text-n-slate-11">
        {{ $t('KB.NOT_CONFIGURED') }}
      </div>

      <div v-else class="flex flex-col gap-6">
        <!-- Stock overview -->
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div class="p-3 rounded-lg bg-n-alpha-2 border border-n-weak">
            <div class="text-xl font-medium text-n-slate-12">
              {{ stats.total }}
            </div>
            <div class="text-xs text-n-slate-11">
              {{ $t('KB.PRODUCTS.STATS.TOTAL') }}
            </div>
          </div>
          <div class="p-3 rounded-lg bg-n-alpha-2 border border-n-weak">
            <div class="text-xl font-medium text-n-teal-11">
              {{ stats.inStock }}
            </div>
            <div class="text-xs text-n-slate-11">
              {{ $t('KB.PRODUCTS.STATS.IN_STOCK') }}
            </div>
          </div>
          <div class="p-3 rounded-lg bg-n-alpha-2 border border-n-weak">
            <div class="text-xl font-medium text-n-amber-11">
              {{ stats.low }}
            </div>
            <div class="text-xs text-n-slate-11">
              {{ $t('KB.PRODUCTS.STATS.LOW', { count: LOW_STOCK }) }}
            </div>
          </div>
          <div class="p-3 rounded-lg bg-n-alpha-2 border border-n-weak">
            <div class="text-xl font-medium text-n-ruby-11">
              {{ stats.out }}
            </div>
            <div class="text-xs text-n-slate-11">
              {{ $t('KB.PRODUCTS.STATS.OUT') }}
            </div>
          </div>
        </div>

        <!-- Add / edit form -->
        <div class="p-4 rounded-lg bg-n-alpha-2 border border-n-weak">
          <div
            v-if="isEditing"
            class="flex items-center justify-between px-3 py-2 mb-3 rounded-md bg-n-blue-3 text-n-blue-11 text-sm"
          >
            <span>{{ $t('KB.PRODUCTS.EDITING', { name: form.name }) }}</span>
            <NextButton
              variant="ghost"
              color="slate"
              size="xs"
              :label="$t('KB.CANCEL')"
              @click="resetForm"
            />
          </div>

          <div class="grid grid-cols-1 md:grid-cols-4 gap-3 mb-3">
            <Input
              v-model="form.name"
              class="md:col-span-2"
              :label="$t('KB.PRODUCTS.FORM.NAME')"
              :placeholder="$t('KB.PRODUCTS.FORM.NAME_PLACEHOLDER')"
            />
            <Input
              v-model="form.price"
              :label="$t('KB.PRODUCTS.FORM.PRICE')"
              :placeholder="$t('KB.PRODUCTS.FORM.PRICE_PLACEHOLDER')"
            />
            <Input
              v-model="form.stock"
              type="number"
              :label="$t('KB.PRODUCTS.FORM.STOCK')"
            />
          </div>
          <Input
            v-model="form.description"
            class="mb-3"
            :label="$t('KB.PRODUCTS.FORM.DESCRIPTION')"
            :placeholder="$t('KB.PRODUCTS.FORM.DESCRIPTION_PLACEHOLDER')"
          />
          <NextButton
            :label="
              isEditing ? $t('KB.PRODUCTS.SAVE') : $t('KB.PRODUCTS.ADD')
            "
            :is-loading="isLoading"
            @click="onSubmit"
          />
        </div>

        <!-- List -->
        <div>
          <div
            class="flex items-center justify-between mb-2 text-xs text-n-slate-11"
          >
            <span v-if="stats.total">
              {{
                $t('KB.PRODUCTS.COUNT', {
                  count: stats.total,
                  units: stats.units,
                })
              }}
            </span>
            <span>{{ $t('KB.PRODUCTS.CLICK_TO_EDIT') }}</span>
          </div>

          <p
            v-if="!products.length"
            class="py-12 text-center text-n-slate-11 text-sm"
          >
            {{
              searchQuery
                ? $t('KB.PRODUCTS.NO_MATCH', { query: searchQuery })
                : $t('KB.PRODUCTS.EMPTY')
            }}
          </p>

          <div v-else class="flex flex-col gap-2">
            <div
              v-for="product in products"
              :key="product.id"
              class="flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors"
              :class="
                product.id === editingId
                  ? 'border-n-brand bg-n-blue-2'
                  : 'border-n-weak hover:border-n-strong'
              "
              @click="startEdit(product)"
            >
              <div class="flex-1 min-w-0">
                <div class="font-medium text-n-slate-12 truncate">
                  {{ product.name }}
                </div>
                <div class="text-xs text-n-slate-11">{{ product.price }}</div>
                <div
                  v-if="product.description"
                  class="mt-1 text-xs text-n-slate-11 line-clamp-2"
                >
                  {{ product.description }}
                </div>
              </div>

              <div class="text-right shrink-0 w-20">
                <div class="text-lg font-medium" :class="stockClass(product.stock)">
                  {{ product.stock }}
                </div>
                <div class="text-[10px] uppercase tracking-wide text-n-slate-10">
                  {{
                    product.stock === 0
                      ? $t('KB.PRODUCTS.NONE_LEFT')
                      : $t('KB.PRODUCTS.LEFT')
                  }}
                </div>
              </div>

              <NextButton
                variant="ghost"
                color="ruby"
                size="xs"
                icon="i-lucide-trash-2"
                @click.stop="onDelete(product)"
              />
            </div>
          </div>
        </div>
      </div>
    </template>
  </SettingsLayout>
</template>
