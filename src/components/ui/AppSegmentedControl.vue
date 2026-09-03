<script setup>
const props = defineProps({
  modelValue: { type: [String, Number], default: '' },
  options: {
    type: Array,
    required: true
  },
  size: {
    type: String,
    default: 'sm',
    validator: (v) => ['xs', 'sm', 'md'].includes(v)
  }
});

const emit = defineEmits(['update:modelValue']);

const sizeClasses = {
  xs: 'p-0.5 text-[11px]',
  sm: 'p-1 text-xs',
  md: 'p-1.5 text-sm'
};

const itemPadding = {
  xs: 'px-2 py-0.5',
  sm: 'px-3 py-1',
  md: 'px-4 py-1.5 font-semibold'
};
</script>

<template>
  <div
    class="inline-flex items-center rounded-xl border border-line-strong bg-panel shadow-2xs font-semibold select-none"
    :class="sizeClasses[size]"
  >
    <button
      v-for="opt in options"
      :key="opt.value"
      type="button"
      class="flex items-center gap-1.5 rounded-lg transition-all cursor-pointer"
      :class="[
        itemPadding[size],
        modelValue === opt.value
          ? 'bg-ink font-bold text-on-ink shadow-xs'
          : 'text-muted hover:text-ink hover:bg-raised'
      ]"
      @click="emit('update:modelValue', opt.value)"
    >
      <slot :name="opt.value" />
      <span>{{ opt.label }}</span>
      <span
        v-if="opt.badge !== undefined && opt.badge !== null"
        class="rounded-full px-1.5 py-0.2 text-[10px] font-mono leading-none"
        :class="modelValue === opt.value ? 'bg-panel/20 text-on-ink' : 'bg-surface text-faint'"
      >
        {{ opt.badge }}
      </span>
    </button>
  </div>
</template>
