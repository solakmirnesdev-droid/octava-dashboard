<script setup>
import { ref } from 'vue';
import client from '../api/client';

const emit = defineEmits(['imported']);

const open = ref(false);
const raw = ref('');
const busy = ref(false);
const error = ref(null);
const result = ref(null);

async function convert() {
  if (!raw.value.trim()) return;

  busy.value = true;
  error.value = null;
  try {
    const { data } = await client.post('/import/preview', { text: raw.value });
    result.value = data;
  } catch (err) {
    error.value = err.response?.data?.message || 'Konverzija nije uspjela.';
  } finally {
    busy.value = false;
  }
}

function apply() {
  // The key is only a guess, so it is offered rather than forced; the editor
  // keeps whatever the worker already chose if none could be read.
  emit('imported', {
    content: result.value.content,
    originalKey: result.value.originalKey
  });
  reset();
}

function reset() {
  open.value = false;
  raw.value = '';
  result.value = null;
  error.value = null;
}
</script>

<template>
  <div class="mb-6">
    <button
      v-if="!open"
      type="button"
      class="rounded border border-line-strong px-3 py-1.5 text-sm hover:border-accent"
      @click="open = true"
    >
      Uvezi iz „akordi iznad teksta"
    </button>

    <div v-else class="rounded border border-line-strong bg-panel p-4">
      <div class="mb-2 flex items-center justify-between">
        <span class="text-sm font-medium">Uvoz pjesme</span>
        <button type="button" class="text-xs text-faint hover:text-accent" @click="reset">
          Zatvori
        </button>
      </div>

      <p class="mb-3 text-xs text-muted">
        Zalijepi pjesmu u obliku u kojem su akordi u zasebnom redu iznad teksta.
        Konverzija poravnava akorde na početak riječi — provjeri rezultat prije
        nego ga primijeniš.
      </p>

      <textarea
        v-model="raw"
        spellcheck="false"
        placeholder="Refren:&#10;Am              F&#10;prvi red teksta ovdje&#10;C          G&#10;drugi red teksta"
        class="h-48 w-full resize-none rounded border border-line-strong p-3 font-mono text-sm outline-none focus:border-accent"
      />

      <div class="mt-2 flex items-center gap-3">
        <button
          type="button"
          class="rounded bg-ink px-4 py-2 text-sm font-medium text-on-ink hover:bg-accent disabled:opacity-50"
          :disabled="busy || !raw.trim()"
          @click="convert"
        >
          {{ busy ? 'Konvertujem…' : 'Konvertuj' }}
        </button>
        <span v-if="error" class="text-sm text-accent">{{ error }}</span>
      </div>

      <div v-if="result" class="mt-4 border-t border-line pt-4">
        <div class="mb-2 flex flex-wrap items-center gap-3 text-xs">
          <span class="text-muted">
            Akordi:
            <code v-for="c in result.chords" :key="c" class="ml-1 rounded bg-accent-soft px-1.5 py-0.5 text-accent">{{ c }}</code>
          </span>
          <span v-if="result.originalKey" class="text-muted">
            Tonalitet (pretpostavka): <strong class="font-mono">{{ result.originalKey }}</strong>
          </span>
        </div>

        <p v-for="w in result.warnings" :key="w" class="mb-2 text-xs text-accent">{{ w }}</p>

        <pre class="max-h-64 overflow-auto rounded bg-raised p-3 font-mono text-[13px] leading-relaxed">{{ result.content }}</pre>

        <button
          type="button"
          class="mt-3 rounded bg-ink px-4 py-2 text-sm font-medium text-on-ink hover:bg-accent"
          @click="apply"
        >
          Primijeni u editor
        </button>
      </div>
    </div>
  </div>
</template>
