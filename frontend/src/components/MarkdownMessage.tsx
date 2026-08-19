import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/** Renders the coach's markdown reply — headings, lists, tables, bold/
 * italic, code — using this app's own text tokens instead of a generic
 * typography plugin, so it matches the surrounding chat bubble exactly.
 * Headings get real vertical rhythm (space above, none on the very first
 * element) so a long structured answer reads as sections, not a wall of
 * text. */
export default function MarkdownMessage({ content }: { content: string }) {
  return (
    <div className="chat-prose space-y-3 text-sm [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p className="whitespace-pre-wrap">{children}</p>,
          strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
          em: ({ children }) => <em className="italic">{children}</em>,
          ul: ({ children }) => <ul className="ml-4 list-disc space-y-1 marker:text-ink-muted">{children}</ul>,
          ol: ({ children }) => (
            <ol className="ml-4 list-decimal space-y-1 marker:text-ink-muted">{children}</ol>
          ),
          li: ({ children }) => <li className="pl-0.5">{children}</li>,
          h1: ({ children }) => <h1 className="mt-4 text-base font-semibold">{children}</h1>,
          h2: ({ children }) => <h2 className="mt-4 text-[15px] font-semibold">{children}</h2>,
          h3: ({ children }) => (
            <h3 className="mt-3 text-sm font-semibold text-ink-secondary">{children}</h3>
          ),
          hr: () => <hr className="my-3 border-line" />,
          a: ({ children, href }) => (
            <a href={href} target="_blank" rel="noreferrer" className="text-accent hover:underline">
              {children}
            </a>
          ),
          code: ({ children, className }) => {
            // remark-gfm marks fenced blocks with a "language-x" className;
            // inline code has none — different treatment for each.
            if (className) {
              return (
                <code className="block overflow-x-auto rounded-md bg-bg/60 px-3 py-2 font-mono text-[13px] leading-relaxed">
                  {children}
                </code>
              );
            }
            return <code className="rounded bg-bg/60 px-1 py-0.5 font-mono text-[13px]">{children}</code>;
          },
          pre: ({ children }) => <pre className="my-1 overflow-x-auto rounded-md">{children}</pre>,
          table: ({ children }) => (
            <div className="overflow-x-auto rounded-md border border-line">
              <table className="w-full border-collapse text-left text-[13px]">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-surface-hover">{children}</thead>,
          tbody: ({ children }) => <tbody className="divide-y divide-line">{children}</tbody>,
          tr: ({ children }) => <tr>{children}</tr>,
          th: ({ children }) => <th className="px-3 py-1.5 font-semibold text-ink-secondary">{children}</th>,
          td: ({ children }) => <td className="px-3 py-1.5 align-top">{children}</td>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
