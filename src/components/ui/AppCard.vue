<script setup>
const props = defineProps({
  variant: {
    type: String,
    default: 'default',
    validator: (v) => ['default', 'interactive', 'glass', 'sunken'].includes(v)
  },
  padding: {
    type: String,
    default: 'md',
    validator: (v) => ['none', 'sm', 'md', 'lg'].includes(v)
  },
  as: { type: String, default: 'div' }
});

const variantClasses = {
  default: 'card-base',
  interactive: 'card-interactive',
  glass: 'card-glass',
  sunken: 'card-sunken'
};

const paddingClasses = {
  none: '',
  sm: 'p-3 sm:p-4',
  md: 'p-4 sm:p-5',
  lg: 'p-5 sm:p-6'
};
</script>

<template>
  <component
    :is="as"
    :class="[variantClasses[variant], paddingClasses[padding]]"
  >
    <slot />
  </component>
</template>
