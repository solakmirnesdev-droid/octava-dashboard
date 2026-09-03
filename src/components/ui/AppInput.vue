<script setup>
const props = defineProps({
  modelValue: { type: [String, Number], default: '' },
  id: { type: String, default: null },
  type: { type: String, default: 'text' },
  label: { type: String, default: null },
  placeholder: { type: String, default: '' },
  required: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
  autocomplete: { type: String, default: null },
  inputmode: { type: String, default: null },
  autofocus: { type: Boolean, default: false },
  maxlength: { type: [Number, String], default: null },
  error: { type: String, default: null },
  help: { type: String, default: null },
  clearable: { type: Boolean, default: false }
});

const emit = defineEmits(['update:modelValue', 'clear']);

function onInput(e) {
  emit('update:modelValue', e.target.value);
}

function clear() {
  emit('update:modelValue', '');
  emit('clear');
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

    <div class="relative w-full flex items-center">
      <div v-if="$slots.icon" class="pointer-events-none absolute left-3 text-muted text-sm flex items-center">
        <slot name="icon" />
      </div>

      <input
        :id="id"
        :type="type"
        :value="modelValue"
        :placeholder="placeholder"
        :required="required"
        :disabled="disabled"
        :autocomplete="autocomplete"
        :inputmode="inputmode"
        :autofocus="autofocus"
        :maxlength="maxlength"
        class="input-base"
        :class="[
          $slots.icon && 'pl-9',
          clearable && modelValue && 'pr-8',
          error && '!border-danger focus:!border-danger focus:!ring-danger/15'
        ]"
        @input="onInput"
      />

      <button
        v-if="clearable && modelValue"
        type="button"
        class="absolute right-2.5 p-0.5 text-xs text-muted hover:text-ink rounded-full transition cursor-pointer"
        title="Očisti polje"
        @click="clear"
      >
        ✕
      </button>
    </div>

    <p v-if="error" class="text-xs text-danger font-medium mt-1">
      {{ error }}
    </p>
    <p v-else-if="help" class="text-xs text-muted mt-1">
      {{ help }}
    </p>
  </div>
</template>
