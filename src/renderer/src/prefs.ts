import { useEffect, useState } from 'react'

/**
 * A per-viewer setting kept in localStorage. Storage can be unavailable or cleared, so every access
 * is guarded and the default always works.
 */
export function usePref<T extends string | boolean | string[]>(key: string, fallback: T): [T, (v: T) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(`vandelay.${key}`)
      return raw === null ? fallback : (JSON.parse(raw) as T)
    } catch {
      return fallback
    }
  })
  useEffect(() => {
    try {
      localStorage.setItem(`vandelay.${key}`, JSON.stringify(value))
    } catch {
      // Not saved; it still works for this session.
    }
  }, [key, value])
  return [value, setValue]
}

let audio: AudioContext | null = null

/** A short synthesized blip; no sound files needed. */
export function beep(freq = 880, ms = 70): void {
  try {
    audio ??= new AudioContext()
    const osc = audio.createOscillator()
    const gain = audio.createGain()
    osc.type = 'square'
    osc.frequency.value = freq
    gain.gain.setValueAtTime(0.04, audio.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + ms / 1000)
    osc.connect(gain).connect(audio.destination)
    osc.start()
    osc.stop(audio.currentTime + ms / 1000)
  } catch {
    // No audio device; stay quiet.
  }
}
