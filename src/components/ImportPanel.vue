<script setup>
import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { createWorker } from 'tesseract.js';
import AppModal from './AppModal.vue';
import client from '../api/client';
import { convertOcrToChordPro, convertOcrBboxDataToChordPro } from '../utils/ocrParser';
import IconUpload from '~icons/material-symbols/upload-rounded';
import IconImage from '~icons/material-symbols/image-outline-rounded';
import IconText from '~icons/material-symbols/description-outline-rounded';
import IconScan from '~icons/material-symbols/document-scanner-outline-rounded';
import IconPaste from '~icons/material-symbols/content-paste-rounded';
import IconFolder from '~icons/material-symbols/folder-open-rounded';
import IconCheck from '~icons/material-symbols/check-circle-outline-rounded';

const emit = defineEmits(['imported']);

const open = ref(false);
const activeTab = ref('image'); // 'image' | 'text'

// Text import state
const raw = ref('');
const textBusy = ref(false);
const textError = ref(null);

// Image OCR state
const fileInputRef = ref(null);
const imageFile = ref(null);
const imagePreviewUrl = ref(null);
const ocrBusy = ref(false);
const ocrProgress = ref(0);
const ocrStatusText = ref('');
const ocrError = ref(null);
const isDragging = ref(false);
let workerInstance = null;

// Extracted result
const result = ref(null);

function onTabChange(tab) {
  activeTab.value = tab;
  textError.value = null;
  ocrError.value = null;
}

function triggerFilePick() {
  fileInputRef.value?.click();
}

async function convertText() {
  if (!raw.value.trim()) return;

  textBusy.value = true;
  textError.value = null;
  try {
    const { data } = await client.post('/import/preview', { text: raw.value });
    result.value = {
      content: data.content,
      chords: data.chords || [],
      originalKey: data.originalKey || '',
      title: '',
      artist: ''
    };
  } catch {
    // Fallback to local OCR parser logic
    const localRes = convertOcrToChordPro(raw.value);
    result.value = {
      content: localRes.content,
      chords: localRes.chords,
      originalKey: localRes.originalKey,
      title: localRes.title,
      artist: localRes.artist
    };
  } finally {
    textBusy.value = false;
  }
}

function handleFileSelect(file) {
  if (!file || !file.type.startsWith('image/')) {
    ocrError.value = 'Molimo odaberite sliku (PNG, JPG, WebP).';
    return;
  }

  if (imagePreviewUrl.value) {
    URL.revokeObjectURL(imagePreviewUrl.value);
  }

  imageFile.value = file;
  imagePreviewUrl.value = URL.createObjectURL(file);
  ocrError.value = null;
  result.value = null;

  runOcr(file);
}

function onFileInputChange(event) {
  const file = event.target.files?.[0];
  if (file) handleFileSelect(file);
  event.target.value = '';
}

function onDrop(event) {
  isDragging.value = false;
  const file = event.dataTransfer?.files?.[0];
  if (file) handleFileSelect(file);
}

async function pasteFromClipboard() {
  ocrError.value = null;
  try {
    if (!navigator.clipboard?.read) {
      ocrError.value = 'Preglednik zahtijeva prečicu Ctrl+V / Cmd+V za lijepljenje.';
      return;
    }
    const items = await navigator.clipboard.read();
    let foundImage = false;
    for (const item of items) {
      const imageType = item.types.find((t) => t.startsWith('image/'));
      if (imageType) {
        const blob = await item.getType(imageType);
        activeTab.value = 'image';
        handleFileSelect(blob);
        foundImage = true;
        break;
      }
    }
    if (!foundImage) {
      ocrError.value = 'U međuspremniku nema slike. Prvo kopirajte sliku (npr. Cmd+Shift+4 / Snipping Tool).';
    }
  } catch {
    ocrError.value = 'Pritisnite Cmd+V / Ctrl+V na tastaturi ili kliknite „Odaberi sliku”.';
  }
}

function onPaste(event) {
  const items = event.clipboardData?.items;
  if (!items) return;

  for (let i = 0; i < items.length; i++) {
    if (items[i].type.startsWith('image/')) {
      const file = items[i].getAsFile();
      if (file) {
        open.value = true;
        activeTab.value = 'image';
        handleFileSelect(file);
        break;
      }
    }
  }
}

