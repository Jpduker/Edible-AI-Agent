'use client';

import { Heart, X, ExternalLink, MessageSquareHeart, Trash2, ShoppingCart, Copy, Check } from 'lucide-react';
import { Product } from '@/lib/types';
import { useState } from 'react';

interface FavoritesDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    favorites: Product[];
    onRemove: (product: Product) => void;
    onWriteMessage: (product: Product) => void;
}

export default function FavoritesDrawer({
    isOpen,
    onClose,
    favorites,
    onRemove,
    onWriteMessage,
}: FavoritesDrawerProps) {
    const [copiedLink, setCopiedLink] = useState<string | null>(null);

    const totalValue = favorites.reduce((sum, p) => sum + p.price, 0);

    const handleCopyLink = async (product: Product) => {
        try {
            await navigator.clipboard.writeText(product.productUrl);
            setCopiedLink(product.id);
            setTimeout(() => setCopiedLink(null), 2000);
        } catch {
            // Fallback: do nothing
        }
    };

    const handleShareAll = async () => {
        const text = favorites
            .map((p, i) => `${i + 1}. ${p.name} — ${p.priceFormatted}\n   ${p.productUrl}`)
            .join('\n\n');

        const shareText = `My Edible Arrangements Wishlist\n\n${text}\n\nTotal: $${totalValue.toFixed(2)}`;

        if (navigator.share) {
            try {
                await navigator.share({ title: 'My Edible Gift List', text: shareText });
            } catch {
                // User cancelled
            }
        } else {
            try {
                await navigator.clipboard.writeText(shareText);
                setCopiedLink('all');
                setTimeout(() => setCopiedLink(null), 2000);
            } catch {
                // Fallback: do nothing
            }
        }
    };

    return (
        <>
            {/* Backdrop */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black/30 z-50 backdrop-blur-sm transition-opacity"
                    onClick={onClose}
                    aria-hidden="true"
                />
            )}

            {/* Drawer */}
            <div
                className={`fixed top-0 right-0 h-full w-full max-w-sm bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-out ${
                    isOpen ? 'translate-x-0' : 'translate-x-full'
                }`}
                role="dialog"
                aria-modal="true"
                aria-label="Your saved products"
            >
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-gray-100">
                    <div className="flex items-center gap-2">
                        <Heart size={18} className="text-red-500" fill="currentColor" />
                        <h2 className="text-lg font-bold text-gray-900">
                            Saved ({favorites.length})
                        </h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all"
                        aria-label="Close saved items drawer"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto" style={{ height: 'calc(100% - 68px - 80px)' }}>
                    {favorites.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-center px-8">
                            <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mb-4">
                                <Heart size={28} className="text-red-300" />
                            </div>
                            <h3 className="text-base font-semibold text-gray-800 mb-1">
                                No saved items yet
                            </h3>
                            <p className="text-sm text-gray-500 leading-relaxed">
                                Tap the <Heart size={12} className="inline text-gray-400" /> button on any product card to save it here for easy comparison.
                            </p>
                        </div>
                    ) : (
                        <div className="p-3 space-y-3">
                            {favorites.map((product) => (
                                <div
                                    key={product.id}
                                    className="flex gap-3 p-3 rounded-xl border border-gray-100 bg-gray-50/50 hover:bg-white transition-colors group"
                                >
                                    {/* Thumbnail */}
                                    <div className="w-20 h-20 rounded-lg overflow-hidden bg-gray-100 shrink-0">
                                        <img
                                            src={product.thumbnailUrl || product.imageUrl}
                                            alt={product.name}
                                            className="w-full h-full object-cover"
                                            loading="lazy"
                                        />
                                    </div>

                                    {/* Details */}
                                    <div className="flex-1 min-w-0">
                                        <h4 className="text-sm font-semibold text-gray-900 line-clamp-2 leading-snug mb-0.5">
                                            {product.name}
                                        </h4>
                                        <p className="text-sm font-bold text-red-600 mb-2">
                                            {product.priceFormatted}
                                        </p>

                                        {/* Action buttons */}
                                        <div className="flex items-center gap-1.5">
                                            <a
                                                href={product.productUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-[10px] font-medium px-2 py-1 rounded-md bg-red-600 text-white hover:bg-red-700 transition-colors flex items-center gap-1"
                                            >
                                                <ShoppingCart size={9} /> Buy
                                            </a>
                                            <button
                                                onClick={() => onWriteMessage(product)}
                                                className="text-[10px] font-medium px-2 py-1 rounded-md border border-gray-200 text-gray-600 hover:border-purple-200 hover:text-purple-600 hover:bg-purple-50 transition-all flex items-center gap-1"
                                                title="Write a gift card message"
                                            >
                                                <MessageSquareHeart size={9} /> Card
                                            </button>
                                            <button
                                                onClick={() => handleCopyLink(product)}
                                                className="text-[10px] font-medium px-2 py-1 rounded-md border border-gray-200 text-gray-600 hover:border-blue-200 hover:text-blue-600 hover:bg-blue-50 transition-all flex items-center gap-1"
                                                title="Copy product link"
                                            >
                                                {copiedLink === product.id ? (
                                                    <><Check size={9} /> Copied</>
                                                ) : (
                                                    <><Copy size={9} /> Link</>
                                                )}
                                            </button>
                                            <button
                                                onClick={() => onRemove(product)}
                                                className="text-[10px] font-medium px-2 py-1 rounded-md border border-gray-200 text-gray-400 hover:border-red-200 hover:text-red-500 hover:bg-red-50 transition-all ml-auto opacity-0 group-hover:opacity-100"
                                                title="Remove from saved"
                                                aria-label={`Remove ${product.name} from favorites`}
                                            >
                                                <Trash2 size={10} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                {favorites.length > 0 && (
                    <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-100 bg-white">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-sm text-gray-500">
                                {favorites.length} item{favorites.length !== 1 ? 's' : ''} saved
                            </span>
                            <span className="text-sm font-bold text-gray-900">
                                Total: ${totalValue.toFixed(2)}
                            </span>
                        </div>
                        <button
                            onClick={handleShareAll}
                            className="w-full py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
                            style={{ backgroundColor: 'var(--edible-red)' }}
                        >
                            <ExternalLink size={14} />
                            {copiedLink === 'all' ? 'Copied to clipboard!' : 'Share My Gift List'}
                        </button>
                    </div>
                )}
            </div>
        </>
    );
}
