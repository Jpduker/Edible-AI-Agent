'use client';

import { useChat } from '@ai-sdk/react';
import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import type { UIMessage } from 'ai';
import { DefaultChatTransport } from 'ai';
import { Product } from '@/lib/types';
import { extractGiftContext } from '@/lib/gift-context-extractor';
import MessageBubble from './MessageBubble';
import ProductCard from './ProductCard';
import QuickReplies from './QuickReplies';
import TypingIndicator from './TypingIndicator';
import WelcomeScreen from './WelcomeScreen';
import ComparisonBar from './ComparisonBar';
import { ComparisonModal } from './ComparisonModal';
import { SpinWheelModal } from './SpinWheelModal';
import GiftContextSidebar from './GiftContextSidebar';
import { GiftMessageComposer } from './GiftMessageComposer';
import FavoritesDrawer from './FavoritesDrawer';
import { CartDrawer, CartItem } from './CartDrawer';
import ChatHistorySidebar, { ChatSession } from './ChatHistorySidebar';
import { Sparkles, PanelRightOpen, Heart, ShoppingCart, Menu } from 'lucide-react';

// ─── Chat Session Persistence Helpers ───

const SESSIONS_STORAGE_KEY = 'edible-chat-sessions';
const ACTIVE_CHAT_KEY = 'edible-active-chat-id';

