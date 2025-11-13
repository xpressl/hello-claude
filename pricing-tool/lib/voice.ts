export function startRecognition({
  onText,
  onEnd,
  onError,
}: {
  onText: (t: string) => void
  onEnd: () => void
  onError: (e: any) => void
}) {
  const SR = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition
  if (!SR) {
    onError("No SpeechRecognition")
    onEnd()
    return
  }
  const r = new SR()
  r.lang = "en-US"
  r.interimResults = false
  r.maxAlternatives = 1
  r.onresult = (e: any) => {
    const t = e.results[0][0].transcript
    onText(t)
  }
  r.onerror = (e: any) => onError(e)
  r.onend = () => onEnd()
  r.start()
}

export function speak(text: string) {
  if (typeof window === "undefined") return
  window.speechSynthesis.cancel()
  const uttr = new SpeechSynthesisUtterance(text)
  window.speechSynthesis.speak(uttr)
}

// naive parser: numbers + keywords
export function parseVoiceQuery(t: string) {
  const s = t.toLowerCase()
  const qty = parseFloat((s.match(/(\d+(\.\d+)?)\s*(ft|foot|feet|pcs|pieces)?/) || [])[1])
  const markupPct = parseFloat((s.match(/markup\s*(\d+(\.\d+)?)/) || [])[1])
  const search = s
    .replace(/markup\s*\d+(\.\d+)?/, "")
    .replace(/\b(\d+(\.\d+)?\s*(ft|foot|feet|pcs|pieces))\b/, "")
    .trim()
  let unit: "LF" | "EA" = "EA"
  if (/\b(ft|foot|feet)\b/.test(s)) unit = "LF"
  return { qty, markupPct, search, unit }
}
