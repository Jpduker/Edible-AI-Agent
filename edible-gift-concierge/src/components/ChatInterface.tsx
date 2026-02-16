'use client';

import { useChat } from '@ai-sdk/react';
import { useEffect, useRef, useState, useCallback } from 'react';
import type { UIMessage } from 'ai';
import { DefaultChatTransport } from 'ai';
import { Product } from '@/lib/types'; // Import shared type
import MessageBubble from './MessageBubble';
import ProductCard from './ProductCard';
import QuickReplies from './QuickReplies';
import TypingIndicator from './TypingIndicator';
import WelcomeScreen from './WelcomeScreen';
import ComparisonBar from './ComparisonBar';
import { ComparisonModal } from './ComparisonModal';

/**
 * Parse quick replies from the end of AI messages.
 * Format: [[Reply 1|Reply 2|Reply 3]]
 */
function extractQuickReplies(content: string): { cleanContent: string; quickReplies: string[] } {
    const match = content.match(/\[\[([^\]]+)\]\]\s*$/);
    if (!match) {
        return { cleanContent: content, quickReplies: [] };
    }

    const quickReplies = match[1]
        .split('|')
        .map((r) => r.trim())
        .filter(Boolean);

    const cleanContent = content.replace(/\[\[([^\]]+)\]\]\s*$/, '').trim();
    return { cleanContent, quickReplies };
}

/**
 * Get the text content from a UIMessage.
 */
function getMessageText(message: UIMessage): string {
    if (!message.parts) return '';
    return message.parts
        .filter((part): part is { type: 'text'; text: string } => part.type === 'text')
        .map((part) => part.text)
        .join('');
}

/**
 * Extract product data from tool result parts in a message.
 * In AI SDK v6, tool parts have state/output directly on the part object.
 */
function extractProducts(message: UIMessage): Product[] {
    if (!message.parts) return [];

    const products: Product[] = [];
    for (const part of message.parts) {
        // In v6, tool parts have type starting with 'tool-' and contain state + output
        if (part.type.startsWith('tool-')) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const toolPart = part as any;
            if (
                (toolPart.state === 'output-available' || toolPart.state === 'done') &&
                toolPart.output?.products
            ) {
                products.push(...(toolPart.output.products as Product[]));
            }
        }
    }
    return products;
}