function generateChatId(): string {
    return `chat-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function loadSessions(): ChatSession[] {
    if (typeof window === 'undefined') return [];
    try {
        const raw = localStorage.getItem(SESSIONS_STORAGE_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
}

function saveSessions(sessions: ChatSession[]) {
    try {
        localStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(sessions));
    } catch { /* quota */ }
}

function loadMessagesForSession(sessionId: string): UIMessage[] {
    if (typeof window === 'undefined') return [];
    try {
        const raw = localStorage.getItem(`edible-chat-msgs-${sessionId}`);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
}

function saveMessagesForSession(sessionId: string, messages: UIMessage[]) {
    try {
        localStorage.setItem(`edible-chat-msgs-${sessionId}`, JSON.stringify(messages));
    } catch { /* quota */ }
}

function deleteMessagesForSession(sessionId: string) {
    try {
        localStorage.removeItem(`edible-chat-msgs-${sessionId}`);
    } catch { /* ignore */ }
}

function getSessionTitle(messages: UIMessage[]): string {
    const firstUser = messages.find((m) => m.role === 'user');
    if (!firstUser) return 'New Chat';
    const text = firstUser.parts
        ?.filter((p): p is { type: 'text'; text: string } => p.type === 'text')
        .map((p) => p.text)
        .join('') || 'New Chat';
    return text.length > 40 ? text.slice(0, 40) + '…' : text;
}

function getSessionPreview(messages: UIMessage[]): string {
    const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant');
    if (!lastAssistant) return 'No response yet';
    const text = lastAssistant.parts
        ?.filter((p): p is { type: 'text'; text: string } => p.type === 'text')
        .map((p) => p.text)
        .join('') || '';
    const clean = text.replace(/\[\[[^\]]+\]\]\s*$/, '').trim();
    return clean.length > 60 ? clean.slice(0, 60) + '…' : clean || 'No response yet';
}

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
    const [isSpinWheelOpen, setIsSpinWheelOpen] = useState(false);

    // Comparison State
    const [selectedProducts, setSelectedProducts] = useState<Product[]>([]);
    const [isComparisonOpen, setIsComparisonOpen] = useState(false);

    // Gift Context Sidebar State
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    // Gift Message Composer State
    const [isComposerOpen, setIsComposerOpen] = useState(false);
    const [composerProduct, setComposerProduct] = useState<Product | null>(null);

    // Favorites State (persisted to localStorage)
    const [favoriteProducts, setFavoriteProducts] = useState<Product[]>(() => {
        if (typeof window === 'undefined') return [];
        try {
            const saved = localStorage.getItem('edible-favorites');
            return saved ? JSON.parse(saved) : [];
        } catch {
            return [];
        }
    });
    const [isFavoritesOpen, setIsFavoritesOpen] = useState(false);

    // Cart State
    const [cartItems, setCartItems] = useState<CartItem[]>([]);
    const [isCartOpen, setIsCartOpen] = useState(false);

    // ─── Chat History State ───
    const [activeChatId, setActiveChatId] = useState<string>(() => {
        if (typeof window === 'undefined') return generateChatId();
        try {
            const saved = localStorage.getItem(ACTIVE_CHAT_KEY);
            return saved || generateChatId();
        } catch {
            return generateChatId();
        }
    });
    const [chatSessions, setChatSessions] = useState<ChatSession[]>(() => loadSessions());
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);

    const addToCart = useCallback((product: Product) => {
        setCartItems((prev) => {
            const existing = prev.find((item) => item.product.id === product.id);
            if (existing) {
                return prev.map((item) =>
                    item.product.id === product.id
                        ? { ...item, quantity: item.quantity + 1 }
                        : item
                );
            }
            return [...prev, { product, quantity: 1 }];
        });
    }, []);

    const updateCartQuantity = useCallback((productId: string, quantity: number) => {
        setCartItems((prev) =>
            prev.map((item) =>
                item.product.id === productId ? { ...item, quantity } : item
            )
        );
    }, []);

    const removeFromCart = useCallback((productId: string) => {
        setCartItems((prev) => prev.filter((item) => item.product.id !== productId));
    }, []);

    const clearCart = useCallback(() => {
        setCartItems([]);
    }, []);

    const cartItemCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);

    const { messages, sendMessage, status, error, setMessages } = useChat({
        id: activeChatId,
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

    // ─── Load saved messages whenever activeChatId changes (mount + history switch) ───
    useEffect(() => {
        const saved = loadMessagesForSession(activeChatId);
        if (saved.length > 0) {
            setMessages(saved);
            prevMsgCountRef.current = saved.length;
        } else {
            prevMsgCountRef.current = 0;
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeChatId]);

    // ─── Auto-save messages to localStorage when they change ───
    const prevMsgCountRef = useRef(0);
    useEffect(() => {
        // Only save when messages actually changed (new messages added or response finished)
        if (messages.length > 0 && messages.length !== prevMsgCountRef.current) {
            prevMsgCountRef.current = messages.length;
            saveMessagesForSession(activeChatId, messages);

            // Update session metadata
            setChatSessions((prev) => {
                const existing = prev.find((s) => s.id === activeChatId);
                const updated: ChatSession = {
                    id: activeChatId,
                    title: getSessionTitle(messages),
                    preview: getSessionPreview(messages),
                    messageCount: messages.length,
                    createdAt: existing?.createdAt || Date.now(),
                    updatedAt: Date.now(),
                };
                const newSessions = existing
                    ? prev.map((s) => (s.id === activeChatId ? updated : s))
                    : [...prev, updated];
                saveSessions(newSessions);
                return newSessions;
            });

            // Persist active chat id
            try { localStorage.setItem(ACTIVE_CHAT_KEY, activeChatId); } catch { /* ignore */ }
        }
    }, [messages, activeChatId]);

    // ─── Chat History Actions ───
    const createNewChat = useCallback(() => {
        const newId = generateChatId();
        setActiveChatId(newId);
        setMessages([]);
        setCurrentQuickReplies([]);
        setSelectedProducts([]);
        prevMsgCountRef.current = 0;
        try { localStorage.setItem(ACTIVE_CHAT_KEY, newId); } catch { /* ignore */ }
        setIsHistoryOpen(false);
    }, [setMessages]);

    const loadChat = useCallback((sessionId: string) => {
        // Just switch the ID — the useEffect on activeChatId handles loading messages
        setActiveChatId(sessionId);
        setCurrentQuickReplies([]);
        setSelectedProducts([]);
        try { localStorage.setItem(ACTIVE_CHAT_KEY, sessionId); } catch { /* ignore */ }
        setIsHistoryOpen(false);
    }, []);

    const deleteChat = useCallback((sessionId: string) => {
        deleteMessagesForSession(sessionId);
        setChatSessions((prev) => {
            const newSessions = prev.filter((s) => s.id !== sessionId);
            saveSessions(newSessions);
            return newSessions;
        });
        // If deleting the active chat, create a new one
        if (sessionId === activeChatId) {
            createNewChat();
        }
    }, [activeChatId, createNewChat]);

    // ─── Gift Context: auto-extract from user messages ───
    const giftContext = useMemo(() => {
        const userTexts = messages
            .filter((m) => m.role === 'user')
            .map((m) => getMessageText(m))
            .filter(Boolean);
        return extractGiftContext(userTexts);
    }, [messages]);

    // ─── Recommended Products: collect all products from conversation ───
    const allRecommendedProducts = useMemo(() => {
        const seen = new Set<string>();
        const products: Product[] = [];
        for (const msg of messages) {
            for (const p of extractProducts(msg)) {
                if (!seen.has(p.id)) {
                    seen.add(p.id);
                    products.push(p);
                }
            }
        }
        return products;
    }, [messages]);

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
                return;
            }
            setSelectedProducts((prev) => [...prev, product]);
        }
    };

    const toggleFavorite = useCallback((product: Product) => {
        setFavoriteProducts((prev) => {
            let next: Product[];
            if (prev.find((p) => p.id === product.id)) {
                next = prev.filter((p) => p.id !== product.id);
            } else {
                next = [...prev, product];
            }
            try { localStorage.setItem('edible-favorites', JSON.stringify(next)); } catch { /* quota */ }
            return next;
        });
    }, []);

    const openComposer = useCallback((product: Product) => {
        setComposerProduct(product);
        setIsComposerOpen(true);
    }, []);

    const hasMessages = messages.length > 0;

    return (
        <div className="flex flex-col h-full relative">
            {/* Header Buttons — fixed so they stay visible while scrolling */}
            <div className="fixed top-20 right-6 z-50 flex items-center gap-2">
                <button
                    onClick={() => setIsCartOpen(true)}
                    className="relative bg-white/80 backdrop-blur-sm shadow-sm border border-green-100 text-green-600 px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 hover:bg-green-50 transition-all hover:scale-105"
                    aria-label={`Open cart (${cartItemCount} items)`}
                    title="View your cart items"
                >
                    <ShoppingCart size={14} />
                    Cart
                    {cartItemCount > 0 && (
                        <span className="bg-green-600 text-white text-[10px] font-bold w-4.5 h-4.5 min-w-[18px] rounded-full flex items-center justify-center">
                            {cartItemCount}
                        </span>
                    )}
                </button>
                <button
                    onClick={() => setIsFavoritesOpen(true)}
                    className="relative bg-white/80 backdrop-blur-sm shadow-sm border border-red-100 text-red-500 px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 hover:bg-red-50 transition-all hover:scale-105"
                    aria-label={`Open saved items (${favoriteProducts.length})`}
                    title="View your saved favorite products"
                >
                    <Heart size={14} fill={favoriteProducts.length > 0 ? 'currentColor' : 'none'} />
                    Saved
                    {favoriteProducts.length > 0 && (
                        <span className="bg-red-500 text-white text-[10px] font-bold w-4.5 h-4.5 min-w-[18px] rounded-full flex items-center justify-center">
                            {favoriteProducts.length}
                        </span>
                    )}
                </button>
                <button
                    onClick={() => setIsSidebarOpen(true)}
                    className="bg-white/80 backdrop-blur-sm shadow-sm border border-blue-100 text-blue-600 px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 hover:bg-blue-50 transition-all hover:scale-105"
                    aria-label="Open gift planner sidebar"
                    title="View your gift context — occasion, recipient, budget"
                >
                    <PanelRightOpen size={14} /> Gift Planner
                    {(giftContext.recipient || giftContext.occasion || giftContext.budget) && (
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                    )}
                </button>
                <button
                    onClick={() => setIsSpinWheelOpen(true)}
                    aria-label="Spin the wheel to discover gift ideas"
                    title="Spin the wheel to discover random gift ideas"
                    className="bg-white/80 backdrop-blur-sm shadow-sm border border-orange-100 text-orange-600 px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 hover:bg-orange-50 transition-all hover:scale-105"
                >
                    <Sparkles size={14} /> Surprise Me
                </button>
            </div>

            {/* Chat History Toggle — fixed top-left */}
            <div className="fixed top-20 left-6 z-50">
                <button
                    onClick={() => setIsHistoryOpen(true)}
                    className="bg-white/80 backdrop-blur-sm shadow-sm border border-gray-200 text-gray-600 px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 hover:bg-gray-50 transition-all hover:scale-105"
                    aria-label="Open chat history"
                    title="Start a new chat or view previous conversations"
                >
                    <Menu size={14} />
                    History
                    {chatSessions.length > 0 && (
                        <span className="bg-gray-500 text-white text-[10px] font-bold w-4.5 h-4.5 min-w-[18px] rounded-full flex items-center justify-center">
                            {chatSessions.length}
                        </span>
                    )}
                </button>
            </div>

            {/* Messages area */}
            <div className="flex-1 overflow-y-auto custom-scrollbar pb-20" role="log" aria-live="polite" aria-label="Chat messages">
                <div className="max-w-3xl mx-auto px-4 py-4" role="region" aria-label="Conversation">
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
                                                    const isFav = !!favoriteProducts.find(p => p.id === product.id);
                                                    const isInCart = !!cartItems.find(item => item.product.id === product.id);
                                                    return (
                                                        <ProductCard
                                                            key={`${product.id}-${idx}`}
                                                            name={product.name}
                                                            price={product.priceFormatted}
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
                                                            onWriteMessage={() => openComposer(product)}
                                                            onToggleFavorite={() => toggleFavorite(product)}
                                                            isFavorited={isFav}
                                                            allergyInfo={product.allergyInfo}
                                                            ingredients={product.ingredients}
                                                            sizeCount={product.sizeCount}
                                                            onAddToCart={() => addToCart(product)}
                                                            isInCart={isInCart}
                                                        />
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}

                            {isLoading && <TypingIndicator aria-busy="true" />}

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
                giftContext={giftContext}
            />

            <SpinWheelModal
                isOpen={isSpinWheelOpen}
                onClose={() => setIsSpinWheelOpen(false)}
            />

            {/* Gift Context Sidebar */}
            <GiftContextSidebar
                context={giftContext}
                isOpen={isSidebarOpen}
                onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
                recommendedProducts={allRecommendedProducts}
            />

            {/* Gift Message Composer */}
            <GiftMessageComposer
                isOpen={isComposerOpen}
                onClose={() => {
                    setIsComposerOpen(false);
                    setComposerProduct(null);
                }}
                product={composerProduct}
                context={giftContext}
            />

            {/* Favorites Drawer */}
            <FavoritesDrawer
                isOpen={isFavoritesOpen}
                onClose={() => setIsFavoritesOpen(false)}
                favorites={favoriteProducts}
                onRemove={(product) => toggleFavorite(product)}
                onWriteMessage={(product) => {
                    setIsFavoritesOpen(false);
                    openComposer(product);
                }}
            />

            {/* Cart Drawer */}
            <CartDrawer
                isOpen={isCartOpen}
                onClose={() => setIsCartOpen(false)}
                items={cartItems}
                onUpdateQuantity={updateCartQuantity}
                onRemoveItem={removeFromCart}
                onClearCart={clearCart}
            />

            {/* Chat History Sidebar */}
            <ChatHistorySidebar
                isOpen={isHistoryOpen}
                onToggle={() => setIsHistoryOpen(!isHistoryOpen)}
                sessions={chatSessions}
                activeChatId={activeChatId}
                onNewChat={createNewChat}
                onLoadChat={loadChat}
                onDeleteChat={deleteChat}
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

                    <form onSubmit={handleFormSubmit} className="flex items-center gap-2" role="form" aria-label="Chat input">
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
