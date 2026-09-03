<script setup>
const props = defineProps({
  title: { type: String, required: true },
  value: { type: [String, Number], required: true },
  subtitle: { type: String, default: null },
  trend: { type: Number, default: null },
  trendLabel: { type: String, default: null },
  variant: {
    type: String,
    default: 'default',
    validator: (v) => ['default', 'accent', 'ok', 'warn', 'danger'].includes(v)
  }
});
</script>

<template>
  <div class="card-base relative overflow-hidden transition-all duration-150 hover:shadow-xs">
    <div class="flex items-center justify-between gap-2">
      <span class="text-xs font-bold uppercase tracking-wider text-muted truncate">{{ title }}</span>
      <slot name="icon" />
    </div>

    <div class="mt-2.5 flex items-baseline gap-2">
      <span class="text-2xl sm:text-3xl font-black tracking-tight text-ink font-mono">{{ value }}</span>
      <span
        v-if="trend !== null"
        class="inline-flex items-center text-xs font-bold font-mono"
        :class="trend >= 0 ? 'text-ok' : 'text-danger'"
      >
        {{ trend >= 0 ? '↑' : '↓' }} {{ Math.abs(trend) }}%
      </span>
    </div>

    <div v-if="subtitle || trendLabel" class="mt-1 text-xs text-muted">
      <span>{{ subtitle || trendLabel }}</span>
    </div>

    <slot name="footer" />
  </div>
</template>
