/** Asks before a destructive action. Kept as a function so tests can stub window.confirm. */
export function confirmAction(message: string): boolean {
  return window.confirm(message)
}
