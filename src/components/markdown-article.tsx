import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";

interface MarkdownArticleProps {
  markdown: string;
}

interface MarkdownAstNode {
  type?: string;
  children?: unknown[];
}

function preserveHtmlAsText() {
  return (tree: unknown) => {
    function visit(node: unknown): void {
      if (!node || typeof node !== "object") return;

      const candidate = node as MarkdownAstNode;
      if (candidate.type === "html") candidate.type = "text";
      candidate.children?.forEach(visit);
    }

    visit(tree);
  };
}

function isExternalLink(href: string | undefined): boolean {
  return Boolean(href && /^(?:https?:)?\/\//i.test(href));
}

export function MarkdownArticle({ markdown }: MarkdownArticleProps) {
  return (
    <div className="markdown-body">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks, preserveHtmlAsText]}
        rehypePlugins={[rehypeHighlight]}
        skipHtml
        components={{
          a({ href, children, ...props }) {
            return isExternalLink(href) ? (
              <a
                {...props}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
              >
                {children}
                <span className="external-link-mark" aria-hidden="true">
                  ↗
                </span>
              </a>
            ) : (
              <a {...props} href={href}>
                {children}
              </a>
            );
          },
          table({ children, ...props }) {
            return (
              <div className="table-scroll" tabIndex={0}>
                <table {...props}>{children}</table>
              </div>
            );
          },
        }}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
}
