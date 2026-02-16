'use client';

interface QuickRepliesProps {
    replies: string[];
    onSelect: (reply: string) => void;
}

export default function QuickReplies({ replies, onSelect }: QuickRepliesProps) {
    if (!replies || replies.length === 0) return null;

    return (
        <div
            className="flex gap-2 overflow-x-auto pb-1 px-1 animate-fade-in-up"
            role="group"
            aria-label="Quick reply suggestions"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
            {replies.map((reply, index) => (
                <button
                    key={`${reply}-${index}`}
                    onClick={() => onSelect(reply)}
                    className="quick-reply-btn whitespace-nowrap px-3.5 py-2 rounded-full text-sm font-medium border cursor-pointer shrink-0"
                    style={{
                        color: 'var(--edible-dark)',
                        borderColor: 'var(--edible-border)',
                        backgroundColor: 'var(--edible-card-bg)',
                        animation: `fadeInUp 0.3s ease-out ${index * 0.06}s both`,
                    }}
                    aria-label={`Quick reply: ${reply}`}
                >
                    {reply}
                </button>
            ))}
        </div>
    );
}
