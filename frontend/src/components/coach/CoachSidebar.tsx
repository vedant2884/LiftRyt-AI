import { DumbbellIcon } from "../icons";
import { Button } from "../Button";
import { Skeleton } from "../Skeleton";
import type { ChatSession } from "../../types/chat";

function formatSessionDate(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  if (isToday) return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

interface CoachSidebarProps {
  sessions: ChatSession[];
  sessionsLoading: boolean;
  activeSessionId: string | null;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  onNewChat: () => void;
  onOpenSession: (id: string) => void;
}

function SidebarContent({
  sessions,
  sessionsLoading,
  activeSessionId,
  onNewChat,
  onOpenSession,
}: Omit<CoachSidebarProps, "mobileOpen" | "onCloseMobile">) {
  return (
    <>
      <div className="p-3">
        <Button variant="secondary" onClick={onNewChat} className="w-full">
          + New chat
        </Button>
      </div>
      <div className="flex-1 space-y-1 overflow-y-auto px-2 pb-2">
        {sessionsLoading &&
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="px-2 py-2">
              <Skeleton className="h-3.5 w-4/5" />
              <Skeleton className="mt-1.5 h-2.5 w-1/3" />
            </div>
          ))}
        {!sessionsLoading && sessions.length === 0 && (
          <div className="flex flex-col items-center gap-2 px-2 py-6 text-center">
            <DumbbellIcon className="h-5 w-5 text-ink-muted" />
            <p className="text-xs text-ink-muted">No past conversations yet.</p>
          </div>
        )}
        {!sessionsLoading &&
          sessions.map((s) => (
            <button
              key={s.id}
              onClick={() => onOpenSession(s.id)}
              className={`block w-full truncate rounded-md border-l-2 px-2 py-2 text-left text-sm transition hover:-translate-y-px active:scale-[0.98] ${
                s.id === activeSessionId
                  ? "border-accent bg-surface-hover text-ink"
                  : "border-transparent text-ink-secondary hover:bg-surface-hover hover:text-ink"
              }`}
            >
              <span className="block truncate">{s.title ?? "New chat"}</span>
              <span className="block text-[10px] text-ink-muted">{formatSessionDate(s.updated_at)}</span>
            </button>
          ))}
      </div>
    </>
  );
}

/** Rendered twice internally — a permanent desktop column and a mobile
 * slide-in drawer + backdrop — same as the page's previous single-file
 * layout, just extracted so CoachPage.tsx isn't one 350-line file. */
export default function CoachSidebar(props: CoachSidebarProps) {
  const { mobileOpen, onCloseMobile } = props;
  return (
    <>
      <aside className="hidden w-64 shrink-0 flex-col rounded-xl border border-line bg-surface md:flex">
        <SidebarContent {...props} />
      </aside>

      {mobileOpen && <div className="fixed inset-0 z-40 bg-black/50 md:hidden" onClick={onCloseMobile} />}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col border-r border-line bg-surface transition-transform duration-200 md:hidden ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <SidebarContent {...props} />
      </aside>
    </>
  );
}
