import { useLayoutEffect, useRef } from 'react'

/**
 * A ref that always holds the latest `value`, for long-lived callbacks (timers, listeners, animation
 * frames) that must see current props without being re-created. It is updated after each render,
 * never during one.
 */
export function useLatest<T>(value: T): { readonly current: T } {
  const ref = useRef(value)
  useLayoutEffect(() => {
    ref.current = value
  })
  return ref
}
