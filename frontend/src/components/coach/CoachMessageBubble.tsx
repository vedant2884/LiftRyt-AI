import { motion, useReducedMotion } from "framer-motion";
import MarkdownMessage from "../MarkdownMessage";
import ToolResultCard from "../ToolResultCard";
import type { ChatMessage } from "../../types/chat";

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export default function CoachMessageBubble({ message }: { message: ChatMessage }) {
  const reduceMotion = useReducedMotion();
  const isUser = message.role === "user";

  return (
    <motion.div
      initial={reduceMotion ? undefined : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className={`flex ${isUser ? "justify-end" : "justify-start"}`}
    >
      <div
        className={`max-w-[85%] rounded-xl px-4 py-2 text-sm ${
          isUser ? "bg-accent text-on-accent" : "border border-line bg-bg text-ink"
        }`}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{message.content}</p>
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
        <p className={`mt-1 text-[10px] ${isUser ? "text-on-accent/70" : "text-ink-muted"}`}>
          {formatTime(message.created_at)}
        </p>
      </div>
    </motion.div>
  );
}
