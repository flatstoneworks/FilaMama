import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Bot, Check, Clock, FileText, FolderOpen, ListTodo, RadioTower, X } from 'lucide-react'
import { api, type AgentProposal } from '@/api/client'
import { Sidebar } from '@/components/Sidebar'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { useFavorites } from '@/hooks/useFavorites'
import { formatDate } from '@/lib/utils'
import { toast } from '@/components/ui/use-toast'

function encodePathForUrl(path: string) {
  return path.split('/').map(segment => encodeURIComponent(segment)).join('/')
}

function proposalTarget(proposal: AgentProposal) {
  return proposal.paths[0] || '/'
}

export function AgentInboxPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { favorites, removeFromFavorites } = useFavorites()

  const { data: config } = useQuery({
    queryKey: ['config'],
    queryFn: () => api.getConfig(),
    staleTime: Infinity,
  })

  const { data: trashInfo } = useQuery({
    queryKey: ['trash-info'],
    queryFn: () => api.getTrashInfo(),
  })

  const { data: inbox, isLoading } = useQuery({
    queryKey: ['agent-inbox'],
    queryFn: () => api.getAgentInbox(),
  })

  const approveMutation = useMutation({
    mutationFn: (id: string) => api.approveProposal(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent-inbox'] })
      queryClient.invalidateQueries({ queryKey: ['files'] })
      queryClient.invalidateQueries({ queryKey: ['trash-info'] })
      toast({ title: 'Proposal approved' })
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to approve proposal', description: error.message, variant: 'destructive' })
    },
  })

  const rejectMutation = useMutation({
    mutationFn: (id: string) => api.rejectProposal(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent-inbox'] })
      toast({ title: 'Proposal rejected' })
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to reject proposal', description: error.message, variant: 'destructive' })
    },
  })

  const counts = useMemo(() => ({
    proposals: inbox?.proposals.length ?? 0,
    tasks: inbox?.tasks.length ?? 0,
  }), [inbox])

  const handleNavigate = (path: string) => {
    navigate(`/browse${encodePathForUrl(path)}`)
  }

  return (
    <div className="h-screen flex bg-background">
      <Sidebar
        currentPath="/agent"
        onNavigate={handleNavigate}
        favorites={favorites}
        onRemoveFavorite={removeFromFavorites}
        mounts={config?.mounts}
        contentTypes={config?.content_types}
        trashCount={trashInfo?.count ?? 0}
        agentOpenTasks={counts.tasks}
        agentPendingProposals={counts.proposals}
        onOpenAgentInbox={() => navigate('/agent')}
      />

      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="border-b px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-semibold">Agent Inbox</h1>
              <p className="text-sm text-muted-foreground">
                Review destructive proposals and inspect agent-created artifacts.
              </p>
            </div>
          </div>
        </header>

        <ScrollArea className="flex-1">
          <div className="grid gap-4 p-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
            <section className="rounded-md border bg-background">
              <div className="flex items-center gap-2 border-b px-4 py-3">
                <Clock className="h-4 w-4 text-amber-600" />
                <h2 className="font-medium">Pending Reviews</h2>
                <span className="ml-auto text-xs text-muted-foreground">{counts.proposals}</span>
              </div>
              <div className="divide-y">
                {isLoading ? (
                  <div className="px-4 py-6 text-sm text-muted-foreground">Loading...</div>
                ) : !inbox?.proposals.length ? (
                  <div className="px-4 py-6 text-sm text-muted-foreground">No pending proposals.</div>
                ) : inbox.proposals.map((proposal) => (
                  <div key={proposal.id} className="px-4 py-3">
                    <div className="flex items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{proposal.summary}</span>
                          <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                            {proposal.operation.replace('_', ' ')}
                          </span>
                        </div>
                        <button
                          className="mt-1 text-left text-sm text-primary hover:underline"
                          onClick={() => handleNavigate(proposalTarget(proposal))}
                        >
                          {proposal.paths.join(', ')}
                        </button>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {proposal.actor.name} • {formatDate(proposal.created_at)}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => rejectMutation.mutate(proposal.id)}
                          disabled={rejectMutation.isPending}
                        >
                          <X className="mr-1.5 h-3.5 w-3.5" />
                          Reject
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => approveMutation.mutate(proposal.id)}
                          disabled={approveMutation.isPending}
                        >
                          <Check className="mr-1.5 h-3.5 w-3.5" />
                          Approve
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-md border bg-background">
              <div className="flex items-center gap-2 border-b px-4 py-3">
                <ListTodo className="h-4 w-4 text-primary" />
                <h2 className="font-medium">Open Tasks</h2>
                <span className="ml-auto text-xs text-muted-foreground">{counts.tasks}</span>
              </div>
              <div className="divide-y">
                {!inbox?.tasks.length ? (
                  <div className="px-4 py-6 text-sm text-muted-foreground">No open tasks.</div>
                ) : inbox.tasks.map((task) => (
                  <div key={task.id} className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{task.title}</span>
                      <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                        {task.status.replace('_', ' ')}
                      </span>
                    </div>
                    {task.description && <p className="mt-1 text-sm text-muted-foreground">{task.description}</p>}
                    <button
                      className="mt-1 text-left text-sm text-primary hover:underline"
                      onClick={() => handleNavigate(task.path)}
                    >
                      {task.path}
                    </button>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-md border bg-background">
              <div className="flex items-center gap-2 border-b px-4 py-3">
                <FileText className="h-4 w-4 text-primary" />
                <h2 className="font-medium">Recent Artifacts</h2>
              </div>
              <div className="divide-y">
                {!inbox?.artifacts.length ? (
                  <div className="px-4 py-6 text-sm text-muted-foreground">No agent artifacts yet.</div>
                ) : inbox.artifacts.map((artifact) => (
                  <div key={artifact.path} className="px-4 py-3">
                    <button
                      className="font-medium text-primary hover:underline"
                      onClick={() => handleNavigate(artifact.path)}
                    >
                      {artifact.title || artifact.path.split('/').pop() || artifact.path}
                    </button>
                    {(artifact.description || artifact.prompt_summary) && (
                      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                        {artifact.description || artifact.prompt_summary}
                      </p>
                    )}
                    <div className="mt-2 flex flex-wrap gap-1.5 text-xs text-muted-foreground">
                      {artifact.provider && <span className="rounded bg-muted px-1.5 py-0.5">{artifact.provider}</span>}
                      {artifact.source_type && <span className="rounded bg-muted px-1.5 py-0.5">{artifact.source_type}</span>}
                      {artifact.labels.map((label) => (
                        <span key={label} className="rounded bg-muted px-1.5 py-0.5">{label}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-md border bg-background">
              <div className="flex items-center gap-2 border-b px-4 py-3">
                <RadioTower className="h-4 w-4 text-primary" />
                <h2 className="font-medium">Active Work</h2>
              </div>
              <div className="divide-y">
                {!inbox?.leases.length ? (
                  <div className="px-4 py-6 text-sm text-muted-foreground">No active leases.</div>
                ) : inbox.leases.map((lease) => (
                  <div key={lease.id} className="px-4 py-3">
                    <div className="font-medium">{lease.actor.name}</div>
                    <p className="text-sm text-muted-foreground">{lease.purpose}</p>
                    <button
                      className="mt-1 text-left text-sm text-primary hover:underline"
                      onClick={() => handleNavigate(lease.path)}
                    >
                      {lease.path}
                    </button>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-md border bg-background xl:col-span-2">
              <div className="flex items-center gap-2 border-b px-4 py-3">
                <FolderOpen className="h-4 w-4 text-primary" />
                <h2 className="font-medium">Activity</h2>
              </div>
              <div className="divide-y">
                {!inbox?.activity.length ? (
                  <div className="px-4 py-6 text-sm text-muted-foreground">No activity yet.</div>
                ) : inbox.activity.map((event) => (
                  <div key={event.id} className="flex items-start gap-3 px-4 py-3">
                    <div className="mt-1 h-2 w-2 rounded-full bg-primary" />
                    <div className="min-w-0">
                      <p className="text-sm">{event.summary}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {event.actor.name} • {event.action} • {formatDate(event.timestamp)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </ScrollArea>
      </main>
    </div>
  )
}
