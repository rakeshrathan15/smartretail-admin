import { Component, type ErrorInfo, type ReactNode } from 'react'

/** Shows a way back instead of a blank page when a screen crashes. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Screen crashed', error, info.componentStack)
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div role="alert" className="mx-auto mt-24 max-w-md p-6 text-center">
        <h1 className="mb-2 text-xl font-semibold">Something went wrong</h1>
        <p className="mb-4 text-sm text-slate-500">Please reload the page. Nothing you already saved has been lost.</p>
        <button type="button" className="rounded-md border border-slate-300 px-4 py-2 text-sm" onClick={() => window.location.reload()}>
          Reload
        </button>
      </div>
    )
  }
}
