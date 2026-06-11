import { onBeforeUnmount, onMounted } from 'vue'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'

/**
 * Subscribe to the `ai-data-changed` event emitted by the AI chat widget
 * after it successfully executes tool actions.  The provided `callback`
 * is invoked immediately so the page can refresh its own data.
 */
export function useAiRefresh(callback: () => void | Promise<void>) {
  let unlisten: UnlistenFn | null = null

  onMounted(async () => {
    unlisten = await listen('ai-data-changed', () => void callback())
  })

  onBeforeUnmount(() => {
    unlisten?.()
  })
}