async function runOcr(imageSource) {
  ocrBusy.value = true;
  ocrProgress.value = 0;
  ocrStatusText.value = 'Pokrećem skener…';
  ocrError.value = null;

  try {
    workerInstance = await createWorker('eng', 1, {
      logger: (m) => {
        if (m.status === 'recognizing text') {
          ocrProgress.value = Math.round((m.progress || 0) * 100);
          ocrStatusText.value = `Čitam akorde i tekst… ${ocrProgress.value}%`;
        } else if (m.status === 'loading tesseract core') {
          ocrStatusText.value = 'Učitavam OCR modul…';
        } else if (m.status === 'loading language traineddata') {
          ocrStatusText.value = 'Učitavam model prepoznavanja…';
        }
      }
    });

    await workerInstance.setParameters({
      preserve_interword_spaces: '1'
    });

    const ret = await workerInstance.recognize(imageSource);
    const rawText = ret.data?.text || '';
    raw.value = rawText;

    // Use pixel-accurate bounding box spatial alignment
    const converted = convertOcrBboxDataToChordPro(ret.data);
    result.value = {
      content: converted.content,
      chords: converted.chords,
      originalKey: converted.originalKey,
      title: converted.title,
      artist: converted.artist
    };
    ocrProgress.value = 100;
  } catch (err) {
    ocrError.value = 'Greška pri čitanju slike: ' + (err.message || err);
  } finally {
    ocrBusy.value = false;
    if (workerInstance) {
      await workerInstance.terminate();
      workerInstance = null;
    }
  }
}

function apply() {
  if (!result.value?.content) return;

  emit('imported', {
    content: result.value.content,
    originalKey: result.value.originalKey,
    title: result.value.title,
    artist: result.value.artist
  });
  closeModal();
}

function closeModal() {
  open.value = false;
  raw.value = '';
  result.value = null;
  textError.value = null;
  ocrError.value = null;
  ocrBusy.value = false;
  ocrProgress.value = 0;
  if (imagePreviewUrl.value) {
    URL.revokeObjectURL(imagePreviewUrl.value);
    imagePreviewUrl.value = null;
  }
  imageFile.value = null;
}

function openWithImage() {
  open.value = true;
  activeTab.value = 'image';
  nextTick(() => {
    triggerFilePick();
  });
}

function openPanel(tab = 'image') {
  open.value = true;
  activeTab.value = tab;
}

defineExpose({
  openWithImage,
  openPanel,
  handleFileSelect
});

onMounted(() => {
  window.addEventListener('paste', onPaste);
});

onBeforeUnmount(() => {
  window.removeEventListener('paste', onPaste);
  if (imagePreviewUrl.value) {
    URL.revokeObjectURL(imagePreviewUrl.value);
  }
  if (workerInstance) {
    workerInstance.terminate();
  }
});
</script>

