import {
  Clipboard,
  FolderPlus,
  FolderUp,
  RefreshCw,
  Upload,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

interface MobileFileActionSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  hasClipboard: boolean
  clipboardInfo?: { count: number; operation: 'copy' | 'cut' } | null
  isTrashView?: boolean
  onNewFolder: () => void
  onUpload: () => void
  onUploadFolder: () => void
  onPaste: () => void
  onRefresh: () => void
}

interface ActionButtonProps {
  icon: React.ReactNode
  label: string
  detail?: string
  destructive?: boolean
  onClick: () => void
}

function ActionButton({ icon, label, detail, destructive, onClick }: ActionButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left transition-colors',
        'hover:bg-accent active:bg-accent',
        destructive && 'text-destructive'
      )}
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-foreground">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium">{label}</span>
        {detail && <span className="block truncate text-xs text-muted-foreground">{detail}</span>}
      </span>
    </button>
  )
}

export function MobileFileActionSheet({
  open,
  onOpenChange,
  hasClipboard,
  clipboardInfo,
  isTrashView,
  onNewFolder,
  onUpload,
  onUploadFolder,
  onPaste,
  onRefresh,
}: MobileFileActionSheetProps) {
  const closeAndRun = (handler: () => void) => {
    onOpenChange(false)
    handler()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="fixed inset-x-0 bottom-0 left-0 top-auto max-w-none translate-x-0 translate-y-0 gap-0 rounded-b-none rounded-t-2xl border-x-0 border-b-0 p-0 sm:rounded-t-2xl">
        <DialogHeader className="sr-only">
          <DialogTitle>File actions</DialogTitle>
          <DialogDescription>Create folders, upload files, paste items, or refresh the current folder.</DialogDescription>
        </DialogHeader>
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-muted-foreground/30" />
        <div className="space-y-1 px-3 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-3">
          {!isTrashView && (
            <>
              <ActionButton
                icon={<Upload className="h-5 w-5" />}
                label="Upload files"
                detail="Choose one or more files from this device"
                onClick={() => closeAndRun(onUpload)}
              />
              <ActionButton
                icon={<FolderUp className="h-5 w-5" />}
                label="Upload folder"
                detail="Upload a folder and its contents"
                onClick={() => closeAndRun(onUploadFolder)}
              />
              <ActionButton
                icon={<FolderPlus className="h-5 w-5" />}
                label="New folder"
                detail="Create a folder here"
                onClick={() => closeAndRun(onNewFolder)}
              />
              {hasClipboard && (
                <ActionButton
                  icon={<Clipboard className="h-5 w-5" />}
                  label="Paste"
                  detail={clipboardInfo ? `${clipboardInfo.count} ${clipboardInfo.operation === 'cut' ? 'cut' : 'copied'}` : undefined}
                  onClick={() => closeAndRun(onPaste)}
                />
              )}
            </>
          )}
          <ActionButton
            icon={<RefreshCw className="h-5 w-5" />}
            label="Refresh"
            detail="Reload this folder"
            onClick={() => closeAndRun(onRefresh)}
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}
