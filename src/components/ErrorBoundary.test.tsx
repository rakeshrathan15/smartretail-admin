import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ErrorBoundary } from './ErrorBoundary'

function Broken(): never {
  throw new Error('boom')
}

describe('ErrorBoundary', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('shows its children until one crashes, then a way back', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { unmount } = render(<ErrorBoundary>fine</ErrorBoundary>)
    expect(screen.getByText('fine')).toBeInTheDocument()
    unmount()

    render(
      <ErrorBoundary>
        <Broken />
      </ErrorBoundary>,
    )
    expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong')
    expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument()
  })
})
