'use client';

import { useState } from 'react';
import type { GiftContext, Product } from '@/lib/types';
import { getOccasionEmoji, getContextCompleteness } from '@/lib/gift-context-extractor';
import { ChevronRight, User, CalendarHeart, DollarSign, Heart, AlertTriangle, MapPin, Sparkles, X, ShoppingBag } from 'lucide-react';

interface GiftContextSidebarProps {
    context: GiftContext;
    isOpen: boolean;
    onToggle: () => void;
    /** Recommended products seen in conversation */
    recommendedProducts: Product[];
}

/**
 * Gift Context Sidebar
 *
 * Inspired by: Google Flights search criteria panel, Notion AI sidebar.
 * Shows users what the AI "understands" about their gift search — recipient,
 * occasion, budget, preferences, dietary needs — extracted in real-time from
 * the conversation. Builds trust and lets users catch misinterpretations.
 *
 * Also includes a budget progress bar (Mint-style) showing how recommended
 * products relate to the stated budget.
 */
export default function GiftContextSidebar({
    context,
    isOpen,
    onToggle,
    recommendedProducts,
}: GiftContextSidebarProps) {
    const [activeTab, setActiveTab] = useState<'context' | 'products'>('context');
    const completeness = getContextCompleteness(context);
    const hasAnyContext =
        context.recipient ||
        context.occasion ||
        context.budget ||
        context.preferences.length > 0 ||
        context.dietaryNeeds.length > 0;

    // Budget visualization
    const budgetMax = context.budget?.max;
    const productsInBudget = budgetMax
        ? recommendedProducts.filter((p) => p.price <= budgetMax).length
        : recommendedProducts.length;
    const productsOverBudget = budgetMax
        ? recommendedProducts.filter((p) => p.price > budgetMax).length
        : 0;

    if (!isOpen) {
        // Collapsed pill button
        return (
            <button
                onClick={onToggle}
                className="fixed right-0 top-1/2 -translate-y-1/2 z-50 bg-white shadow-lg border border-gray-200 rounded-l-xl px-2 py-4 hover:bg-orange-50 transition-all group"
                aria-label="Open gift planner"
            >
                <div className="flex flex-col items-center gap-2">
                    <ChevronRight
                        size={16}
                        className="text-gray-400 group-hover:text-orange-500 rotate-180 transition-colors"
                    />
                    <div className="writing-vertical text-xs font-semibold text-gray-500 group-hover:text-orange-600 transition-colors">
                        Gift Planner
                    </div>
                    {hasAnyContext && (
                        <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
                    )}
                </div>
            </button>
        );
    }

    return (
        <div className="fixed right-0 top-0 h-full w-80 bg-white shadow-2xl border-l border-gray-200 z-50 flex flex-col animate-slide-in-right overflow-hidden">
            {/* Header */}
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                    <Sparkles size={16} className="text-orange-500" />
                    <h2 className="font-bold text-sm text-gray-800">Gift Planner</h2>
                </div>
                <button
                    onClick={onToggle}
                    className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-gray-100 transition-colors"
                    aria-label="Close gift planner"
                >
                    <X size={14} className="text-gray-500" />
                </button>
            </div>

            {/* Completeness Bar */}
            <div className="px-4 py-2.5 border-b border-gray-50">
                <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">
                        Context Gathered
                    </span>
                    <span className="text-[10px] font-bold text-orange-500">{completeness}%</span>
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                        className="h-full rounded-full transition-all duration-700 ease-out"
                        style={{
                            width: `${completeness}%`,
                            background:
                                completeness < 40
                                    ? '#F59E0B'
                                    : completeness < 70
                                      ? '#F97316'
                                      : '#22C55E',
                        }}
                    />
                </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-100 shrink-0">
                <button
                    onClick={() => setActiveTab('context')}
                    className={`flex-1 py-2 text-xs font-semibold transition-colors ${
                        activeTab === 'context'
                            ? 'text-orange-600 border-b-2 border-orange-500'
                            : 'text-gray-400 hover:text-gray-600'
                    }`}
                >
                    🎯 Context
                </button>
                <button
                    onClick={() => setActiveTab('products')}
                    className={`flex-1 py-2 text-xs font-semibold transition-colors relative ${
                        activeTab === 'products'
                            ? 'text-orange-600 border-b-2 border-orange-500'
                            : 'text-gray-400 hover:text-gray-600'
                    }`}
                >
                    📦 Products
                    {recommendedProducts.length > 0 && (
                        <span className="ml-1 bg-orange-100 text-orange-600 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                            {recommendedProducts.length}
                        </span>
                    )}
                </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
                {activeTab === 'context' ? (
                    <div className="p-4 space-y-3">
                        {!hasAnyContext ? (
                            <div className="text-center py-8">
                                <div className="text-3xl mb-3">🎁</div>
                                <p className="text-sm text-gray-500 mb-1">No context detected yet</p>
                                <p className="text-xs text-gray-400 leading-relaxed">
                                    Start chatting and I&apos;ll auto-detect your recipient, occasion,
                                    budget, and preferences here.
                                </p>
                            </div>
                        ) : (
                            <>
                                {/* Recipient */}
                                {context.recipient && (
                                    <ContextCard
                                        icon={<User size={14} />}
                                        label="Recipient"
                                        value={
                                            context.recipientName
                                                ? `${context.recipient} (${context.recipientName})`
                                                : context.recipient
                                        }
                                        color="blue"
                                    />
                                )}

                                {/* Occasion */}
                                {context.occasion && (
                                    <ContextCard
                                        icon={<CalendarHeart size={14} />}
                                        label="Occasion"
                                        value={`${getOccasionEmoji(context.occasion)} ${context.occasion}`}
                                        color="purple"
                                    />
                                )}

                                {/* Budget */}
                                {context.budget && (
                                    <div className="rounded-xl border border-green-100 bg-green-50/50 p-3">
                                        <div className="flex items-center gap-2 mb-2">
                                            <div className="w-6 h-6 rounded-lg bg-green-100 flex items-center justify-center">
                                                <DollarSign size={14} className="text-green-600" />
                                            </div>
                                            <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                                                Budget
                                            </span>
                                        </div>
                                        <p className="text-sm font-bold text-green-700 mb-2">
                                            {context.budget.raw}
                                        </p>

                                        {/* Budget progress bar */}
                                        {budgetMax && recommendedProducts.length > 0 && (
                                            <div className="mt-2">
                                                <div className="flex justify-between text-[10px] text-gray-400 mb-1">
                                                    <span>{productsInBudget} in budget</span>
                                                    {productsOverBudget > 0 && (
                                                        <span className="text-amber-500">
                                                            {productsOverBudget} over
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex gap-0.5">
                                                    {recommendedProducts.slice(0, 8).map((p) => (
                                                        <div
                                                            key={p.id}
                                                            className="h-2 flex-1 rounded-full"
                                                            style={{
                                                                backgroundColor:
                                                                    p.price <= budgetMax
                                                                        ? '#22C55E'
                                                                        : '#F59E0B',
                                                            }}
                                                            title={`${p.name}: ${p.priceFormatted}`}
                                                        />
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Preferences */}
                                {context.preferences.length > 0 && (
                                    <div className="rounded-xl border border-pink-100 bg-pink-50/30 p-3">
                                        <div className="flex items-center gap-2 mb-2">
                                            <div className="w-6 h-6 rounded-lg bg-pink-100 flex items-center justify-center">
                                                <Heart size={14} className="text-pink-500" />
                                            </div>
                                            <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                                                Preferences
                                            </span>
                                        </div>
                                        <div className="flex flex-wrap gap-1.5">
                                            {context.preferences.map((pref) => (
                                                <span
                                                    key={pref}
                                                    className="text-[11px] bg-white border border-pink-200 text-gray-700 px-2 py-1 rounded-full"
                                                >
                                                    {pref}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Dietary Needs */}
                                {context.dietaryNeeds.length > 0 && (
                                    <div className="rounded-xl border border-amber-100 bg-amber-50/30 p-3">
                                        <div className="flex items-center gap-2 mb-2">
                                            <div className="w-6 h-6 rounded-lg bg-amber-100 flex items-center justify-center">
                                                <AlertTriangle size={14} className="text-amber-600" />
                                            </div>
                                            <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                                                Dietary Needs
                                            </span>
                                        </div>
                                        <div className="flex flex-wrap gap-1.5">
                                            {context.dietaryNeeds.map((need) => (
                                                <span
                                                    key={need}
                                                    className="text-[11px] bg-white border border-amber-200 text-gray-700 px-2 py-1 rounded-full"
                                                >
                                                    {need}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Delivery ZIP */}
                                {context.deliveryZip && (
                                    <ContextCard
                                        icon={<MapPin size={14} />}
                                        label="Delivery ZIP"
                                        value={context.deliveryZip}
                                        color="teal"
                                    />
                                )}

                                {/* Tone */}
                                {context.tone && (
                                    <ContextCard
                                        icon={<Sparkles size={14} />}
                                        label="Gift Vibe"
                                        value={context.tone}
                                        color="violet"
                                    />
                                )}
                            </>
                        )}
                    </div>
                ) : (
                    /* Products Tab */
                    <div className="p-4">
                        {recommendedProducts.length === 0 ? (
                            <div className="text-center py-8">
                                <ShoppingBag size={28} className="mx-auto text-gray-300 mb-3" />
                                <p className="text-sm text-gray-500 mb-1">No products yet</p>
                                <p className="text-xs text-gray-400">
                                    Products will appear here as they&apos;re recommended.
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {/* Price summary */}
                                <div className="flex items-center justify-between text-xs text-gray-500 pb-2 border-b border-gray-100">
                                    <span>
                                        {recommendedProducts.length} product
                                        {recommendedProducts.length !== 1 ? 's' : ''} shown
                                    </span>
                                    <span className="font-semibold">
                                        $
                                        {Math.min(
                                            ...recommendedProducts.map((p) => p.price)
                                        ).toFixed(0)}
                                        {' – $'}
                                        {Math.max(
                                            ...recommendedProducts.map((p) => p.price)
                                        ).toFixed(0)}
                                    </span>
                                </div>

                                {/* Product mini-cards */}
                                {recommendedProducts.map((product) => (
                                    <a
                                        key={product.id}
                                        href={product.productUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors group"
                                    >
                                        <div className="w-10 h-10 rounded-lg overflow-hidden bg-gray-100 shrink-0">
                                            <img
                                                src={product.imageUrl}
                                                alt={product.name}
                                                className="w-full h-full object-cover"
                                                loading="lazy"
                                            />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-medium text-gray-800 truncate group-hover:text-orange-600 transition-colors">
                                                {product.name}
                                            </p>
                                            <div className="flex items-center gap-2">
                                                <span className="text-[11px] font-bold text-red-600">
                                                    {product.priceFormatted}
                                                </span>
                                                {budgetMax && product.price > budgetMax && (
                                                    <span className="text-[9px] bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded-full font-medium">
                                                        Over budget
                                                    </span>
                                                )}
                                                {product.isOneHourDelivery && (
                                                    <span className="text-[9px] bg-green-100 text-green-600 px-1.5 py-0.5 rounded-full font-medium">
                                                        Same Day
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </a>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="px-4 py-2 border-t border-gray-100 shrink-0">
                <p className="text-[10px] text-gray-400 text-center">
                    Auto-detected from your conversation
                </p>
            </div>
        </div>
    );
}

/* ─── Helper: Context Card ─── */
function ContextCard({
    icon,
    label,
    value,
    color,
}: {
    icon: React.ReactNode;
    label: string;
    value: string;
    color: 'blue' | 'purple' | 'teal' | 'violet';
}) {
    const colors = {
        blue: { bg: 'bg-blue-50/50', border: 'border-blue-100', iconBg: 'bg-blue-100', iconText: 'text-blue-600' },
        purple: { bg: 'bg-purple-50/50', border: 'border-purple-100', iconBg: 'bg-purple-100', iconText: 'text-purple-600' },
        teal: { bg: 'bg-teal-50/50', border: 'border-teal-100', iconBg: 'bg-teal-100', iconText: 'text-teal-600' },
        violet: { bg: 'bg-violet-50/50', border: 'border-violet-100', iconBg: 'bg-violet-100', iconText: 'text-violet-600' },
    };

    const c = colors[color];

    return (
        <div className={`rounded-xl border ${c.border} ${c.bg} p-3`}>
            <div className="flex items-center gap-2 mb-1">
                <div className={`w-6 h-6 rounded-lg ${c.iconBg} flex items-center justify-center ${c.iconText}`}>
                    {icon}
                </div>
                <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                    {label}
                </span>
            </div>
            <p className="text-sm font-semibold text-gray-800 pl-8">{value}</p>
        </div>
    );
}
