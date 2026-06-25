'use client';

import * as React from 'react';
import { Box, IconButton, Link, Table, TableBody, TableCell, TableHead, TableRow, Tooltip, Typography } from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckIcon from '@mui/icons-material/Check';

type Block =
  | { kind: 'heading'; level: 1 | 2 | 3; text: string }
  | { kind: 'paragraph'; text: string }
  | { kind: 'list'; ordered: boolean; items: string[] }
  | { kind: 'code'; lang: string | null; code: string }
  | { kind: 'quote'; text: string }
  | { kind: 'divider' }
  | { kind: 'table'; headers: string[]; rows: string[][] }
  | { kind: 'html'; html: string };

type Inline = { kind: 'text' | 'bold' | 'inlineCode' | 'link'; value: string; href?: string };

const FENCE_RE = /```([a-zA-Z0-9_+-]+)?\n?([\s\S]*?)```/g;
const ALLOWED_HTML_TAGS = new Set(['p', 'br', 'strong', 'b', 'em', 'i', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'blockquote', 'hr', 'code', 'pre', 'a', 'table', 'thead', 'tbody', 'tr', 'th', 'td']);
const ALLOWED_HTML_ATTRS = new Set(['href', 'target', 'rel']);

function looksLikeHtml(input: string): boolean {
  return /<\/?(p|br|strong|b|em|i|ul|ol|li|h1|h2|h3|blockquote|hr|code|pre|a|table|thead|tbody|tr|th|td)(\s|>|\/)/i.test(input);
}

function sanitizeHtml(input: string): string {
  if (typeof window === 'undefined' || typeof window.DOMParser === 'undefined') {
    return input.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '').replace(/\son\w+="[^"]*"/gi, '');
  }

  const doc = new window.DOMParser().parseFromString(`<div>${input}</div>`, 'text/html');

  const cleanNode = (node: Node): Node | null => {
    if (node.nodeType === Node.TEXT_NODE) return document.createTextNode(node.textContent || '');
    if (node.nodeType !== Node.ELEMENT_NODE) return null;

    const element = node as HTMLElement;
    const tag = element.tagName.toLowerCase();
    if (!ALLOWED_HTML_TAGS.has(tag)) {
      const fragment = document.createDocumentFragment();
      for (const child of Array.from(element.childNodes)) {
        const cleaned = cleanNode(child);
        if (cleaned) fragment.appendChild(cleaned);
      }
      return fragment;
    }

    const safe = document.createElement(tag);
    for (const attr of Array.from(element.attributes)) {
      const name = attr.name.toLowerCase();
      if (!ALLOWED_HTML_ATTRS.has(name)) continue;
      if (name === 'href' && !/^https?:\/\//i.test(attr.value)) continue;
      safe.setAttribute(name, attr.value);
    }
    if (tag === 'a') {
      safe.setAttribute('target', '_blank');
      safe.setAttribute('rel', 'noopener noreferrer');
    }
    for (const child of Array.from(element.childNodes)) {
      const cleaned = cleanNode(child);
      if (cleaned) safe.appendChild(cleaned);
    }
    return safe;
  };

  const output = document.createElement('div');
  for (const child of Array.from(doc.body.firstElementChild?.childNodes || [])) {
    const cleaned = cleanNode(child);
    if (cleaned) output.appendChild(cleaned);
  }
  return output.innerHTML;
}

function isTableDivider(line: string): boolean {
  return /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line);
}

function splitTableLine(line: string): string[] {
  return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((cell) => cell.trim());
}

