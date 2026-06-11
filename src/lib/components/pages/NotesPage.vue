<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { Plus, Trash2, FileText, Search, Tag, Eye, Pencil, X } from 'lucide-vue-next'
import type { Note } from '$lib/types'
import { useI18n } from '$lib/i18n'
import { useAiRefresh } from '$lib/composables/useAiRefresh'
import { renderMarkdown } from '$lib/utils/markdown'

const { t } = useI18n()
const notes = ref<Note[]>([])
const selectedNote = ref<Note | null>(null)
const searchQuery = ref('')
const filterType = ref('all')
const selectedTag = ref('')
const preview = ref(false)

// Tag editor state
const tagInput = ref('')
const showTagSuggestions = ref(false)
const tagInputRef = ref<HTMLInputElement>()

function parseTags(value: string) {
  return value.split(',').map((tag) => tag.trim()).filter(Boolean)
}

const allTags = computed(() => {
  const set = new Set<string>()
  for (const note of notes.value) {
    for (const tag of parseTags(note.tags)) set.add(tag)
  }
  return [...set].sort()
})

const currentNoteTags = computed(() => {
  if (!selectedNote.value) return [] as string[]
  return parseTags(selectedNote.value.tags)
})

const tagSuggestions = computed(() => {
  const current = new Set(currentNoteTags.value)
  const query = tagInput.value.toLowerCase()
  return allTags.value.filter((tag) => !current.has(tag) && (!query || tag.toLowerCase().includes(query)))
})

const filteredNotes = computed(() => notes.value.filter((note) => {
  const query = searchQuery.value.toLowerCase()
  if (query && !note.title.toLowerCase().includes(query) && !note.content.toLowerCase().includes(query)) return false
  if (filterType.value !== 'all' && note.note_type !== filterType.value) return false
  if (selectedTag.value && !parseTags(note.tags).includes(selectedTag.value)) return false
  return true
}))

const renderedContent = computed(() => renderMarkdown(selectedNote.value?.content ?? ''))

function setNoteTags(tags: string[]) {
  if (!selectedNote.value) return
  selectedNote.value.tags = tags.join(',')
  void updateNote()
}

function addTag(tag: string) {
  const normalized = tag.trim()
  if (!normalized || !selectedNote.value) return
  const tags = currentNoteTags.value
  if (!tags.includes(normalized)) {
    setNoteTags([...tags, normalized])
  }
  tagInput.value = ''
  showTagSuggestions.value = false
}

function removeTag(tag: string) {
  setNoteTags(currentNoteTags.value.filter((t) => t !== tag))
}

function onTagInputKeydown(event: KeyboardEvent) {
  if (event.isComposing) return
  if (event.key === 'Enter' || event.key === ',') {
    event.preventDefault()
    if (tagInput.value.trim()) {
      addTag(tagInput.value)
    }
  }
  if (event.key === 'Backspace' && !tagInput.value && currentNoteTags.value.length) {
    removeTag(currentNoteTags.value[currentNoteTags.value.length - 1])
  }
}

function onTagInputBlur() {
  setTimeout(() => {
    if (tagInput.value.trim()) addTag(tagInput.value)
    showTagSuggestions.value = false
  }, 150)
}

async function focusTagInput() {
  showTagSuggestions.value = true
  await nextTick()
  tagInputRef.value?.focus()
}

async function loadNotes() {
  try {
    notes.value = await invoke('get_notes')
  } catch (error) {
    console.error(error)
  }
}

async function addNote() {
  selectedNote.value = await invoke('add_note', { title: t('notes.untitled'), content: '', tags: '', noteType: 'memo' })
  preview.value = false
  tagInput.value = ''
  await loadNotes()
}

async function updateNote() {
  const note = selectedNote.value
  if (!note) return
  await invoke('update_note', { id: note.id, title: note.title, content: note.content, tags: note.tags })
  await loadNotes()
}

async function deleteNote(id: string) {
  await invoke('delete_note', { id })
  if (selectedNote.value?.id === id) selectedNote.value = null
  await loadNotes()
}

function selectNote(note: Note) {
  selectedNote.value = { ...note }
  preview.value = false
  tagInput.value = ''
  showTagSuggestions.value = false
}

onMounted(loadNotes)
useAiRefresh(loadNotes)
</script>

