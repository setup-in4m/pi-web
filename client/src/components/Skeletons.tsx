export function Skeleton({ className = "", ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={`skeleton ${className}`} {...props} />;
}

export function SidebarSkeleton() {
  return (
    <aside className="w-[240px] min-w-[240px] bg-[var(--color-bg2)] border-r border-[var(--color-bd)] flex flex-col z-10">
      <div className="px-3 py-2.5 border-b border-[var(--color-bd)] flex items-center gap-2">
        <Skeleton className="w-5 h-5 rounded" />
        <Skeleton className="w-12 h-3 rounded" />
      </div>
      <div className="p-2">
        <Skeleton className="w-full h-7 rounded" />
      </div>
      <div className="flex-1 px-1.5 py-0.5 flex flex-col gap-0.5">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex flex-col gap-0.5">
            <div className="flex items-center gap-1 px-1.5 py-1">
              <Skeleton className="w-2.5 h-2.5 rounded" />
              <Skeleton className="w-4 h-3 rounded" />
              <Skeleton className="w-20 h-3 rounded" />
            </div>
            <div className="ml-3 border-l border-[var(--color-bd)] pl-2 flex flex-col gap-0.5">
              {[1, 2].map((j) => (
                <div key={j} className="flex items-center gap-1 px-1.5 py-0.5">
                  <Skeleton className="w-2 h-2 rounded" />
                  <Skeleton className="w-16 h-2.5 rounded" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}

export function ChatSkeleton() {
  return (
    <div className="flex-1 overflow-hidden px-3 py-3 flex flex-col gap-3">
      {/* User message */}
      <div className="flex gap-2 flex-row-reverse">
        <Skeleton className="w-[22px] h-[22px] rounded-full flex-shrink-0" />
        <div className="flex-1 max-w-[70%]">
          <div className="flex items-center gap-2 mb-1">
            <Skeleton className="w-6 h-2 rounded" />
            <Skeleton className="w-10 h-1.5 rounded" />
          </div>
          <Skeleton className="w-full h-5 rounded" style={{ "--radius": "8px" } as React.CSSProperties} />
        </div>
      </div>
      {/* Assistant message */}
      <div className="flex gap-2">
        <Skeleton className="w-[22px] h-[22px] rounded-full flex-shrink-0" />
        <div className="flex-1 max-w-[80%]">
          <div className="flex items-center gap-2 mb-1">
            <Skeleton className="w-4 h-2 rounded" />
            <Skeleton className="w-10 h-1.5 rounded" />
          </div>
          <Skeleton className="w-full h-16 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

export function PanelSkeleton() {
  return (
    <div className="flex flex-col bg-[var(--color-bg)] overflow-hidden min-w-0 min-h-0">
      <div className="flex items-center gap-2 px-2.5 py-0.5 bg-[var(--color-bg2)] border-b border-[var(--color-bd)]">
        <Skeleton className="w-2 h-2 rounded" />
        <Skeleton className="w-24 h-3 rounded" />
      </div>
      <ChatSkeleton />
      <div className="border-t border-[var(--color-bd)] p-1.5 bg-[var(--color-bg2)]">
        <div className="flex gap-1.5 items-end">
          <Skeleton className="flex-1 h-7 rounded-lg" />
          <Skeleton className="w-7 h-7 rounded" />
        </div>
      </div>
    </div>
  );
}
