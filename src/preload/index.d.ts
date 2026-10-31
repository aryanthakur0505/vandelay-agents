import type { VandelayApi } from '../shared/types'

declare global {
  interface Window {
    vandelay: VandelayApi
  }
}
