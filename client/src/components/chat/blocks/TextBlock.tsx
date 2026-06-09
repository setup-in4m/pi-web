import { renderMarkdown } from "../../../lib/markdown";

export function TextBlock({ content }: { content: string }) {
  if (!content) return null;
  return <span dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }} />;
}