<template>
  <div>
    <!-- Compact Header Trigger -->
    <button
      type="button"
      class="flex items-center gap-1.5 rounded border border-line-strong px-2.5 py-1 text-xs text-muted transition hover:border-accent hover:text-ink"
      @click="openPanel('image')"
    >
      <IconScan class="text-sm text-accent" />
      <span>Uvoz teksta / slike</span>
    </button>

    <!-- Hidden native file input for rock-solid file picking -->
    <input
      ref="fileInputRef"
      type="file"
      accept="image/*"
      class="hidden"
      @change="onFileInputChange"
    />

    <!-- Centered Modal Dialog -->
    <AppModal
      v-model="open"
      title="Uvoz pjesme i akorda"
      :dismissible="!ocrBusy"
      :busy="ocrBusy || textBusy"
      @cancel="closeModal"
    >
      <div class="space-y-4 text-xs">
        <!-- Top tab bar inside modal -->
        <div class="flex items-center justify-between border-b border-line pb-2.5">
          <div class="flex items-center gap-1 rounded bg-raised p-0.5">
            <button
              type="button"
              class="flex items-center gap-1.5 rounded px-3 py-1 font-medium transition"
              :class="activeTab === 'image' ? 'bg-ink text-on-ink shadow-xs' : 'text-muted hover:text-ink'"
              @click="onTabChange('image')"
            >
              <IconImage class="text-xs" /> Slika / OCR skener
            </button>
            <button
              type="button"
              class="flex items-center gap-1.5 rounded px-3 py-1 font-medium transition"
              :class="activeTab === 'text' ? 'bg-ink text-on-ink shadow-xs' : 'text-muted hover:text-ink'"
              @click="onTabChange('text')"
            >
              <IconText class="text-xs" /> Tekst sa akordima
            </button>
          </div>

          <span class="text-[11px] text-faint">
            {{ activeTab === 'image' ? 'Prepoznavanje iz slike' : 'Konverzija redova' }}
          </span>
        </div>

        <!-- TAB 1: SLIKA / OCR -->
        <div v-if="activeTab === 'image'" class="space-y-3">
          <!-- Drop & Paste Zone when no image is loaded yet -->
          <div
            v-if="!imagePreviewUrl"
            class="flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 text-center transition-colors"
            :class="isDragging ? 'border-accent bg-accent-soft/30' : 'border-line-strong bg-raised/30 hover:border-accent/60'"
            @dragover.prevent="isDragging = true"
            @dragleave.prevent="isDragging = false"
            @drop.prevent="onDrop"
          >
            <div class="flex size-12 items-center justify-center rounded-full bg-accent-soft text-accent mb-3">
              <IconScan class="text-2xl" />
            </div>

            <p class="text-sm font-semibold text-ink">Prevucite sliku sa akordima ovdje</p>
            <p class="text-xs text-muted max-w-sm mt-1">
              Automatski čita akorde iznad teksta sa slika pjesmarica, tablatura ili screenshotova.
            </p>

            <div class="mt-4 flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                class="flex items-center gap-1.5 rounded-lg bg-ink px-4 py-2 text-xs font-semibold text-on-ink shadow hover:bg-accent transition"
                @click="triggerFilePick"
              >
                <IconFolder class="text-sm" /> Odaberi sliku sa računara
              </button>

              <button
                type="button"
                class="flex items-center gap-1.5 rounded-lg border border-line-strong bg-panel px-3.5 py-2 text-xs font-medium text-ink hover:border-accent hover:text-accent transition"
                @click="pasteFromClipboard"
              >
                <IconPaste class="text-sm text-accent" /> Zalijepi (Cmd+V)
              </button>
            </div>

            <p class="mt-3 text-[11px] text-faint">
              PNG, JPG, WebP · Prečica: pritisnite <strong>Cmd+V / Ctrl+V</strong> bilo gdje
            </p>
          </div>

          <!-- Split Review: Image on Left + Converted Result on Right -->
          <div v-else class="space-y-3">
            <div class="grid gap-3 md:grid-cols-2">
              <!-- Left: Image Preview -->
              <div class="flex flex-col rounded-lg border border-line bg-panel p-2.5">
                <div class="mb-1.5 flex items-center justify-between text-[11px] text-muted">
                  <span class="font-medium text-ink">Originalna slika</span>
                  <div class="flex items-center gap-2">
                    <button
                      type="button"
                      class="text-accent hover:underline"
                      :disabled="ocrBusy"
                      @click="triggerFilePick"
                    >
                      Promijeni
                    </button>
                    <button
                      type="button"
                      class="text-muted hover:text-ink"
                      :disabled="ocrBusy"
                      @click="runOcr(imageFile)"
                    >
                      Ponovi
                    </button>
                  </div>
                </div>

                <div class="relative flex-1 min-h-[12rem] max-h-[16rem] overflow-hidden rounded bg-black/60 flex items-center justify-center">
                  <img :src="imagePreviewUrl" alt="Pregled slike" class="max-h-[16rem] w-full object-contain rounded" />

                  <!-- Scanning Overlay -->
                  <div
                    v-if="ocrBusy"
                    class="absolute inset-0 flex flex-col items-center justify-center bg-black/75 backdrop-blur-xs text-white p-4 text-center"
                  >
                    <div class="mb-2 h-1.5 w-4/5 overflow-hidden rounded-full bg-white/20">
                      <div class="h-full bg-accent transition-all duration-300 rounded-full" :style="{ width: ocrProgress + '%' }" />
                    </div>
                    <span class="text-xs font-medium">{{ ocrStatusText }}</span>
                  </div>
                </div>
              </div>

              <!-- Right: Recognized & Converted ChordPro Output -->
              <div class="flex flex-col rounded-lg border border-line bg-panel p-2.5">
                <div class="mb-1.5 flex items-center justify-between text-[11px]">
                  <span class="font-medium text-ink">Prepoznati akordi i tekst</span>
                  <span v-if="result?.originalKey" class="font-mono text-accent">
                    Ton: <strong>{{ result.originalKey }}</strong>
                  </span>
                </div>

                <div v-if="ocrBusy" class="flex flex-1 min-h-[12rem] items-center justify-center text-muted italic">
                  Obrada u toku…
                </div>

                <textarea
                  v-else-if="result"
                  v-model="result.content"
                  spellcheck="false"
                  rows="9"
                  placeholder="Prepoznati tekst i akordi…"
                  class="flex-1 w-full resize-none rounded border border-line-strong bg-raised/50 p-2 font-mono text-[12px] leading-relaxed outline-none focus:border-accent text-ink"
                />

                <div v-else class="flex flex-1 min-h-[12rem] items-center justify-center text-faint italic">
                  Čekam sliku za prepoznavanje…
                </div>
              </div>
            </div>

            <!-- Chords tag summary bar -->
            <div v-if="result?.chords?.length" class="flex flex-wrap items-center gap-1.5 rounded bg-raised p-2 text-[11px]">
              <span class="text-muted font-medium">Pronađeni akordi:</span>
              <code
                v-for="c in result.chords"
                :key="c"
                class="rounded bg-accent-soft px-1.5 py-0.5 text-accent font-semibold"
              >{{ c }}</code>
            </div>
          </div>

          <p v-if="ocrError" class="rounded bg-danger/10 p-2.5 text-xs text-danger border border-danger/20 font-medium">
            {{ ocrError }}
          </p>
        </div>

        <!-- TAB 2: TEKST -->
        <div v-else class="space-y-3">
          <p class="text-muted">
            Zalijepite tekst u formatu gdje su akordi u zasebnom redu iznad stihova.
          </p>

          <textarea
            v-model="raw"
            spellcheck="false"
            placeholder="Am              F&#10;prvi red teksta ovdje&#10;C          G&#10;drugi red teksta"
            class="h-44 w-full resize-none rounded border border-line-strong bg-panel p-2.5 font-mono text-xs outline-none focus:border-accent"
          />

          <div class="flex items-center gap-2">
            <button
              type="button"
              class="rounded bg-ink px-3.5 py-1.5 font-medium text-on-ink hover:bg-accent disabled:opacity-50"
              :disabled="textBusy || !raw.trim()"
              @click="convertText"
            >
              {{ textBusy ? 'Konvertujem…' : 'Konvertuj u ChordPro' }}
            </button>
            <span v-if="textError" class="text-danger">{{ textError }}</span>
          </div>

          <div v-if="result && activeTab === 'text'" class="rounded border border-line bg-raised/40 p-2.5">
            <span class="text-[11px] font-semibold text-muted uppercase tracking-wider block mb-1">Rezultat:</span>
            <pre class="max-h-32 overflow-auto font-mono text-[11px] leading-relaxed text-ink">{{ result.content }}</pre>
          </div>
        </div>
      </div>

      <!-- Modal Action Buttons -->
      <template #actions>
        <button
          type="button"
          class="rounded border border-line-strong px-3.5 py-1.5 text-xs text-muted hover:border-accent hover:text-ink transition"
          :disabled="ocrBusy || textBusy"
          @click="closeModal"
        >
          Odustani
        </button>

        <button
          type="button"
          class="flex items-center gap-1.5 rounded bg-accent px-4 py-1.5 text-xs font-semibold text-on-accent shadow hover:brightness-110 disabled:opacity-40 transition"
          :disabled="!result?.content || ocrBusy || textBusy"
          @click="apply"
        >
          <IconCheck class="text-sm" />
          <span>Primijeni u editor</span>
        </button>
      </template>
    </AppModal>
  </div>
</template>