export default function ChatInterface() {
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const [input, setInput] = useState('');
    const [currentQuickReplies, setCurrentQuickReplies] = useState<string[]>([]);

    // Comparison State
    const [selectedProducts, setSelectedProducts] = useState<Product[]>([]);
    const [isComparisonOpen, setIsComparisonOpen] = useState(false);

    const { messages, sendMessage, status, error } = useChat({
        transport: new DefaultChatTransport({ api: '/api/chat' }),
        onFinish: ({ message }: { message: UIMessage }) => {
            const text = getMessageText(message);
            if (message.role === 'assistant' && text) {
                const { quickReplies } = extractQuickReplies(text);
                setCurrentQuickReplies(quickReplies);
            }
        },
        onError: (err: Error) => {
            console.error('[ChatInterface] Error:', err);
        },
    });

    const isLoading = status === 'submitted' || status === 'streaming';

    // Auto-scroll to bottom when new messages arrive
    const scrollToBottom = useCallback(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, []);

    useEffect(() => {
        scrollToBottom();
    }, [messages, isLoading, scrollToBottom]);

    // Focus input
    const focusInput = useCallback(() => {
        setTimeout(() => inputRef.current?.focus(), 100);
    }, []);

    // Handle quick reply click
    const handleQuickReply = useCallback(
        (reply: string) => {
            setCurrentQuickReplies([]);
            sendMessage({ text: reply });
            focusInput();
        },
        [sendMessage, focusInput]
    );

    // Handle form submit with validation
    const handleFormSubmit = useCallback(
        (e: React.FormEvent) => {
            e.preventDefault();
            const trimmed = input.trim();
            if (!trimmed || isLoading) return;

            // Truncate at 500 chars
            const finalText = trimmed.length > 500 ? trimmed.slice(0, 500) : trimmed;

            setCurrentQuickReplies([]);
            sendMessage({ text: finalText });
            setInput('');
            focusInput();
        },
        [input, isLoading, sendMessage, focusInput]
    );

    // Handle keyboard shortcuts
    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent<HTMLInputElement>) => {
            if (e.key === 'Escape') {
                setInput('');
            }
        },
        []
    );

    const toggleProductSelection = (product: Product) => {
        if (selectedProducts.find((p) => p.id === product.id)) {
            setSelectedProducts((prev) => prev.filter((p) => p.id !== product.id));
        } else {
            if (selectedProducts.length >= 3) {
                // Ideally show toast, but silent limit for now to match simplicity requirement
                return;
            }
            setSelectedProducts((prev) => [...prev, product]);
        }
    };

    const hasMessages = messages.length > 0;

    return (
        <div className="flex flex-col h-full relative">
            {/* Messages area */}
            <div className="flex-1 overflow-y-auto custom-scrollbar pb-20">
                <div className="max-w-3xl mx-auto px-4 py-4">
                    {!hasMessages ? (
                        <WelcomeScreen onQuickReply={handleQuickReply} />
                    ) : (
                        <div className="flex flex-col gap-4">
                            {messages.map((message) => {
                                const products = extractProducts(message);
                                const text = getMessageText(message);
                                const { cleanContent } =
                                    message.role === 'assistant'
                                        ? extractQuickReplies(text)
                                        : { cleanContent: text };

                                return (
                                    <div key={message.id} className="flex flex-col gap-3">
                                        {cleanContent && (
                                            <MessageBubble
                                                role={message.role as 'user' | 'assistant'}
                                                content={cleanContent}
                                            />
                                        )}

                                        {products.length > 0 && (
                                            <div className="pl-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 animate-fade-in-up">
                                                {products.slice(0, 6).map((product, idx) => {
                                                    const isSelected = !!selectedProducts.find(p => p.id === product.id);
                                                    return (
                                                        <ProductCard
                                                            key={`${product.id}-${idx}`}
                                                            name={product.name}
                                                            price={product.priceFormatted} // Use formatted price
                                                            description={
                                                                product.description.length > 120
                                                                    ? product.description.slice(0, 120) + '...'
                                                                    : product.description
                                                            }
                                                            imageUrl={product.imageUrl}
                                                            productUrl={product.productUrl}
                                                            isOneHourDelivery={product.isOneHourDelivery}
                                                            promo={product.promo}
                                                            productImageTag={product.productImageTag}
                                                            isSelected={isSelected}
                                                            onToggleSelect={() => toggleProductSelection(product)}
                                                        />
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}

                            {isLoading && <TypingIndicator />}

                            {error && (
                                <div className="flex items-start gap-2 animate-fade-in">
                                    <div
                                        className="w-8 h-8 rounded-full flex items-center justify-center text-sm shrink-0"
                                        style={{ backgroundColor: 'var(--edible-red)', color: 'white' }}
                                    >
                                        🍓
                                    </div>
                                    <div
                                        className="px-4 py-2.5 rounded-2xl rounded-tl-sm text-[15px]"
                                        style={{ backgroundColor: '#FEF2F2', color: '#991B1B' }}
                                    >
                                        I&apos;m having trouble connecting right now. Please try again in a moment! 🍓
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>
            </div>

            {/* Comparison UI */}
            <ComparisonBar
                selectedProducts={selectedProducts}
                onClear={() => setSelectedProducts([])}
                onCompare={() => setIsComparisonOpen(true)}
            />

            <ComparisonModal
                isOpen={isComparisonOpen}
                onClose={() => setIsComparisonOpen(false)}
                products={selectedProducts}
                onRemoveProduct={(id) => setSelectedProducts(prev => prev.filter(p => p.id !== id))}
            />

            {/* Quick replies + Input area */}
            <div
                className="border-t shrink-0 relative z-30"
                style={{
                    borderColor: 'var(--edible-border)',
                    backgroundColor: 'var(--edible-card-bg)',
                }}
            >
                <div className="max-w-3xl mx-auto px-4 py-3 flex flex-col gap-2.5">
                    {currentQuickReplies.length > 0 && !isLoading && (
                        <QuickReplies replies={currentQuickReplies} onSelect={handleQuickReply} />
                    )}

                    <form onSubmit={handleFormSubmit} className="flex items-center gap-2">
                        <input
                            ref={inputRef}
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Type your message..."
                            disabled={isLoading}
                            maxLength={500}
                            className="flex-1 px-4 py-2.5 text-[15px] rounded-xl border outline-none transition-all"
                            style={{
                                borderColor: 'var(--edible-border)',
                                backgroundColor: 'var(--edible-light-bg)',
                                color: 'var(--edible-dark)',
                            }}
                            onFocus={(e) => {
                                e.currentTarget.style.borderColor = 'var(--edible-red)';
                                e.currentTarget.style.boxShadow = '0 0 0 3px rgba(225, 7, 0, 0.1)';
                            }}
                            onBlur={(e) => {
                                e.currentTarget.style.borderColor = 'var(--edible-border)';
                                e.currentTarget.style.boxShadow = 'none';
                            }}
                            aria-label="Type your message"
                            id="chat-input"
                        />

                        <button
                            type="submit"
                            disabled={isLoading || !input.trim()}
                            className="send-btn w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                            style={{ backgroundColor: 'var(--edible-red)', color: 'white' }}
                            aria-label="Send message"
                            id="send-button"
                        >
                            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                                <path
                                    d="M7.5 10.5L15.75 2.25M7.73 10.89L9.85 16.02C10.02 16.42 10.1 16.61 10.22 16.68C10.32 16.73 10.43 16.73 10.54 16.68C10.66 16.61 10.74 16.42 10.9 16.02L16.1 3.28C16.24 2.93 16.31 2.75 16.27 2.63C16.23 2.53 16.15 2.45 16.05 2.41C15.93 2.37 15.75 2.44 15.4 2.58L2.66 7.78C2.26 7.94 2.07 8.02 2 8.14C1.95 8.25 1.95 8.36 2 8.46C2.07 8.58 2.26 8.66 2.66 8.83L7.79 10.95C7.87 10.98 7.92 11 7.95 11.03C7.98 11.06 7.99 11.08 8.01 11.11C8.03 11.14 8.04 11.19 8.05 11.21L7.73 10.89Z"
                                    stroke="currentColor"
                                    strokeWidth="1.5"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                />
                            </svg>
                        </button>
                    </form>

                    {input.length > 400 && (
                        <p className="text-xs text-right" style={{ color: 'var(--edible-muted)' }}>
                            {input.length}/500
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}
