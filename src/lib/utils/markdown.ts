// Minimal markdown renderer for note previews.
// Supports headings, bold, italic, inline code, code fences, links, ordered/unordered lists, blockquotes, hr.

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function isSafeUrl(url: string) {
  const decoded = url.trim().toLowerCase()
  return /^(https?:|mailto:|#|\/)/i.test(decoded)
}

function renderInline(text: string) {
  let out = escapeHtml(text)
  out = out.replace(/`([^`]+)`/g, '<code class="px-1 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-[0.85em]">$1</code>')
  out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, url) => {
    const href = isSafeUrl(url) ? url : '#'
    return `<a href="${href}" target="_blank" rel="noopener" class="text-blue-500 underline">${label}</a>`
  })
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  out = out.replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>')
  out = out.replace(/~~([^~]+)~~/g, '<del>$1</del>')
  return out
}

export function renderMarkdown(source: string): string {
  if (!source) return ''
  const lines = source.split(/\r?\n/)
  const html: string[] = []
  let inCode = false
  let codeBuf: string[] = []
  let listType: 'ul' | 'ol' | null = null

  function flushList() {
    if (listType) {
      html.push(`</${listType}>`)
      listType = null
    }
  }

  for (const raw of lines) {
    const line = raw

    if (inCode) {
      if (/^```/.test(line)) {
        html.push(`<pre class="my-2 p-3 rounded-lg bg-slate-100 dark:bg-slate-800 overflow-auto text-xs"><code>${escapeHtml(codeBuf.join('\n'))}</code></pre>`)
        codeBuf = []
        inCode = false
      } else {
        codeBuf.push(line)
      }
      continue
    }

    if (/^```/.test(line)) {
      flushList()
      inCode = true
      continue
    }

    if (/^\s*$/.test(line)) {
      flushList()
      continue
    }

    if (/^---+\s*$/.test(line)) {
      flushList()
      html.push('<hr class="my-3 border-slate-200 dark:border-slate-700" />')
      continue
    }

    const heading = line.match(/^(#{1,6})\s+(.*)$/)
    if (heading) {
      flushList()
      const level = heading[1].length
      const sizes = ['text-xl', 'text-lg', 'text-base', 'text-sm', 'text-sm', 'text-xs']
      html.push(`<h${level} class="font-semibold mt-3 mb-1 ${sizes[level - 1]}">${renderInline(heading[2])}</h${level}>`)
      continue
    }

    if (/^>\s?/.test(line)) {
      flushList()
      html.push(`<blockquote class="border-l-2 border-slate-300 dark:border-slate-600 pl-3 my-1 text-slate-600 dark:text-slate-300">${renderInline(line.replace(/^>\s?/, ''))}</blockquote>`)
      continue
    }

    const ul = line.match(/^\s*[-*+]\s+(.*)$/)
    if (ul) {
      if (listType !== 'ul') {
        flushList()
        listType = 'ul'
        html.push('<ul class="list-disc pl-5 my-1 space-y-0.5">')
      }
      html.push(`<li>${renderInline(ul[1])}</li>`)
      continue
    }

    const ol = line.match(/^\s*\d+\.\s+(.*)$/)
    if (ol) {
      if (listType !== 'ol') {
        flushList()
        listType = 'ol'
        html.push('<ol class="list-decimal pl-5 my-1 space-y-0.5">')
      }
      html.push(`<li>${renderInline(ol[1])}</li>`)
      continue
    }

    flushList()
    html.push(`<p class="my-1 leading-relaxed">${renderInline(line)}</p>`)
  }

  if (inCode) {
    html.push(`<pre class="my-2 p-3 rounded-lg bg-slate-100 dark:bg-slate-800 overflow-auto text-xs"><code>${escapeHtml(codeBuf.join('\n'))}</code></pre>`)
  }
  flushList()
  return html.join('\n')
}
