// Минимальный inline-рендер markdown: **bold** и `code` — ровно то, что
// используется в тексте требований OpenSpec (SHALL/SHALL NOT в bold,
// идентификаторы в code). Не полноценный markdown-парсер — редактирование
// и богатый рендер делегируются хосту (см. design.md, "Decisions").

import type { ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const TOKEN_RE = /\*\*(.+?)\*\*|`(.+?)`/g;

export function renderInlineMarkdown(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;
  TOKEN_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = TOKEN_RE.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }
    if (match[1] !== undefined) {
      nodes.push(<strong key={key++}>{match[1]}</strong>);
    } else if (match[2] !== undefined) {
      nodes.push(<code key={key++}>{match[2]}</code>);
    }
    lastIndex = TOKEN_RE.lastIndex;
  }
  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }
  return nodes;
}

export function renderMarkdown(text: string): ReactNode {
  return <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>;
}
