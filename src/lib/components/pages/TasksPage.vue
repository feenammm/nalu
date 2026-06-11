<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { Plus, Trash2, Check, Circle, Filter, ChevronDown } from 'lucide-vue-next'
import type { Task } from '$lib/types'
import { useI18n } from '$lib/i18n'
import { Input } from '$lib/components/ui/input'
import { useAiRefresh } from '$lib/composables/useAiRefresh'

const { t } = useI18n()
const tasks = ref<Task[]>([])
const newTitle = ref('')
const newProject = ref('default')
const projectInput = ref('')
const showProjectDropdown = ref(false)
const filterProject = ref('all')
const editingId = ref<string | null>(null)
const editTitle = ref('')
const projects = computed(() => [...new Set(tasks.value.map((task) => task.project))])
const filteredTasks = computed(() => filterProject.value === 'all' ? tasks.value : tasks.value.filter((task) => task.project === filterProject.value))

const projectOptions = computed(() => {
  const query = projectInput.value.toLowerCase()
  return query
    ? projects.value.filter((p) => p.toLowerCase().includes(query))
    : projects.value
})

function selectProject(project: string) {
  newProject.value = project
  projectInput.value = project
  showProjectDropdown.value = false
}

function onProjectInputFocus() {
  projectInput.value = newProject.value === 'default' ? '' : newProject.value
  showProjectDropdown.value = true
}

function onProjectInputBlur() {
  setTimeout(() => {
    showProjectDropdown.value = false
    const trimmed = projectInput.value.trim()
    if (trimmed) {
      newProject.value = trimmed
    } else {
      newProject.value = 'default'
      projectInput.value = ''
    }
  }, 150)
}

async function loadTasks() {
  try {
    tasks.value = await invoke('get_tasks')
  } catch (error) {
    console.error(error)
  }
}

async function addTask() {
  if (!newTitle.value.trim()) return
  await invoke('add_task', { title: newTitle.value.trim(), project: newProject.value === 'default' ? null : newProject.value })
  newTitle.value = ''
  newProject.value = 'default'
  projectInput.value = ''
  await loadTasks()
}

async function toggleTask(id: string) {
  await invoke('toggle_task', { id })
  await loadTasks()
}

async function deleteTask(id: string) {
  await invoke('delete_task', { id })
  await loadTasks()
}

function startEdit(task: Task) {
  editingId.value = task.id
  editTitle.value = task.title
}

async function saveEdit() {
  if (!editingId.value || !editTitle.value.trim()) return
  await invoke('update_task', { id: editingId.value, title: editTitle.value.trim() })
  editingId.value = null
  await loadTasks()
}

function cancelEdit() {
  editingId.value = null
}

function onEditKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') saveEdit()
  else if (e.key === 'Escape') cancelEdit()
}

onMounted(loadTasks)
useAiRefresh(loadTasks)
</script>

<template>
  <div class="max-w-3xl mx-auto px-6 py-8">
    <h1 class="text-2xl font-bold mb-6">{{ t('tasks.title') }}</h1>
    <form class="flex gap-2 mb-6" @submit.prevent="addTask">
      <Input v-model="newTitle" class="flex-1" :placeholder="t('tasks.placeholder')" />
      <div class="relative">
        <div class="flex items-center">
          <Input
            v-model="projectInput"
            class="w-36 pr-7"
            :placeholder="t('tasks.project')"
            @focus="onProjectInputFocus"
            @blur="onProjectInputBlur"
            @input="showProjectDropdown = true"
          />
          <ChevronDown class="w-3.5 h-3.5 text-muted-foreground absolute right-2 pointer-events-none" />
        </div>
        <div
          v-if="showProjectDropdown && projectOptions.length > 0"
          class="absolute z-20 top-full left-0 right-0 mt-1 bg-card border rounded-lg shadow-lg overflow-hidden"
        >
          <button
            v-for="project in projectOptions"
            :key="project"
            type="button"
            class="w-full text-left px-3 py-2 text-sm transition-colors hover:bg-accent"
            @mousedown.prevent="selectProject(project)"
          >{{ project }}</button>
        </div>
      </div>
      <button type="submit" class="px-4 py-2.5 rounded-lg bg-primary text-primary-foreground transition-colors hover:bg-primary/90" :disabled="!newTitle.trim()">
        <Plus class="w-4 h-4" />
      </button>
    </form>
    <div class="flex gap-2 mb-4 items-center">
      <Filter class="w-3.5 h-3.5 text-muted-foreground" />
      <select
        v-model="filterProject"
        class="px-3 py-1.5 rounded-lg border bg-card text-xs min-w-[140px]"
      >
        <option value="all">{{ t('tasks.all') }} ({{ tasks.length }})</option>
        <option v-for="project in projects" :key="project" :value="project">
          {{ project }} ({{ tasks.filter(task => task.project === project).length }})
        </option>
      </select>
      <span class="text-xs text-muted-foreground">{{ filteredTasks.length }} {{ t('tasks.title') }}</span>
    </div>
    <div class="space-y-1.5">
      <div v-for="task in filteredTasks" :key="task.id" class="group flex items-center gap-3 px-4 py-3 rounded-lg bg-card border">
        <button class="rounded-md p-1 transition-colors hover:bg-secondary" @click="toggleTask(task.id)">
          <Check v-if="task.done" class="w-5 h-5 text-green-500" />
          <Circle v-else class="w-5 h-5 text-muted-foreground/50" />
        </button>
        <Input
          v-if="editingId === task.id"
          v-model="editTitle"
          class="flex-1 h-7 text-sm"
          @keydown="onEditKeydown"
          @blur="saveEdit"
          autofocus
        />
        <span
          v-else
          class="flex-1 text-sm cursor-text"
          :class="{ 'line-through text-muted-foreground': task.done }"
          @click="startEdit(task)"
        >{{ task.title }}</span>
        <span class="text-xs px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">{{ task.project }}</span>
        <button class="opacity-0 group-hover:opacity-100 text-muted-foreground/50 transition-colors hover:text-red-400" @click="deleteTask(task.id)">
          <Trash2 class="w-4 h-4" />
        </button>
      </div>
      <div v-if="filteredTasks.length === 0" class="text-center py-12 text-muted-foreground text-sm">{{ t('tasks.noTasks') }}</div>
    </div>
  </div>
</template>
