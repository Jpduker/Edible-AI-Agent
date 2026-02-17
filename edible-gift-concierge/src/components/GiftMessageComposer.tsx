'use client';

import { useState, useCallback } from 'react';
import type { Product, GiftContext } from '@/lib/types';
import { X, Wand2, Copy, Check, RefreshCw, MessageSquareHeart, Gift } from 'lucide-react';

interface GiftMessageComposerProps {
    isOpen: boolean;
    onClose: () => void;
    product: Product | null;
    context: GiftContext;
}

// ─── Tone-based message templates ───
// These are starter templates when the AI API isn't available.
// The component also calls the chat API for Claude-generated messages.
const MESSAGE_TEMPLATES: Record<string, string[]> = {
    Birthday: [
        'Wishing you the sweetest birthday ever! 🎂 Hope this makes your day as special as you are.',
        'Happy Birthday! 🎉 May this year bring you as much joy as you bring to everyone around you.',
        'Another year more awesome! 🌟 Enjoy every bite of your special day.',
    ],
    "Valentine's Day": [
        'You make every day sweeter than chocolate-covered strawberries. Happy Valentine\'s Day! ❤️',
        'To the one who has my heart — every day with you is a gift. Be mine forever. 💝',
        "No amount of sweetness compares to loving you. Happy Valentine's Day! 🌹",
    ],
    'Thank You': [
        'Your kindness means the world to me. This is just a small token of my big gratitude! 🙏',
        'Thank you for everything you do. Hope this puts a smile on your face! 😊',
        'Words aren\'t enough, so I\'m sending treats! Thank you from the bottom of my heart.',
    ],
    Anniversary: [
        'Here\'s to another year of sweet memories together. Happy Anniversary! 💍',
        'Every year with you gets sweeter. Celebrating us today and always! 🥂',
        'To the love of my life — thank you for making every moment special. Happy Anniversary! ❤️',
    ],
    Sympathy: [
        'Thinking of you during this difficult time. I hope these bring a small moment of comfort. 💛',
        'No words can ease the pain, but know that you\'re in my thoughts and heart. With deepest sympathy.',
        'Sending you warmth and love when you need it most. You\'re not alone. 🕊️',
    ],
    'Just Because': [
        'No special reason — just wanted to remind you how awesome you are! 🎁',
        'Saw these and thought of you. Because some people deserve surprises on random Tuesdays! 😄',
        'Just because you\'re you, and that\'s reason enough to celebrate. Enjoy! 🍓',
    ],
    default: [
        'Hope these bring a big smile to your face! Enjoy every bite. 🍓',
        'A little something sweet because you deserve it! 🎁✨',
        'Thinking of you and sending sweetness your way. Enjoy! 💝',
    ],
};

// ─── Tone options for the composer ───
const TONE_OPTIONS = [
    { id: 'warm', label: '🤗 Warm', description: 'Heartfelt and friendly' },
    { id: 'funny', label: '😄 Funny', description: 'Light and playful' },
    { id: 'romantic', label: '💕 Romantic', description: 'Love and affection' },
    { id: 'professional', label: '👔 Professional', description: 'Polished and respectful' },
    { id: 'heartfelt', label: '💝 Heartfelt', description: 'Deep and emotional' },
];

/**
 * Gift Message Composer Modal
 *
 * Inspired by: Hallmark card message generator, Google Smart Compose.
 * After selecting a product, helps users write a personalized gift card
 * message. Generates 3 AI-powered message options based on the occasion,
 * recipient, and chosen tone. Users can customize, copy, and use.
 *
 * This completes the gifting journey: discover → compare → compose message → order.
 */
