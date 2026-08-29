<script setup>
/**
 * Polished skeleton loader for table rows, cards, lists, and stat metrics.
 *
 * AI-DECISION: replaces plain text "Učitavanje…" across views with animated
 * placeholders matching actual content geometry. Uses semantic tokens (bg-raised,
 * bg-sunken, border-line) so skeleton blends correctly in both light and dark themes.
 */
defineProps({
  type: {
    type: String,
    default: 'table', // 'table' | 'grid' | 'list' | 'stats' | 'card'
    validator: (v) => ['table', 'grid', 'list', 'stats', 'card'].includes(v)
  },
  rows: {
    type: Number,
    default: 6
  },
  cols: {
    type: Number,
    default: 4
  }
});
</script>

<template>
  <div class="w-full animate-pulse" role="status" aria-label="Učitavanje sadržaja">
    <!-- 1. Stats Metric Cards Skeleton -->
    <div v-if="type === 'stats'" class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <div
        v-for="i in 4"
        :key="i"
        class="rounded-lg border border-line bg-panel p-4"
      >
        <div class="h-3.5 w-24 rounded bg-raised mb-2" />
        <div class="h-8 w-32 rounded bg-sunken mb-1" />
        <div class="h-3 w-40 rounded bg-raised" />
      </div>
    </div>

    <!-- 2. Grid Cards Skeleton (e.g. Artists, Notifications) -->
    <div v-else-if="type === 'grid'" class="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
      <div
        v-for="i in rows"
        :key="i"
        class="flex flex-col items-center rounded-lg border border-line bg-panel p-4 text-center"
      >
        <div class="size-16 rounded-full bg-sunken mb-3" />
        <div class="h-4 w-28 rounded bg-raised mb-1.5" />
        <div class="h-3 w-16 rounded bg-raised" />
      </div>
    </div>

    <!-- 3. List Item Skeleton (e.g. Requests, Reports, Moderation) -->
    <div v-else-if="type === 'list'" class="space-y-2">
      <div
        v-for="i in rows"
        :key="i"
        class="flex items-center gap-3 rounded-lg border border-line bg-panel px-4 py-3.5"
      >
        <div class="size-9 shrink-0 rounded-lg bg-raised" />
        <div class="min-w-0 flex-1 space-y-1.5">
          <div class="h-4 w-1/3 rounded bg-sunken" />
          <div class="h-3 w-1/4 rounded bg-raised" />
        </div>
        <div class="h-6 w-16 rounded-full bg-raised" />
        <div class="h-4 w-12 rounded bg-raised" />
      </div>
    </div>

    <!-- 4. General Single Card Skeleton -->
    <div v-else-if="type === 'card'" class="rounded-lg border border-line bg-panel p-6 space-y-4">
      <div class="h-5 w-48 rounded bg-sunken" />
      <div class="space-y-2">
        <div class="h-4 w-full rounded bg-raised" />
        <div class="h-4 w-5/6 rounded bg-raised" />
        <div class="h-4 w-3/4 rounded bg-raised" />
      </div>
    </div>

    <!-- 5. Default Table Rows Skeleton -->
    <div v-else class="overflow-hidden rounded-lg border border-line bg-panel">
      <div class="border-b border-line bg-surface/50 px-4 py-3 flex gap-4">
        <div
          v-for="c in cols"
          :key="c"
          class="h-3.5 rounded bg-raised"
          :style="{ width: c === 1 ? '40%' : `${60 / (cols - 1)}%` }"
        />
      </div>
      <div class="divide-y divide-line-soft">
        <div
          v-for="r in rows"
          :key="r"
          class="px-4 py-3.5 flex items-center gap-4"
        >
          <div
            v-for="c in cols"
            :key="c"
            class="h-4 rounded"
            :class="c === 1 ? 'bg-sunken' : 'bg-raised'"
            :style="{ width: c === 1 ? '40%' : `${50 / (cols - 1)}%` }"
          />
        </div>
      </div>
    </div>
    <span class="sr-only">Učitavanje podataka...</span>
  </div>
</template>
