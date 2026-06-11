import { onBeforeUnmount, watch } from "vue";
import { storeToRefs } from "pinia";
import { invoke } from "@tauri-apps/api/core";
import { readImage, readText } from "@tauri-apps/plugin-clipboard-manager";
import { useClipboardStore } from "$lib/stores/clipboardStore";

type ClipboardFileReference = { path: string; is_image: boolean };
type Detection = { content: string; contentType: string; dedupKey: string };

const imageExtensions = new Set([
  "png", "jpg", "jpeg", "webp", "gif", "bmp", "tif", "tiff", "heic", "heif", "avif", "ico",
]);

function decodeFileUri(value: string) {
  let path = value.trim();
  if (path.startsWith("file://")) {
    try {
      path = new URL(path).pathname;
    } catch {
      path = path.replace(/^file:\/\/(localhost)?/i, "");
    }
  }
  try { return decodeURIComponent(path); } catch { return path; }
}

function possiblePaths(text: string) {
  return text.split(/\r?\n/).map((line) => line.trim()).filter((line) => {
    if (!line || line.includes("\n")) return false;
    return line.startsWith("file://") || /^[A-Za-z]:\\/.test(line) || (line.startsWith("/") && line.length < 2048);
  }).map(decodeFileUri);
}

function isImagePath(path: string) {
  const extension = path.split(/[?#]/)[0]?.split(".").pop()?.toLowerCase();
  return !!extension && imageExtensions.has(extension);
}

async function detectNativeFile(): Promise<Detection | null> {
  try {
    const refs = await invoke<ClipboardFileReference[]>("read_clipboard_file_references");
    const paths = refs?.map((ref) => ref.path).filter(Boolean) ?? [];
    if (!paths.length) return null;
    const contentType = paths.length === 1 && refs[0]?.is_image ? "image_file" : "file";
    const content = paths.join("\n");
    return { content, contentType, dedupKey: `${contentType}:${content}` };
  } catch {
    return null;
  }
}

async function detectTextFile(text: string): Promise<Detection | null> {
  const candidates = possiblePaths(text);
  const existing: string[] = [];
  for (const path of candidates) {
    try {
      if (await invoke<boolean>("check_path_exists", { path })) existing.push(path);
    } catch {
      // Ignore invalid candidates.
    }
  }
  if (!existing.length) return null;
  const contentType = existing.length === 1 && isImagePath(existing[0]) ? "image_file" : "file";
  const content = existing.join("\n");
  return { content, contentType, dedupKey: `${contentType}:${content}` };
}

export function useClipboardMonitor() {
  const store = useClipboardStore();
  const { monitoring, lastContent } = storeToRefs(store);
  let interval: ReturnType<typeof setInterval> | undefined;

  async function save(detection: Detection) {
    if (detection.dedupKey === lastContent.value) return true;
    await invoke("add_clipboard_entry", {
      content: detection.content,
      contentType: detection.contentType,
    });
    lastContent.value = detection.dedupKey;
    return true;
  }

  async function checkClipboard() {
    try {
      const nativeFile = await detectNativeFile();
      if (nativeFile) return void await save(nativeFile);

      let text: string | null = null;
      try { text = await readText(); } catch { /* Clipboard may not contain text. */ }

      if (text?.trim()) {
        const textFile = await detectTextFile(text);
        if (textFile) return void await save(textFile);
      }

      try {
        const image = await readImage();
        if (image) {
          try {
            const size = await image.size();
            const rgba = await image.rgba();
            const length = rgba?.byteLength || rgba?.length || 0;
            if (size.width > 0 && size.height > 0 && length > 0) {
              const dedupKey = `img_${size.width}x${size.height}_${length}`;
              if (dedupKey === lastContent.value) return;
              const canvas = document.createElement("canvas");
              canvas.width = size.width;
              canvas.height = size.height;
              const context = canvas.getContext("2d");
              if (!context) return;
              const imageData = context.createImageData(size.width, size.height);
              imageData.data.set(rgba);
              context.putImageData(imageData, 0, 0);
              const imagePath = await invoke<string>("save_clipboard_image_data_url", {
                dataUrl: canvas.toDataURL("image/png"),
              });
              await save({ content: imagePath, contentType: "image", dedupKey });
              return;
            }
          } finally {
            try { await image.close(); } catch { /* Ignore cleanup failure. */ }
          }
        }
      } catch {
        // Fall through to text.
      }

      const trimmed = text?.trim();
      if (trimmed && trimmed !== lastContent.value) {
        await save({ content: trimmed, contentType: "text", dedupKey: trimmed });
      }
    } catch (error) {
      console.error("[Clipboard] monitor failed", error);
    }
  }

  function updateInterval(enabled: boolean) {
    if (interval) clearInterval(interval);
    interval = enabled ? setInterval(checkClipboard, 1000) : undefined;
  }

  watch(monitoring, updateInterval, { immediate: true });
  onBeforeUnmount(() => {
    if (interval) clearInterval(interval);
  });
}