<template>
  <div class="h-full flex">
    <div class="w-72 border-r flex flex-col">
      <div class="p-3 border-b space-y-2">
        <div class="flex items-center gap-2">
          <div class="flex-1 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-secondary">
            <Search class="w-3.5 h-3.5 text-muted-foreground" />
            <input v-model="searchQuery" class="flex-1 bg-transparent text-sm outline-none" :placeholder="t('notes.search')" /></div>
          <button class="p-1.5 rounded-lg bg-primary text-primary-foreground transition-colors hover:bg-primary/90" @click="addNote">
            <Plus class="w-4 h-4" />
          </button>
        </div>
        <div class="flex gap-1">
          <button
            v-for="type in ['all', 'memo', 'note']"
            :key="type"
            class="px-2 py-0.5 rounded text-xs transition-colors"
            :class="filterType === type ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'"
            @click="filterType = type"
          >{{ t(`notes.${type}`) }}
          </button>
        </div>
        <div v-if="allTags.length" class="flex flex-wrap items-center gap-1">
          <Tag class="w-3 h-3 text-muted-foreground" />
          <button
            class="px-2 py-0.5 rounded text-[11px] transition-colors"
            :class="selectedTag === '' ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'"
            @click="selectedTag = ''"
          >{{ t('notes.all') }}</button>
          <button
            v-for="tag in allTags"
            :key="tag"
            class="px-2 py-0.5 rounded text-[11px] transition-colors"
            :class="selectedTag === tag ? 'bg-accent text-accent-foreground' : 'text-muted-foreground bg-secondary hover:bg-secondary/70'"
            @click="selectedTag = selectedTag === tag ? '' : tag"
          >#{{ tag }}</button>
        </div>
      </div>
      <div class="flex-1 overflow-y-auto">
        <button
          v-for="note in filteredNotes"
          :key="note.id"
          class="w-full text-left px-4 py-3 border-b transition-colors hover:bg-secondary"
          :class="{ 'bg-accent': selectedNote?.id === note.id }"
          @click="selectNote(note)"
        >
          <div class="flex items-center gap-2">
            <FileText class="w-3.5 h-3.5 text-muted-foreground" />
            <span class="text-sm font-medium truncate">{{ note.title }}</span></div>
          <div class="text-xs text-muted-foreground mt-1 truncate pl-5">{{ note.content || t('notes.empty') }}</div>
          <div v-if="parseTags(note.tags).length" class="flex flex-wrap gap-1 mt-1 pl-5">
            <span v-for="tag in parseTags(note.tags)" :key="tag" class="text-[10px] text-primary">#{{ tag }}</span>
          </div>
        </button>
        <div v-if="filteredNotes.length === 0" class="text-center py-8 text-sm text-muted-foreground">{{ t('notes.empty') }}</div>
      </div>
    </div>
    <div class="flex-1 flex flex-col">
      <div v-if="selectedNote" class="flex-1 flex flex-col p-6">
        <div class="flex items-center gap-3 mb-4">
          <input v-model="selectedNote.title" class="flex-1 text-lg font-semibold bg-transparent outline-none border-b" @blur="updateNote" />
          <button
            class="p-1.5 rounded-lg text-muted-foreground transition-colors hover:bg-secondary"
            :class="{ 'bg-secondary text-primary': preview }"
            :title="preview ? t('notes.edit') : t('notes.preview')"
            @click="preview = !preview"
          >
            <Eye v-if="!preview" class="w-4 h-4" />
            <Pencil v-else class="w-4 h-4" />
          </button>
          <button class="rounded-md p-1 text-muted-foreground/50 transition-colors hover:bg-red-50 hover:text-red-400 dark:hover:bg-red-500/10" @click="deleteNote(selectedNote.id)">
            <Trash2 class="w-4 h-4" />
          </button>
        </div>
        <!-- Tag editor -->
        <div class="flex items-start gap-2 mb-4">
          <Tag class="w-3.5 h-3.5 text-muted-foreground mt-1.5 shrink-0" />
          <div class="relative flex-1">
            <div
              class="flex flex-wrap items-center gap-1.5 min-h-[32px] px-2 py-1 rounded-lg border border-input bg-card cursor-text"
              @click="focusTagInput"
            >
              <span
                v-for="tag in currentNoteTags"
                :key="tag"
                class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent text-accent-foreground text-xs"
              >
                #{{ tag }}
                <button
                  class="hover:text-red-500 transition-colors"
                  @click.stop="removeTag(tag)"
                >
                  <X class="w-3 h-3" />
                </button>
              </span>
              <input
                ref="tagInputRef"
                v-model="tagInput"
                class="flex-1 min-w-[80px] bg-transparent text-xs outline-none py-0.5"
                :placeholder="currentNoteTags.length ? '' : t('notes.tagsPlaceholder')"
                @keydown="onTagInputKeydown"
                @focus="showTagSuggestions = true"
                @blur="onTagInputBlur"
              />
            </div>
            <!-- Suggestions dropdown -->
            <div
              v-if="showTagSuggestions && tagSuggestions.length > 0"
              class="absolute z-20 top-full left-0 right-0 mt-1 bg-card border rounded-lg shadow-lg overflow-hidden max-h-40 overflow-y-auto"
            >
              <button
                v-for="tag in tagSuggestions"
                :key="tag"
                type="button"
                class="w-full text-left px-3 py-1.5 text-xs transition-colors hover:bg-accent flex items-center gap-1.5"
                @mousedown.prevent="addTag(tag)"
              >
                <Tag class="w-3 h-3 text-muted-foreground" />
                #{{ tag }}
              </button>
            </div>
          </div>
          <select v-model="selectedNote.note_type" class="text-xs bg-secondary rounded px-2 py-1 shrink-0" @change="updateNote">
            <option value="memo">{{ t('notes.memo') }}</option>
            <option value="note">{{ t('notes.note') }}</option>
          </select>
        </div>
        <div
          v-if="preview"
          class="flex-1 overflow-y-auto text-sm leading-relaxed prose-sm"
          v-html="renderedContent"
        />
        <textarea
          v-else
          v-model="selectedNote.content"
          class="flex-1 resize-none bg-transparent outline-none text-sm leading-relaxed font-mono"
          :placeholder="t('notes.startWriting')"
          @blur="updateNote"
        />
      </div>
      <div v-else class="flex-1 flex items-center justify-center text-muted-foreground text-sm">{{ t('notes.selectOrCreate') }}</div>
    </div>
  </div>
</template>
