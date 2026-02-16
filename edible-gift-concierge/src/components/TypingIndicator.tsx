'use client';

export default function TypingIndicator() {
    return (
        <div className="flex items-start gap-2 animate-fade-in" role="status" aria-label="AI is typing">
            <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-sm shrink-0"
                style={{ backgroundColor: 'var(--edible-red)', color: 'white' }}
                aria-hidden="true"
            >
                🍓
            </div>
            <div
                className="px-4 py-3 rounded-2xl rounded-tl-sm flex items-center gap-1.5"
                style={{ backgroundColor: 'var(--edible-ai-bg)' }}
            >
                <span className="typing-dot w-2 h-2 rounded-full" style={{ backgroundColor: 'var(--edible-muted)' }} />
                <span className="typing-dot w-2 h-2 rounded-full" style={{ backgroundColor: 'var(--edible-muted)' }} />
                <span className="typing-dot w-2 h-2 rounded-full" style={{ backgroundColor: 'var(--edible-muted)' }} />
            </div>
        </div>
    );
}
