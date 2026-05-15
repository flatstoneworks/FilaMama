import { useQuery } from '@tanstack/react-query'
import { Bot, FileText, ListTodo, MessageSquare, RadioTower } from 'lucide-react'
import { api } from '@/api/client'
import { cn, formatDate } from '@/lib/utils'

interface AgentContextPanelProps {
  path: string
  className?: string
}

export function AgentContextPanel({ path, className }: AgentContextPanelProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['agent-context', path],
    queryFn: () => api.getAgentContext(path),
    enabled: !!path,
  })

  if (isLoading || !data) return null

  const openTasks = data.tasks.filter((task) => !['done', 'cancelled'].includes(task.status))
  const pendingProposals = data.proposals.filter((proposal) => proposal.status === 'pending')
  const hasContext =
    !!data.artifact ||
    data.notes.length > 0 ||
    openTasks.length > 0 ||
    data.leases.length > 0 ||
    pendingProposals.length > 0

  if (!hasContext) return null

  return (
    <div className={cn('border-b bg-muted/30 px-4 py-2', className)}>
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5 text-foreground">
          <Bot className="h-3.5 w-3.5" />
          <span className="font-medium">Agent context</span>
        </div>
        {data.artifact && (
          <div className="flex items-center gap-1.5 rounded border bg-background px-2 py-1">
            <FileText className="h-3.5 w-3.5" />
            <span>{data.artifact.title || data.artifact.source_type || 'Artifact'}</span>
            {data.artifact.provider && <span className="text-muted-foreground">via {data.artifact.provider}</span>}
          </div>
        )}
        {openTasks.length > 0 && (
          <div className="flex items-center gap-1.5 rounded border bg-background px-2 py-1">
            <ListTodo className="h-3.5 w-3.5" />
            <span>{openTasks.length} task{openTasks.length === 1 ? '' : 's'}</span>
          </div>
        )}
        {data.notes.length > 0 && (
          <div className="flex items-center gap-1.5 rounded border bg-background px-2 py-1">
            <MessageSquare className="h-3.5 w-3.5" />
            <span>{data.notes.length} note{data.notes.length === 1 ? '' : 's'}</span>
          </div>
        )}
        {data.leases.length > 0 && (
          <div className="flex items-center gap-1.5 rounded border bg-background px-2 py-1">
            <RadioTower className="h-3.5 w-3.5" />
            <span>{data.leases[0].actor.name}</span>
            <span>until {formatDate(data.leases[0].expires_at)}</span>
          </div>
        )}
        {pendingProposals.length > 0 && (
          <div className="rounded border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-amber-700 dark:text-amber-300">
            {pendingProposals.length} pending review{pendingProposals.length === 1 ? '' : 's'}
          </div>
        )}
      </div>
    </div>
  )
}
