<script setup>
const props = defineProps({
  to: { type: [String, Object], default: null },
  href: { type: String, default: null },
  variant: {
    type: String,
    default: 'primary',
    validator: (v) => ['primary', 'secondary', 'ghost', 'danger', 'accent'].includes(v)
  },
  size: {
    type: String,
    default: 'md',
    validator: (v) => ['xs', 'sm', 'md', 'lg'].includes(v)
  },
  loading: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
  block: { type: Boolean, default: false },
  type: { type: String, default: 'button' },
  title: { type: String, default: null }
});

const variantClasses = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  ghost: 'btn-ghost',
  danger: 'btn-danger',
  accent: 'btn-accent'
};

const sizeClasses = {
  xs: 'px-2.5 py-1 text-[11px] rounded-lg gap-1',
  sm: 'px-3 py-1.5 text-xs rounded-lg gap-1.5',
  md: 'px-4 py-2 text-xs sm:text-sm rounded-xl gap-2',
  lg: 'px-5 py-2.5 text-sm sm:text-base rounded-xl gap-2.5 font-bold'
};
</script>

<template>
  <RouterLink
    v-if="to"
    :to="to"
    :title="title"
    :class="[
      variantClasses[variant],
      sizeClasses[size],
      block && 'w-full justify-center',
      (disabled || loading) && 'pointer-events-none opacity-50'
    ]"
    :aria-disabled="disabled || loading"
  >
    <svg v-if="loading" class="animate-spin size-3.5 shrink-0" fill="none" viewBox="0 0 24 24">
      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
    </svg>
    <slot v-else name="icon" />

    <slot />

    <slot name="iconRight" />
  </RouterLink>

  <a
    v-else-if="href"
    :href="href"
    :title="title"
    :class="[
      variantClasses[variant],
      sizeClasses[size],
      block && 'w-full justify-center',
      (disabled || loading) && 'pointer-events-none opacity-50'
    ]"
    :aria-disabled="disabled || loading"
  >
    <svg v-if="loading" class="animate-spin size-3.5 shrink-0" fill="none" viewBox="0 0 24 24">
      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
    </svg>
    <slot v-else name="icon" />

    <slot />

    <slot name="iconRight" />
  </a>

  <button
    v-else
    :type="type"
    :title="title"
    :disabled="disabled || loading"
    :class="[
      variantClasses[variant],
      sizeClasses[size],
      block && 'w-full justify-center'
    ]"
  >
    <svg v-if="loading" class="animate-spin size-3.5 shrink-0" fill="none" viewBox="0 0 24 24">
      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
    </svg>
    <slot v-else name="icon" />

    <slot />

    <slot name="iconRight" />
  </button>
</template>