export function GiftMessageComposer({ isOpen, onClose, product, context }: GiftMessageComposerProps) {
    const [selectedTone, setSelectedTone] = useState('warm');
    const [messages, setMessages] = useState<string[]>([]);
    const [customMessage, setCustomMessage] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
    const [activeTab, setActiveTab] = useState<'generate' | 'write'>('generate');

    const generateMessages = useCallback(async () => {
        setIsGenerating(true);
        setMessages([]);

        // Try to get AI-generated messages via the chat API
        try {
            const occasion = context.occasion || 'general';
            const recipient = context.recipient || 'someone special';
            const productName = product?.name || 'a sweet gift';
            const tone = TONE_OPTIONS.find((t) => t.id === selectedTone)?.description || 'warm';

            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: [
                        {
                            id: 'msg-composer',
                            role: 'user',
                            parts: [
                                {
                                    type: 'text',
                                    text: `Write exactly 3 short gift card messages (2-3 sentences each, numbered 1-3) for sending "${productName}" to ${recipient} for ${occasion}. Tone: ${tone}. Do NOT include product recommendations or quick replies. Just the 3 messages, nothing else.`,
                                },
                            ],
                        },
                    ],
                }),
            });

            if (response.ok && response.body) {
                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                let fullText = '';
                let buffer = '';

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    buffer += decoder.decode(value, { stream: true });

                    // Parse SSE lines: each event is "data: {json}\n"
                    const lines = buffer.split('\n');
                    // Keep the last incomplete line in buffer
                    buffer = lines.pop() || '';

                    for (const line of lines) {
                        const trimmed = line.trim();
                        if (!trimmed.startsWith('data:')) continue;
                        const jsonStr = trimmed.slice(5).trim();
                        if (!jsonStr) continue;
                        try {
                            const event = JSON.parse(jsonStr);
                            // Vercel AI SDK stream: text-delta events carry the actual text
                            if (event.type === 'text-delta' && typeof event.delta === 'string') {
                                fullText += event.delta;
                            }
                        } catch {
                            // skip non-JSON lines
                        }
                    }
                }

                // Parse numbered messages from the reconstructed text
                // Handle formats: "1. msg", "1) msg", "**1.** msg", or double-newline separated
                const cleaned = fullText
                    .replace(/\*\*/g, '')        // strip markdown bold
                    .replace(/\[\[.*?\]\]/g, '') // strip quick reply markers
                    .trim();

                let parsed: string[];

                // Try splitting by numbered prefixes (1. / 1) / 1:)
                const numbered = cleaned.split(/(?:^|\n)\s*\d+[.):\-]\s+/).filter(Boolean);
                if (numbered.length >= 2) {
                    parsed = numbered
                        .map((m) => m.trim().replace(/\n/g, ' ').replace(/\s+/g, ' '))
                        .filter((m) => m.length > 15)
                        .slice(0, 3);
                } else {
                    // Fallback: split by double newlines
                    parsed = cleaned
                        .split(/\n\s*\n/)
                        .map((m) => m.trim().replace(/\n/g, ' ').replace(/\s+/g, ' '))
                        .filter((m) => m.length > 15 && !m.startsWith('Here'))
                        .slice(0, 3);
                }

                if (parsed.length >= 2) {
                    setMessages(parsed);
                    setIsGenerating(false);
                    return;
                }
            }
        } catch {
            // Fall through to template-based messages
        }

        // Fallback: use templates
        const occasionKey = context.occasion || 'default';
        const templates = MESSAGE_TEMPLATES[occasionKey] || MESSAGE_TEMPLATES.default;
        setMessages([...templates]);
        setIsGenerating(false);
    }, [context, product, selectedTone]);

    const copyMessage = useCallback(async (text: string, index: number) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopiedIndex(index);
            setTimeout(() => setCopiedIndex(null), 2000);
        } catch {
            // Fallback for browsers without clipboard API
            const textarea = document.createElement('textarea');
            textarea.value = text;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            setCopiedIndex(index);
            setTimeout(() => setCopiedIndex(null), 2000);
        }
    }, []);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60] flex items-center justify-center p-4 animate-fade-in">
            <div
                className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col animate-scale-in overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center">
                            <MessageSquareHeart size={18} className="text-white" />
                        </div>
                        <div>
                            <h2 className="font-bold text-gray-800 text-sm">Gift Message Composer</h2>
                            <p className="text-[11px] text-gray-400">
                                {product ? `For: ${product.name}` : 'Write the perfect card message'}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-gray-100 transition-colors"
                        aria-label="Close"
                    >
                        <X size={16} className="text-gray-500" />
                    </button>
                </div>

                {/* Context chips */}
                {(context.recipient || context.occasion) && (
                    <div className="px-5 py-2.5 border-b border-gray-50 flex items-center gap-2 flex-wrap">
                        {context.recipient && (
                            <span className="text-[11px] bg-blue-50 text-blue-600 px-2.5 py-1 rounded-full font-medium">
                                📬 To: {context.recipientName || context.recipient}
                            </span>
                        )}
                        {context.occasion && (
                            <span className="text-[11px] bg-purple-50 text-purple-600 px-2.5 py-1 rounded-full font-medium">
                                🎉 {context.occasion}
                            </span>
                        )}
                    </div>
                )}

                {/* Tabs */}
                <div className="flex border-b border-gray-100 shrink-0">
                    <button
                        onClick={() => setActiveTab('generate')}
                        className={`flex-1 py-2.5 text-xs font-semibold transition-colors ${
                            activeTab === 'generate'
                                ? 'text-rose-600 border-b-2 border-rose-500'
                                : 'text-gray-400 hover:text-gray-600'
                        }`}
                    >
                        <Wand2 size={12} className="inline mr-1" />
                        AI Generated
                    </button>
                    <button
                        onClick={() => setActiveTab('write')}
                        className={`flex-1 py-2.5 text-xs font-semibold transition-colors ${
                            activeTab === 'write'
                                ? 'text-rose-600 border-b-2 border-rose-500'
                                : 'text-gray-400 hover:text-gray-600'
                        }`}
                    >
                        ✏️ Write Your Own
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {activeTab === 'generate' ? (
                        <div className="p-5 space-y-4">
                            {/* Tone selector */}
                            <div>
                                <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-2 block">
                                    Choose a Tone
                                </label>
                                <div className="flex flex-wrap gap-2">
                                    {TONE_OPTIONS.map((tone) => (
                                        <button
                                            key={tone.id}
                                            onClick={() => setSelectedTone(tone.id)}
                                            className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
                                                selectedTone === tone.id
                                                    ? 'bg-rose-50 border-rose-300 text-rose-700 font-semibold'
                                                    : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                                            }`}
                                        >
                                            {tone.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Generate button */}
                            <button
                                onClick={generateMessages}
                                disabled={isGenerating}
                                className="w-full py-2.5 rounded-xl text-sm font-semibold text-white transition-all flex items-center justify-center gap-2 disabled:opacity-60"
                                style={{ backgroundColor: 'var(--edible-red)' }}
                            >
                                {isGenerating ? (
                                    <>
                                        <RefreshCw size={14} className="animate-spin" />
                                        Crafting messages...
                                    </>
                                ) : (
                                    <>
                                        <Wand2 size={14} />
                                        {messages.length > 0 ? 'Regenerate Messages' : 'Generate Messages'}
                                    </>
                                )}
                            </button>

                            {/* Generated messages */}
                            {messages.length > 0 && (
                                <div className="space-y-3">
                                    <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                                        Pick a message
                                    </p>
                                    {messages.map((msg, idx) => (
                                        <div
                                            key={idx}
                                            className="relative group rounded-xl border border-gray-200 p-3.5 hover:border-rose-200 hover:bg-rose-50/30 transition-all cursor-pointer"
                                            onClick={() => copyMessage(msg, idx)}
                                        >
                                            <p className="text-sm text-gray-700 leading-relaxed pr-8">
                                                &ldquo;{msg}&rdquo;
                                            </p>
                                            <button
                                                className="absolute top-3 right-3 w-7 h-7 rounded-lg flex items-center justify-center bg-gray-100 hover:bg-gray-200 transition-colors"
                                                aria-label="Copy message"
                                            >
                                                {copiedIndex === idx ? (
                                                    <Check size={12} className="text-green-600" />
                                                ) : (
                                                    <Copy size={12} className="text-gray-500" />
                                                )}
                                            </button>
                                            {copiedIndex === idx && (
                                                <span className="absolute bottom-2 right-3 text-[10px] text-green-600 font-medium animate-fade-in">
                                                    Copied!
                                                </span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ) : (
                        /* Write your own tab */
                        <div className="p-5 space-y-4">
                            <div>
                                <label
                                    htmlFor="custom-message"
                                    className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-2 block"
                                >
                                    Your Gift Message
                                </label>
                                <textarea
                                    id="custom-message"
                                    value={customMessage}
                                    onChange={(e) => setCustomMessage(e.target.value)}
                                    placeholder="Write your heartfelt message here..."
                                    maxLength={300}
                                    rows={5}
                                    className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-700 resize-none outline-none focus:border-rose-300 focus:ring-2 focus:ring-rose-100 transition-all"
                                />
                                <div className="flex justify-between mt-1.5">
                                    <p className="text-[10px] text-gray-400">
                                        Tip: Keep it personal and concise
                                    </p>
                                    <p className="text-[10px] text-gray-400">
                                        {customMessage.length}/300
                                    </p>
                                </div>
                            </div>

                            {customMessage.trim().length > 0 && (
                                <button
                                    onClick={() => copyMessage(customMessage, -1)}
                                    className="w-full py-2.5 rounded-xl text-sm font-semibold border border-gray-200 text-gray-700 hover:bg-gray-50 transition-all flex items-center justify-center gap-2"
                                >
                                    {copiedIndex === -1 ? (
                                        <>
                                            <Check size={14} className="text-green-600" />
                                            Copied to clipboard!
                                        </>
                                    ) : (
                                        <>
                                            <Copy size={14} />
                                            Copy Message
                                        </>
                                    )}
                                </button>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer with product link */}
                {product && (
                    <div className="px-5 py-3 border-t border-gray-100 shrink-0 flex items-center justify-between bg-gray-50/50">
                        <div className="flex items-center gap-2">
                            <Gift size={14} className="text-gray-400" />
                            <span className="text-xs text-gray-500 truncate max-w-[200px]">
                                {product.name}
                            </span>
                        </div>
                        <a
                            href={product.productUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
                            style={{ backgroundColor: 'var(--edible-red)', color: 'white' }}
                        >
                            Order Now →
                        </a>
                    </div>
                )}
            </div>
        </div>
    );
}
