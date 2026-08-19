import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Pencil } from "lucide-react";
import MarkdownMessage from "../MarkdownMessage";
import ToolResultCard from "../ToolResultCard";
import type { ChatMessage } from "../../types/chat";

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

interface CoachMessageBubbleProps {
  message: ChatMessage;
  /** Only past, already-persisted user messages are editable — not while a
   * reply is generating, and not the optimistic bubble shown before the
   * server has actually assigned it an id. */
  editable?: boolean;
  editing?: boolean;
  onStartEdit?: () => void;
  onCancelEdit?: () => void;
  onSaveEdit?: (content: string) => void;
}

export default function CoachMessageBubble({
  message,
  editable,
  editing,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
}: CoachMessageBubbleProps) {
  const reduceMotion = useReducedMotion();
  const isUser = message.role === "user";
  const [draft, setDraft] = useState(message.content);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing) setDraft(message.content);
  }, [editing, message.content]);

  useEffect(() => {
    if (!editing) return;
    const el = textareaRef.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [editing]);

  return (
    <motion.div
      initial={reduceMotion ? undefined : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className={`flex ${isUser ? "justify-end" : "justify-start"}`}
    >
      <div className={`group max-w-[85%] ${editing ? "w-full sm:w-[85%]" : ""}`}>
        {editing ? (
          <div className="rounded-xl border border-accent/60 bg-bg p-3 shadow-glow">
            <textarea
              ref={textareaRef}
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value);
                e.target.style.height = "auto";
                e.target.style.height = `${e.target.scrollHeight}px`;
              }}
              onKeyDown={(e) => {
                if (e.key === "Escape") onCancelEdit?.();
              }}
              rows={1}
              className="w-full resize-none bg-transparent text-sm text-ink outline-none"
            />
            <div className="mt-2 flex justify-end gap-2 text-xs">
              <button
                type="button"
                onClick={onCancelEdit}
                className="rounded-md px-2.5 py-1 text-ink-secondary transition hover:bg-surface-hover"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => draft.trim() && onSaveEdit?.(draft)}
                disabled={!draft.trim()}
                className="rounded-md bg-accent px-2.5 py-1 font-medium text-on-accent transition hover:opacity-90 disabled:opacity-40"
              >
                Save
              </button>
            </div>
          </div>
        ) : (
          <div
            className={`rounded-xl px-4 py-2 text-sm ${
              isUser ? "bg-accent text-on-accent" : "border border-line bg-bg text-ink"
            }`}
          >
            {isUser ? (
              <p className="chat-prose whitespace-pre-wrap">{message.content}</p>
            ) : (
              <>
                {message.tool_payload && (
                  <>
                    <ToolResultCard payload={message.tool_payload} />
                    <div className="my-3 border-t border-line" />
                  </>
                )}
                <MarkdownMessage content={message.content} />
              </>
            )}
            <div
              className={`mt-1 flex items-center gap-2 ${isUser ? "justify-end" : "justify-start"}`}
            >
              <p className={`text-[10px] ${isUser ? "text-on-accent/70" : "text-ink-muted"}`}>
                {formatTime(message.created_at)}
              </p>
              {isUser && editable && (
                <button
                  type="button"
                  onClick={onStartEdit}
                  aria-label="Edit message"
                  className="text-on-accent/70 opacity-0 transition hover:text-on-accent group-hover:opacity-100 focus-visible:opacity-100"
                >
                  <Pencil className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
