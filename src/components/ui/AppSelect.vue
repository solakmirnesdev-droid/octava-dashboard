<script setup>
const props = defineProps({
  modelValue: { type: [String, Number], default: '' },
  id: { type: String, default: null },
  label: { type: String, default: null },
  options: {
    type: Array,
    default: () => []
  },
  required: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
  error: { type: String, default: null },
  help: { type: String, default: null }
});

const emit = defineEmits(['update:modelValue', 'change']);

function onChange(e) {
  emit('update:modelValue', e.target.value);
  emit('change', e.target.value);
}
</script>

<template>
  <div class="space-y-1.5 w-full">
    <label
      v-if="label"
      :for="id"
      class="text-xs font-bold uppercase tracking-wider text-muted block"
    >
      {{ label }}
      <span v-if="required" class="text-accent ml-0.5">*</span>
    </label>

    <div class="relative w-full">
      <select
        :id="id"
        :value="modelValue"
        :disabled="disabled"
        class="select-base"
        :class="[
          error && '!border-danger focus:!border-danger focus:!ring-danger/15'
        ]"
        @change="onChange"
      >
        <option
          v-for="opt in options"
          :key="typeof opt === 'object' ? opt.value : opt"
          :value="typeof opt === 'object' ? opt.value : opt"
        >
          {{ typeof opt === 'object' ? opt.label : opt }}
        </option>
      </select>
    </div>

    <p v-if="error" class="text-xs text-danger font-medium mt-1">
      {{ error }}
    </p>
    <p v-else-if="help" class="text-xs text-muted mt-1">
      {{ help }}
    </p>
  </div>
</template>
