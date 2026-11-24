import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Sidebar } from './Sidebar'
import type { Agent } from '../types/api'

const mockAgents: Agent[] = [
  {
    id: '1',
    name: 'Sofia',
    role: 'CEO',
    description: 'CEO da empresa',
    ref: 'sofia',
  },
  {
    id: '2',
    name: 'Larissa',
    role: 'Tech Lead',
    description: 'Tech Lead Fullstack',
    ref: 'larissa',
  },
  {
    id: '3',
    name: 'Isadora',
    role: 'Product Designer',
    description: 'UX-UI Lead',
    ref: 'isadora',
  },
]

describe('Sidebar', () => {
  it('renders all agents', () => {
    render(<Sidebar agents={mockAgents} activeAgentRef="sofia" onSelectAgent={vi.fn()} />)
    expect(screen.getByText('Sofia')).toBeInTheDocument()
    expect(screen.getByText('Larissa')).toBeInTheDocument()
    expect(screen.getByText('Isadora')).toBeInTheDocument()
  })

  it('highlights active agent', () => {
    render(<Sidebar agents={mockAgents} activeAgentRef="larissa" onSelectAgent={vi.fn()} />)
    const larissaButton = screen.getByText('Larissa').closest('button')
    expect(larissaButton).toHaveClass('active')
  })

  it('calls onSelectAgent when agent is clicked', () => {
    const onSelectAgent = vi.fn()
    render(<Sidebar agents={mockAgents} activeAgentRef="sofia" onSelectAgent={onSelectAgent} />)
    fireEvent.click(screen.getByText('Isadora'))
    expect(onSelectAgent).toHaveBeenCalledWith('isadora')
  })

  it('shows collapse/expand button when onToggleCollapse provided', () => {
    render(<Sidebar agents={mockAgents} activeAgentRef="sofia" onSelectAgent={vi.fn()} onToggleCollapse={vi.fn()} />)
    expect(screen.getByLabelText('Colapsar sidebar')).toBeInTheDocument()
  })

  it('hides agent details when collapsed', () => {
    render(<Sidebar agents={mockAgents} activeAgentRef="sofia" onSelectAgent={vi.fn()} collapsed />)
    expect(screen.queryByText('CEO')).not.toBeInTheDocument()
    // When collapsed, agent name is in aria-label/title, not visible text
    expect(screen.getByTitle('Sofia')).toBeInTheDocument()
  })

  it('shows agent count when not collapsed', () => {
    render(<Sidebar agents={mockAgents} activeAgentRef="sofia" onSelectAgent={vi.fn()} />)
    expect(screen.getByText('3 agentes disponíveis')).toBeInTheDocument()
  })
})