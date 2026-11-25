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
  it('renders an accessible agent combobox instead of individual agent buttons when expanded', () => {
    render(<Sidebar agents={mockAgents} activeAgentRef="sofia" onSelectAgent={vi.fn()} />)
    const combobox = screen.getByRole('combobox', { name: /Selecionar agente/i })
    expect(combobox).toBeInTheDocument()
    expect(combobox).toHaveValue('Sofia — CEO')
    expect(screen.queryByRole('button', { name: /Isadora/i })).not.toBeInTheDocument()
  })

  it('filters agents in the combobox and calls onSelectAgent when an option is selected', () => {
    const onSelectAgent = vi.fn()
    render(<Sidebar agents={mockAgents} activeAgentRef="sofia" onSelectAgent={onSelectAgent} />)

    const combobox = screen.getByRole('combobox', { name: /Selecionar agente/i })
    fireEvent.focus(combobox)
    fireEvent.change(combobox, { target: { value: 'Isa' } })

    const option = screen.getByRole('option', { name: /Isadora/i })
    expect(option).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: /Larissa/i })).not.toBeInTheDocument()

    fireEvent.mouseDown(option)
    expect(onSelectAgent).toHaveBeenCalledWith('isadora')
  })

  it('supports keyboard navigation (ArrowDown + Enter) in the agent combobox', () => {
    const onSelectAgent = vi.fn()
    render(<Sidebar agents={mockAgents} activeAgentRef={null} onSelectAgent={onSelectAgent} />)

    const combobox = screen.getByRole('combobox', { name: /Selecionar agente/i })
    fireEvent.focus(combobox)
    // Sorted alphabetically: Isadora (0), Larissa (1), Sofia (2)
    fireEvent.keyDown(combobox, { key: 'ArrowDown' })
    fireEvent.keyDown(combobox, { key: 'Enter' })

    expect(onSelectAgent).toHaveBeenCalledWith('larissa')
  })

  it('shows collapse/expand button when onToggleCollapse provided', () => {
    render(<Sidebar agents={mockAgents} activeAgentRef="sofia" onSelectAgent={vi.fn()} onToggleCollapse={vi.fn()} />)
    expect(screen.getByLabelText('Colapsar sidebar')).toBeInTheDocument()
  })

  it('hides agent details when collapsed', () => {
    render(<Sidebar agents={mockAgents} activeAgentRef="sofia" onSelectAgent={vi.fn()} collapsed />)
    expect(screen.queryByText('CEO')).not.toBeInTheDocument()
    expect(screen.getByTitle('Sofia')).toBeInTheDocument()
  })

  it('shows agent count when not collapsed', () => {
    render(<Sidebar agents={mockAgents} activeAgentRef="sofia" onSelectAgent={vi.fn()} />)
    expect(screen.getByText('3 agentes disponíveis')).toBeInTheDocument()
  })
})
