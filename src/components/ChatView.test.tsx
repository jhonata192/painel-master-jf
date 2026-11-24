import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ChatView } from './ChatView'
import type { Agent } from '../types/api'

const mockAgent: Agent = {
  id: 'agent-1',
  name: 'Larissa',
  role: 'Tech Lead',
  description: 'Tech Lead Fullstack',
  ref: 'larissa',
}

describe('ChatView', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('shows loading state initially', () => {
    render(<ChatView agent={mockAgent} companyId="company-1" />)
    expect(screen.getByText('Larissa')).toBeInTheDocument()
    // Loading skeletons should be present
    expect(screen.getByTestId('chat-loading-skeleton')).toBeInTheDocument()
  })

  it('displays agent info in header', () => {
    render(<ChatView agent={mockAgent} companyId="company-1" />)
    expect(screen.getByText('Larissa')).toBeInTheDocument()
    expect(screen.getByText('Tech Lead')).toBeInTheDocument()
  })

  it('shows loading skeletons while fetching session', () => {
    render(<ChatView agent={mockAgent} companyId="company-1" />)
    // Should show 3 skeleton elements
    const skeletons = screen.getAllByTestId('chat-loading-skeleton')
    expect(skeletons.length).toBeGreaterThanOrEqual(1)
  })
})