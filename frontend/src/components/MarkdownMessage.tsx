import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/** Renders the coach's markdown reply (bold headers, bullet lists, short
 * paragraphs) using this app's own text tokens instead of a generic
 * typography plugin, so it matches the surrounding chat bubble exactly. */
export default function MarkdownMessage({ content }: { content: string }) {
  return (
    <div className="space-y-2 text-sm leading-relaxed [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p className="whitespace-pre-wrap">{children}</p>,
          strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
          ul: ({ children }) => <ul className="ml-4 list-disc space-y-1">{children}</ul>,
          ol: ({ children }) => <ol className="ml-4 list-decimal space-y-1">{children}</ol>,
          li: ({ children }) => <li>{children}</li>,
          h1: ({ children }) => <p className="text-base font-semibold">{children}</p>,
          h2: ({ children }) => <p className="text-[15px] font-semibold">{children}</p>,
          h3: ({ children }) => <p className="text-sm font-semibold text-ink-secondary">{children}</p>,
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
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