function splitBlocks(input: string): Block[] {
  const blocks: Block[] = [];
  if (!input) return blocks;

  let last = 0;
  const chunks: Array<{ type: 'text'; value: string } | { type: 'code'; lang: string | null; code: string }> = [];
  for (const match of input.matchAll(FENCE_RE)) {
    const start = match.index ?? 0;
    if (start > last) chunks.push({ type: 'text', value: input.slice(last, start) });
    chunks.push({ type: 'code', lang: match[1] || null, code: (match[2] || '').replace(/\n$/, '') });
    last = start + match[0].length;
  }
  if (last < input.length) chunks.push({ type: 'text', value: input.slice(last) });

  for (const chunk of chunks) {
    if (chunk.type === 'code') {
      blocks.push({ kind: 'code', lang: chunk.lang, code: chunk.code });
      continue;
    }

    if (looksLikeHtml(chunk.value) && chunk.value.trim().startsWith('<')) {
      blocks.push({ kind: 'html', html: chunk.value.trim() });
      continue;
    }

    const lines = chunk.value.replace(/\r\n/g, '\n').split('\n');
    for (let i = 0; i < lines.length;) {
      const line = lines[i];
      if (!line.trim()) { i++; continue; }

      const heading = line.match(/^(#{1,3})\s+(.+)$/);
      if (heading) {
        blocks.push({ kind: 'heading', level: heading[1].length as 1 | 2 | 3, text: heading[2].trim() });
        i++;
        continue;
      }

      if (/^\s*[-*_]{3,}\s*$/.test(line)) {
        blocks.push({ kind: 'divider' });
        i++;
        continue;
      }

      if (line.trim().startsWith('>')) {
        const quote: string[] = [];
        while (i < lines.length && lines[i].trim().startsWith('>')) {
          quote.push(lines[i].replace(/^\s*>\s?/, ''));
          i++;
        }
        blocks.push({ kind: 'quote', text: quote.join('\n').trim() });
        continue;
      }

      if (i + 1 < lines.length && line.includes('|') && isTableDivider(lines[i + 1])) {
        const headers = splitTableLine(line);
        const rows: string[][] = [];
        i += 2;
        while (i < lines.length && lines[i].includes('|') && lines[i].trim()) {
          rows.push(splitTableLine(lines[i]));
          i++;
        }
        blocks.push({ kind: 'table', headers, rows });
        continue;
      }

      const listMatch = line.match(/^\s*(?:([-*])|(\d+)\.)\s+(.+)$/);
      if (listMatch) {
        const ordered = Boolean(listMatch[2]);
        const items: string[] = [];
        while (i < lines.length) {
          const item = lines[i].match(/^\s*(?:([-*])|(\d+)\.)\s+(.+)$/);
          if (!item || Boolean(item[2]) !== ordered) break;
          items.push(item[3].trim());
          i++;
        }
        blocks.push({ kind: 'list', ordered, items });
        continue;
      }

      const paragraph: string[] = [];
      while (i < lines.length && lines[i].trim()) {
        if (/^(#{1,3})\s+/.test(lines[i]) || /^\s*(?:[-*]|\d+\.)\s+/.test(lines[i]) || lines[i].trim().startsWith('>')) break;
        paragraph.push(lines[i]);
        i++;
      }
      blocks.push({ kind: 'paragraph', text: paragraph.join('\n').trim() });
    }
  }
  return blocks;
}

function tokenizeInline(text: string): Inline[] {
  const tokens: Inline[] = [];
  const re = /(\*\*([^*]+?)\*\*|__([^_]+?)__|`([^`]+?)`|\[([^\]]+?)\]\((https?:\/\/[^)\s]+)\))/g;
  let last = 0;
  for (const match of text.matchAll(re)) {
    const start = match.index ?? 0;
    if (start > last) tokens.push({ kind: 'text', value: text.slice(last, start) });
    if (match[2] || match[3]) tokens.push({ kind: 'bold', value: (match[2] || match[3]).trim() });
    else if (match[4]) tokens.push({ kind: 'inlineCode', value: match[4] });
    else if (match[5] && match[6]) tokens.push({ kind: 'link', value: match[5], href: match[6] });
    last = start + match[0].length;
  }
  if (last < text.length) tokens.push({ kind: 'text', value: text.slice(last) });
  return tokens;
}

function InlineText({ text }: { text: string }) {
  return (
    <>
      {tokenizeInline(text).map((tok, i) => {
        if (tok.kind === 'bold') return <Box key={i} component="strong" sx={{ fontWeight: 800, color: 'text.primary' }}>{tok.value}</Box>;
        if (tok.kind === 'link') return <Link key={i} href={tok.href} target="_blank" rel="noopener noreferrer" underline="hover">{tok.value}</Link>;
        if (tok.kind === 'inlineCode') return (
          <Box key={i} component="code" sx={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace', fontSize: '0.9em', px: 0.55, py: 0.1, borderRadius: 0.75, bgcolor: 'rgba(129,140,248,0.12)', border: '1px solid rgba(129,140,248,0.18)', color: '#c7d2fe' }}>
            {tok.value}
          </Box>
        );
        return <React.Fragment key={i}>{tok.value}</React.Fragment>;
      })}
    </>
  );
}

function CodeBlock({ code, lang }: { code: string; lang: string | null }) {
  const [copied, setCopied] = React.useState(false);
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked */
    }
  };
  return (
    <Box sx={{ position: 'relative', my: 1.25, borderRadius: 1.5, overflow: 'hidden', bgcolor: 'rgba(9, 12, 20, 0.92)', border: '1px solid rgba(148,163,184,0.14)' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 1.5, py: 0.5, bgcolor: 'rgba(148,163,184,0.07)', borderBottom: '1px solid rgba(148,163,184,0.12)' }}>
        <Typography variant="caption" sx={{ color: 'text.disabled', textTransform: 'uppercase', fontSize: 11 }}>
          {lang || 'code'}
        </Typography>
        <Tooltip title={copied ? 'Copiado' : 'Copiar'}>
          <IconButton size="small" onClick={onCopy} aria-label="Copiar bloco de código" sx={{ color: copied ? '#34d399' : 'rgba(255,255,255,0.7)' }}>
            {copied ? <CheckIcon sx={{ fontSize: 16 }} /> : <ContentCopyIcon sx={{ fontSize: 16 }} />}
          </IconButton>
        </Tooltip>
      </Box>
      <Box component="pre" sx={{ m: 0, p: 1.5, overflowX: 'auto', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace', fontSize: 13, color: '#e6edf3', lineHeight: 1.55, whiteSpace: 'pre' }}>
        {code}
      </Box>
    </Box>
  );
}

function HtmlBlock({ html }: { html: string }) {
  const safeHtml = React.useMemo(() => sanitizeHtml(html), [html]);
  return (
    <Box
      sx={{
        '& h1,& h2,& h3': { mt: 1.1, mb: 0.6, fontWeight: 850, color: 'text.primary' },
        '& h1': { fontSize: '1.28rem' },
        '& h2': { fontSize: '1.08rem', color: '#c7d2fe' },
        '& h3': { fontSize: '0.98rem' },
        '& p': { my: 0.55, lineHeight: 1.75 },
        '& ul,& ol': { pl: 2.4, my: 0.65 },
        '& li': { mb: 0.35, lineHeight: 1.7 },
        '& blockquote': { ml: 0, my: 1, pl: 1.4, borderLeft: '3px solid rgba(129,140,248,0.75)', color: 'text.secondary' },
        '& table': { width: '100%', borderCollapse: 'collapse', my: 1, fontSize: 13 },
        '& th,& td': { border: '1px solid rgba(148,163,184,0.18)', p: 0.85, textAlign: 'left', verticalAlign: 'top' },
        '& th': { bgcolor: 'rgba(129,140,248,0.12)', fontWeight: 800 },
        '& a': { color: '#93c5fd' },
      }}
      dangerouslySetInnerHTML={{ __html: safeHtml }}
    />
  );
}

export default function BalysMarkdown({ text }: { text: string }) {
  const blocks = React.useMemo(() => splitBlocks(text), [text]);
  if (blocks.length === 0) return null;

  return (
    <Box sx={{ fontSize: 14.5, lineHeight: 1.72, overflowWrap: 'anywhere' }}>
      {blocks.map((block, idx) => {
        if (block.kind === 'code') return <CodeBlock key={idx} code={block.code} lang={block.lang} />;
        if (block.kind === 'html') return <HtmlBlock key={idx} html={block.html} />;
        if (block.kind === 'divider') return <Box key={idx} sx={{ borderTop: '1px solid rgba(148,163,184,0.16)', my: 1.25 }} />;
        if (block.kind === 'heading') {
          const fontSize = block.level === 1 ? '1.22rem' : block.level === 2 ? '1.06rem' : '0.96rem';
          return (
            <Typography key={idx} component={`h${block.level + 1}` as 'h2'} sx={{ mt: idx === 0 ? 0 : 1.25, mb: 0.55, fontSize, lineHeight: 1.3, fontWeight: 850, color: block.level === 1 ? 'text.primary' : '#c7d2fe' }}>
              <InlineText text={block.text} />
            </Typography>
          );
        }
        if (block.kind === 'quote') {
          return (
            <Box key={idx} sx={{ my: 1, pl: 1.4, borderLeft: '3px solid rgba(129,140,248,0.75)', color: 'text.secondary' }}>
              <Typography variant="body2" component="div" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>
                <InlineText text={block.text} />
              </Typography>
            </Box>
          );
        }
        if (block.kind === 'list') {
          return (
            <Box key={idx} component={block.ordered ? 'ol' : 'ul'} sx={{ pl: 2.5, my: 0.7 }}>
              {block.items.map((item, itemIdx) => (
                <Box key={itemIdx} component="li" sx={{ mb: 0.35, lineHeight: 1.65 }}>
                  <InlineText text={item} />
                </Box>
              ))}
            </Box>
          );
        }
        if (block.kind === 'table') {
          return (
            <Table key={idx} size="small" sx={{ my: 1, '& th,& td': { borderColor: 'rgba(148,163,184,0.18)' }, '& th': { fontWeight: 800, bgcolor: 'rgba(129,140,248,0.1)' } }}>
              <TableHead><TableRow>{block.headers.map((header, hIdx) => <TableCell key={hIdx}><InlineText text={header} /></TableCell>)}</TableRow></TableHead>
              <TableBody>{block.rows.map((row, rIdx) => <TableRow key={rIdx}>{block.headers.map((_, cIdx) => <TableCell key={cIdx}><InlineText text={row[cIdx] || ''} /></TableCell>)}</TableRow>)}</TableBody>
            </Table>
          );
        }
        return (
          <Typography key={idx} variant="body2" component="div" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.75, my: 0.35, fontSize: '0.92rem' }}>
            <InlineText text={block.text} />
          </Typography>
        );
      })}
    </Box>
  );
}
