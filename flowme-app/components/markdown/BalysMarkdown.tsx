'use client';

import * as React from 'react';
import { Box, IconButton, Tooltip, Typography } from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckIcon from '@mui/icons-material/Check';

type Block =
  | { kind: 'paragraph'; text: string }
  | { kind: 'code'; lang: string | null; code: string };

const FENCE_RE = /```([a-zA-Z0-9_+-]+)?\n?([\s\S]*?)```/g;

function splitBlocks(input: string): Block[] {
  const blocks: Block[] = [];
  if (!input) return blocks;
  let last = 0;
  for (const match of input.matchAll(FENCE_RE)) {
    const start = match.index ?? 0;
    if (start > last) {
      const para = input.slice(last, start);
      if (para.trim()) blocks.push({ kind: 'paragraph', text: para });
    }
    blocks.push({ kind: 'code', lang: (match[1] || null), code: (match[2] || '').replace(/\n$/, '') });
    last = start + match[0].length;
  }
  if (last < input.length) {
    const tail = input.slice(last);
    if (tail.trim()) blocks.push({ kind: 'paragraph', text: tail });
  }
  return blocks;
}

type Inline = { kind: 'text' | 'bold' | 'inlineCode'; value: string };

function tokenizeInline(text: string): Inline[] {
  const tokens: Inline[] = [];
  const re = /(\*\*([^*]+?)\*\*|__([^_]+?)__|`([^`]+?)`)/g;
  let last = 0;
  for (const match of text.matchAll(re)) {
    const start = match.index ?? 0;
    if (start > last) tokens.push({ kind: 'text', value: text.slice(last, start) });
    if (match[2] || match[3]) {
      tokens.push({ kind: 'bold', value: (match[2] || match[3]).trim() });
    } else if (match[4]) {
      tokens.push({ kind: 'inlineCode', value: match[4] });
    }
    last = start + match[0].length;
  }
  if (last < text.length) tokens.push({ kind: 'text', value: text.slice(last) });
  return tokens;
}

function CodeBlock({ code, lang }: { code: string; lang: string | null }) {
  const [copied, setCopied] = React.useState(false);
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked — ignore silently */
    }
  };
  return (
    <Box sx={{
      position: 'relative',
      my: 1.25,
      borderRadius: 2,
      overflow: 'hidden',
      bgcolor: 'rgba(15, 17, 23, 0.85)',
      border: '1px solid rgba(255,255,255,0.08)',
    }}>
      <Box sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        px: 1.5,
        py: 0.5,
        bgcolor: 'rgba(255,255,255,0.04)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        <Typography variant="caption" sx={{ color: 'text.disabled', textTransform: 'uppercase', letterSpacing: 0.6, fontSize: 11 }}>
          {lang || 'code'}
        </Typography>
        <Tooltip title={copied ? 'Copiado' : 'Copiar'}>
          <IconButton size="small" onClick={onCopy} aria-label="Copiar bloco de código" sx={{ color: copied ? '#34d399' : 'rgba(255,255,255,0.7)' }}>
            {copied ? <CheckIcon sx={{ fontSize: 16 }} /> : <ContentCopyIcon sx={{ fontSize: 16 }} />}
          </IconButton>
        </Tooltip>
      </Box>
      <Box component="pre" sx={{
        m: 0,
        p: 1.5,
        overflowX: 'auto',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
        fontSize: 13,
        color: '#e6edf3',
        lineHeight: 1.55,
        whiteSpace: 'pre',
      }}>
        {code}
      </Box>
    </Box>
  );
}

function Paragraph({ text }: { text: string }) {
  const tokens = tokenizeInline(text);
  return (
    <Typography
      variant="body2"
      component="div"
      sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.7, my: 0.25 }}
    >
      {tokens.map((tok, i) => {
        if (tok.kind === 'bold') return <strong key={i}>{tok.value}</strong>;
        if (tok.kind === 'inlineCode') return (
          <Box
            key={i}
            component="code"
            sx={{
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
              fontSize: '0.9em',
              px: 0.5,
              py: 0.1,
              borderRadius: 0.75,
              bgcolor: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            {tok.value}
          </Box>
        );
        return <React.Fragment key={i}>{tok.value}</React.Fragment>;
      })}
    </Typography>
  );
}

export default function BalysMarkdown({ text }: { text: string }) {
  const blocks = React.useMemo(() => splitBlocks(text), [text]);
  if (blocks.length === 0) {
    return (
      <Typography variant="body2" component="div" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>
        {text}
      </Typography>
    );
  }
  return (
    <Box>
      {blocks.map((block, idx) => (
        block.kind === 'code'
          ? <CodeBlock key={idx} code={block.code} lang={block.lang} />
          : <Paragraph key={idx} text={block.text} />
      ))}
    </Box>
  );
}
