'use client';

import React from 'react';

interface MessageBubbleProps {
    role: 'user' | 'assistant';
    content: string;
}

/**
 * Markdown parser for AI messages.
 * Supports: **bold**, [text](url), line breaks, unordered lists (- item), and ordered lists (1. item).
 */
function parseContent(text: string): React.ReactNode[] {
    const nodes: React.ReactNode[] = [];

    // Split into paragraphs
    const paragraphs = text.split(/\n\n+/);

    paragraphs.forEach((paragraph, pIdx) => {
        if (pIdx > 0) {
            nodes.push(<br key={`br-${pIdx}`} />);
            nodes.push(<br key={`br2-${pIdx}`} />);
        }

        // Check if this paragraph is a list (all lines start with - or 1. 2. etc.)
        const lines = paragraph.split('\n');
        const isUnorderedList = lines.every((l) => /^\s*[-•]\s+/.test(l.trim()) || l.trim() === '');
        const isOrderedList = lines.every((l) => /^\s*\d+[.)]\s+/.test(l.trim()) || l.trim() === '');

        if (isUnorderedList && lines.some((l) => l.trim() !== '')) {
            nodes.push(
                <ul key={`ul-${pIdx}`} className="list-disc list-inside space-y-1 my-1">
                    {lines
                        .filter((l) => l.trim() !== '')
                        .map((line, lIdx) => {
                            const content = line.replace(/^\s*[-•]\s+/, '');
                            return (
                                <li key={`li-${pIdx}-${lIdx}`}>
                                    {parseInline(content, `${pIdx}-${lIdx}`)}
                                </li>
                            );
                        })}
                </ul>
            );
            return;
        }

        if (isOrderedList && lines.some((l) => l.trim() !== '')) {
            nodes.push(
                <ol key={`ol-${pIdx}`} className="list-decimal list-inside space-y-1 my-1">
                    {lines
                        .filter((l) => l.trim() !== '')
                        .map((line, lIdx) => {
                            const content = line.replace(/^\s*\d+[.)]\s+/, '');
                            return (
                                <li key={`li-${pIdx}-${lIdx}`}>
                                    {parseInline(content, `${pIdx}-${lIdx}`)}
                                </li>
                            );
                        })}
                </ol>
            );
            return;
        }

        // Regular paragraph — process inline formatting
        lines.forEach((line, lIdx) => {
            if (lIdx > 0) {
                nodes.push(<br key={`lbr-${pIdx}-${lIdx}`} />);
            }
            nodes.push(...parseInline(line, `${pIdx}-${lIdx}`));
        });
    });

    return nodes;
}

/**
 * Parse inline formatting: **bold** and [text](url)
 */
function parseInline(line: string, keyPrefix: string): React.ReactNode[] {
    const nodes: React.ReactNode[] = [];
    const parts = line.split(/(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g);

    parts.forEach((part, partIdx) => {
        const key = `${keyPrefix}-${partIdx}`;

        // Bold
        const boldMatch = part.match(/^\*\*(.+)\*\*$/);
        if (boldMatch) {
            nodes.push(<strong key={key}>{boldMatch[1]}</strong>);
            return;
        }

        // Link
        const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
        if (linkMatch) {
            nodes.push(
                <a
                    key={key}
                    href={linkMatch[2]}
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    {linkMatch[1]}
                </a>
            );
            return;
        }

        // Plain text
        if (part) {
            nodes.push(<React.Fragment key={key}>{part}</React.Fragment>);
        }
    });

    return nodes;
}

export default function MessageBubble({ role, content }: MessageBubbleProps) {
    const isUser = role === 'user';

    return (
        <div
            className={`flex items-start gap-2.5 ${isUser ? 'flex-row-reverse' : 'flex-row'} ${isUser ? 'animate-slide-in-right' : 'animate-slide-in-left'
                }`}
        >
            {/* Avatar */}
            {!isUser && (
                <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-sm shrink-0"
                    style={{ backgroundColor: 'var(--edible-red)', color: 'white' }}
                    aria-hidden="true"
                >
                    🍓
                </div>
            )}

            {/* Bubble */}
            <div
                className={`message-content max-w-[85%] px-4 py-2.5 text-[15px] leading-relaxed ${isUser
                        ? 'rounded-2xl rounded-tr-sm'
                        : 'rounded-2xl rounded-tl-sm'
                    }`}
                style={
                    isUser
                        ? { backgroundColor: 'var(--edible-red)', color: 'white' }
                        : { backgroundColor: 'var(--edible-ai-bg)', color: 'var(--edible-dark)' }
                }
            >
                {isUser ? content : parseContent(content)}
            </div>
        </div>
    );
}
