<script setup>
import { computed } from 'vue';
import AppModal from './AppModal.vue';

const props = defineProps({
  modelValue: { type: Boolean, default: false }
});

const emit = defineEmits(['update:modelValue']);

const isOpen = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
});

const SHORTCUT_GROUPS = [
  {
    title: 'Navigacija i pretraga',
    items: [
      { keys: ['⌘', 'K'], altKeys: ['Ctrl', 'K'], label: 'Komandna paleta / Brza pretraga' },
      { keys: ['Alt', '1'], label: 'Pregled pjesama' },
      { keys: ['Alt', '2'], label: 'Pregled izvođača' },
      { keys: ['Alt', '3'], label: 'Statistika kataloga' },
      { keys: ['Alt', '4'], label: 'Inbox obavještenja' },
      { keys: ['?'], label: 'Otvori ovu listu prečica' }
    ]
  },
  {
    title: 'Uređivač pjesama',
    items: [
      { keys: ['⌘', 'S'], altKeys: ['Ctrl', 'S'], label: 'Sačuvaj pjesmu (skica / objavi)' },
      { keys: ['⌘', 'K'], altKeys: ['Ctrl', 'K'], label: 'Umetni akord [Akord] na kursoru' },
      { keys: ['Enter'], label: 'Novi red / stih' },
      { keys: ['Backspace'], label: 'Obriši prazan stih' },
      { keys: ['↑', '↓'], label: 'Prelazak između stihova' },
      { keys: ['Esc'], label: 'Zatvori prozor / deaktiviraj štambilj' }
    ]
  },
  {
    title: 'Formatiranje teksta',
    items: [
      { keys: ['**tekst**'], label: 'Podebljano (Bold)' },
      { keys: ['*tekst*'], label: 'Kurziv (Italic)' },
      { keys: ['~~tekst~~'], label: 'Precrtano' },
      { keys: ['[Am]'], label: 'Oznaka akorda na slogu' },
      { keys: ['[Refren]'], label: 'Zaglavlje sekcije stihova' }
    ]
  }
];

const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.userAgent);
</script>

<template>
  <AppModal
    v-model="isOpen"
    title="Tastaturne prečice"
    description="Ubrzajte rad na dashboardu pomoću prečica na tastaturi."
    confirm-label="Razumijem"
  >
    <div class="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
      <div
        v-for="group in SHORTCUT_GROUPS"
        :key="group.title"
        class="space-y-2"
      >
        <h3 class="text-xs font-bold uppercase tracking-wider text-accent border-b border-line pb-1">
          {{ group.title }}
        </h3>

        <div class="grid gap-1.5 text-xs">
          <div
            v-for="item in group.items"
            :key="item.label"
            class="flex items-center justify-between gap-3 rounded-lg bg-raised/40 p-2 hover:bg-raised/70 transition"
          >
            <span class="text-ink font-medium">{{ item.label }}</span>
            <div class="flex items-center gap-1 shrink-0">
              <template v-if="isMac || !item.altKeys">
                <kbd
                  v-for="k in item.keys"
                  :key="k"
                  class="rounded-md border border-line-strong bg-panel px-1.5 py-0.5 font-mono text-[11px] font-bold text-ink shadow-2xs"
                >
                  {{ k }}
                </kbd>
              </template>
              <template v-else>
                <kbd
                  v-for="k in item.altKeys"
                  :key="k"
                  class="rounded-md border border-line-strong bg-panel px-1.5 py-0.5 font-mono text-[11px] font-bold text-ink shadow-2xs"
                >
                  {{ k }}
                </kbd>
              </template>
            </div>
          </div>
        </div>
      </div>
    </div>
  </AppModal>
</template>
