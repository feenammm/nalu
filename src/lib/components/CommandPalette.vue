<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { Search, X } from 'lucide-vue-next'
import type { CommandItem } from '$lib/types'
import { useI18n } from '$lib/i18n'

const props = defineProps<{ open: boolean; commands: CommandItem[] }>()
const emit = defineEmits<{ close: []; execute: [command: CommandItem] }>()
const { t } = useI18n()
const search = ref('')
const selectedIndex = ref(0)
const input = ref<HTMLInputElement>()

const filtered = computed(() => {
  const query = search.value.trim().toLowerCase()
  return query
    ? props.commands.filter((command) =>
      command.name.toLowerCase().includes(query) || command.description.toLowerCase().includes(query))
    : props.commands
})

watch(() => props.open, async (open) => {
  if (open) {
    search.value = ''
    selectedIndex.value = 0
    await nextTick()
    input.value?.focus()
  }
})
watch(search, () => { selectedIndex.value = 0 })

function execute(command: CommandItem) {
  emit('execute', command)
  emit('close')
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') emit('close')
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    selectedIndex.value = Math.min(selectedIndex.value + 1, filtered.value.length - 1)
  }
  if (event.key === 'ArrowUp') {
    event.preventDefault()
    selectedIndex.value = Math.max(selectedIndex.value - 1, 0)
  }
  if (event.key === 'Enter' && filtered.value[selectedIndex.value]) {
    execute(filtered.value[selectedIndex.value])
  }
}
</script>

<template>
  <Transition name="modal">
    <div v-if="open" class="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]" role="dialog" @keydown="handleKeydown">
      <div class="absolute inset-0 bg-black/30 backdrop-blur-sm" @click="emit('close')" />
      <div class="modal-card-inner relative w-full max-w-lg bg-popover rounded-xl shadow-2xl border overflow-hidden">
        <div class="flex items-center gap-2 px-4 py-3 border-b">
          <Search class="w-4 h-4 text-muted-foreground" />
          <input ref="input" v-model="search" class="flex-1 bg-transparent text-sm outline-none" :placeholder="t('commandPalette.search')" />
          <button class="text-muted-foreground hover:text-foreground" @click="emit('close')">
            <X class="w-4 h-4" />
          </button>
        </div>
        <div class="max-h-80 overflow-y-auto py-1">
          <button
            v-for="(command, index) in filtered"
            :key="command.id"
            class="w-full flex items-center gap-3 px-4 py-2.5 text-sm"
            :class="index === selectedIndex ? 'bg-accent text-accent-foreground' : 'text-foreground'"
            @mouseenter="selectedIndex = index"
            @click="execute(command)"
          >
            <span class="font-medium">{{ command.name }}</span>
            <span class="text-xs text-muted-foreground ml-auto">{{ command.description }}</span>
          </button>
          <div v-if="filtered.length === 0" class="px-4 py-8 text-center text-sm text-muted-foreground">{{ t('commandPalette.noResults') }}</div>
        </div>
      </div>
    </div>
  </Transition>
</template>
