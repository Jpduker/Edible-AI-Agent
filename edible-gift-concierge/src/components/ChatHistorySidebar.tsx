'use client';

import { useState } from 'react';
import { Plus, MessageSquare, Trash2, X, Clock, ChevronLeft } from 'lucide-react';

export interface ChatSession {
    id: string;
    title: string;
    preview: string;
    messageCount: number;
    createdAt: number;
    updatedAt: number;
}

interface ChatHistorySidebarProps {
    isOpen: boolean;
    onToggle: () => void;
    sessions: ChatSession[];
    activeChatId: string;
    onNewChat: () => void;
    onLoadChat: (sessionId: string) => void;
    onDeleteChat: (sessionId: string) => void;
}

function formatRelativeTime(timestamp: number): string {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return new Date(timestamp).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
    });
}

/**
 * Chat History Sidebar
 *
 * Collapsible left-side panel showing all past chat sessions.
 * Users can create new chats, load previous ones, or delete them.
 * Sessions are persisted in localStorage via the parent ChatInterface.
 */
export default function ChatHistorySidebar({
    isOpen,
    onToggle,
    sessions,
    activeChatId,
    onNewChat,
    onLoadChat,
    onDeleteChat,
}: ChatHistorySidebarProps) {
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

    const sortedSessions = [...sessions].sort((a, b) => b.updatedAt - a.updatedAt);

    const todaySessions = sortedSessions.filter(
        (s) => Date.now() - s.updatedAt < 86400000
    );
    const olderSessions = sortedSessions.filter(
        (s) => Date.now() - s.updatedAt >= 86400000
    );

    const handleDelete = (id: string) => {
        if (confirmDeleteId === id) {
            onDeleteChat(id);
            setConfirmDeleteId(null);
        } else {
            setConfirmDeleteId(id);
            // Reset confirm state after 3 seconds
            setTimeout(() => setConfirmDeleteId(null), 3000);
        }
    };

    return (
        <>
            {/* Backdrop */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black/20 backdrop-blur-[2px] z-40 transition-opacity"
                    onClick={onToggle}
                    aria-hidden="true"
                />
            )}

            {/* Sidebar Panel */}
            <div
                className={`fixed top-0 left-0 h-full w-80 z-50 transform transition-transform duration-300 ease-in-out ${
                    isOpen ? 'translate-x-0' : '-translate-x-full'
                }`}
                style={{ backgroundColor: 'var(--edible-card-bg)' }}
            >
                {/* Header */}
                <div
                    className="h-1 w-full"
                    style={{
                        background:
                            'linear-gradient(90deg, var(--edible-red) 0%, var(--edible-red-light) 50%, var(--edible-red) 100%)',
                    }}
                />
                <div
                    className="flex items-center justify-between px-4 py-3 border-b"
                    style={{ borderColor: 'var(--edible-border)' }}
                >
                    <div className="flex items-center gap-2">
                        <Clock size={18} style={{ color: 'var(--edible-red)' }} />
                        <h2
                            className="text-base font-bold"
                            style={{ color: 'var(--edible-dark)' }}
                        >
                            Chat History
                        </h2>
                    </div>
                    <button
                        onClick={onToggle}
                        className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-gray-100 transition-colors"
                        aria-label="Close sidebar"
                    >
                        <X size={18} style={{ color: 'var(--edible-muted)' }} />
                    </button>
                </div>

                {/* New Chat Button */}
                <div className="px-3 py-3">
                    <button
                        onClick={onNewChat}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:scale-[1.02] active:scale-[0.98]"
                        style={{ backgroundColor: 'var(--edible-red)' }}
                    >
                        <Plus size={16} strokeWidth={2.5} />
                        New Chat
                    </button>
                </div>

                {/* Sessions List */}
                <div className="flex-1 overflow-y-auto custom-scrollbar px-3 pb-6" style={{ maxHeight: 'calc(100vh - 140px)' }}>
                    {sortedSessions.length === 0 ? (
                        <div className="text-center py-12 px-4">
                            <div className="text-4xl mb-3">💬</div>
                            <p
                                className="text-sm font-medium mb-1"
                                style={{ color: 'var(--edible-dark)' }}
                            >
                                No conversations yet
                            </p>
                            <p
                                className="text-xs"
                                style={{ color: 'var(--edible-muted)' }}
                            >
                                Start a new chat to begin finding the perfect gift!
                            </p>
                        </div>
                    ) : (
                        <>
                            {/* Today */}
                            {todaySessions.length > 0 && (
                                <div className="mb-4">
                                    <p
                                        className="text-[10px] font-bold uppercase tracking-wider px-2 mb-2"
                                        style={{ color: 'var(--edible-muted)' }}
                                    >
                                        Today
                                    </p>
                                    <div className="flex flex-col gap-1">
                                        {todaySessions.map((session) => (
                                            <SessionCard
                                                key={session.id}
                                                session={session}
                                                isActive={session.id === activeChatId}
                                                onLoad={() => onLoadChat(session.id)}
                                                onDelete={() => handleDelete(session.id)}
                                                isConfirmingDelete={confirmDeleteId === session.id}
                                            />
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Older */}
                            {olderSessions.length > 0 && (
                                <div>
                                    <p
                                        className="text-[10px] font-bold uppercase tracking-wider px-2 mb-2"
                                        style={{ color: 'var(--edible-muted)' }}
                                    >
                                        Previous
                                    </p>
                                    <div className="flex flex-col gap-1">
                                        {olderSessions.map((session) => (
                                            <SessionCard
                                                key={session.id}
                                                session={session}
                                                isActive={session.id === activeChatId}
                                                onLoad={() => onLoadChat(session.id)}
                                                onDelete={() => handleDelete(session.id)}
                                                isConfirmingDelete={confirmDeleteId === session.id}
                                            />
                                        ))}
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </>
    );
}

/* ─── Session Card (sub-component) ─── */

function SessionCard({
    session,
    isActive,
    onLoad,
    onDelete,
    isConfirmingDelete,
}: {
    session: ChatSession;
    isActive: boolean;
    onLoad: () => void;
    onDelete: () => void;
    isConfirmingDelete: boolean;
}) {
    return (
        <button
            onClick={onLoad}
            className={`group w-full text-left px-3 py-2.5 rounded-xl transition-all duration-150 relative ${
                isActive
                    ? 'bg-red-50 border border-red-200'
                    : 'hover:bg-gray-50 border border-transparent'
            }`}
        >
            <div className="flex items-start gap-2.5">
                <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                        isActive ? 'bg-red-100' : 'bg-gray-100'
                    }`}
                >
                    <MessageSquare
                        size={14}
                        className={isActive ? 'text-red-500' : 'text-gray-400'}
                    />
                </div>
                <div className="flex-1 min-w-0">
                    <p
                        className={`text-sm font-semibold truncate leading-snug ${
                            isActive ? 'text-red-700' : ''
                        }`}
                        style={!isActive ? { color: 'var(--edible-dark)' } : undefined}
                    >
                        {session.title}
                    </p>
                    <p
                        className="text-[11px] truncate mt-0.5"
                        style={{ color: 'var(--edible-muted)' }}
                    >
                        {session.preview}
                    </p>
                    <div
                        className="flex items-center gap-2 mt-1 text-[10px]"
                        style={{ color: 'var(--edible-muted)' }}
                    >
                        <span>{formatRelativeTime(session.updatedAt)}</span>
                        <span>·</span>
                        <span>{session.messageCount} messages</span>
                    </div>
                </div>

                {/* Delete button — shown on hover */}
                <div
                    className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                    onClick={(e) => {
                        e.stopPropagation();
                        onDelete();
                    }}
                >
                    <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
                            isConfirmingDelete
                                ? 'bg-red-500 text-white'
                                : 'hover:bg-red-50 text-gray-400 hover:text-red-500'
                        }`}
                        title={isConfirmingDelete ? 'Click again to confirm delete' : 'Delete chat'}
                    >
                        <Trash2 size={13} />
                    </div>
                </div>
            </div>

            {/* Active indicator */}
            {isActive && (
                <div
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r-full"
                    style={{ backgroundColor: 'var(--edible-red)' }}
                />
            )}
        </button>
    );
}
