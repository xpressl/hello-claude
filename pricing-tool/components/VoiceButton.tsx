"use client"

import { useState } from "react"
import { startRecognition } from "@/lib/voice"

export default function VoiceButton({ onText }: { onText: (t: string) => void }) {
  const [on, setOn] = useState(false)

  return (
    <button
      className={"px-3 py-2 rounded border " + (on ? "bg-green-200" : "")}
      onClick={() => {
        if (on) {
          setOn(false)
          return
        }
        setOn(true)
        startRecognition({
          onText: (t) => {
            onText(t)
          },
          onEnd: () => setOn(false),
          onError: () => setOn(false),
        })
      }}
    >
      {on ? "Listening…" : "🎙️ Voice"}
    </button>
  )
}
