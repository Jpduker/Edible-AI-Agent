'use client';

import { useState } from 'react';
import { Check, Star, Zap, MessageSquareHeart, Heart, ShieldAlert, Layers, ShoppingCart } from 'lucide-react';

interface ProductCardProps {
    name: string;
    price: string;
    description: string;
    imageUrl: string;
    productUrl: string;
    isOneHourDelivery?: boolean;
    promo?: string;
    productImageTag?: string;
    onToggleSelect?: () => void;
    isSelected?: boolean;
    onWriteMessage?: () => void;
    onToggleFavorite?: () => void;
    isFavorited?: boolean;
    allergyInfo?: string;
    ingredients?: string;
    sizeCount?: number;
    onAddToCart?: () => void;
    isInCart?: boolean;
}

export default function ProductCard({
    name,
    price,
    description,
    imageUrl,
    productUrl,
    isOneHourDelivery,
    promo,
    productImageTag,
    onToggleSelect,
    isSelected = false,
    onWriteMessage,
    onToggleFavorite,
    isFavorited = false,
    allergyInfo,
    ingredients,
    sizeCount,
    onAddToCart,
    isInCart = false,
}: ProductCardProps) {
    const [imageError, setImageError] = useState(false);
    const [imageLoaded, setImageLoaded] = useState(false);

    return (
        <div
            className="product-card rounded-xl overflow-hidden border animate-scale-in"
            style={{
                backgroundColor: 'var(--edible-card-bg)',
                borderColor: 'var(--edible-border-light)',
                boxShadow: '0 2px 12px var(--edible-shadow)',
            }}
        >
            {/* Image section */}
            <div className="relative w-full aspect-[4/3] overflow-hidden group" style={{ backgroundColor: '#f8f8f8' }}>
                {/* Favorite Heart — top-left */}
                {onToggleFavorite && (
                    <button
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            onToggleFavorite();
                        }}
                        className={`absolute top-3 left-3 z-20 w-9 h-9 rounded-full flex items-center justify-center shadow-md transition-all duration-200 ${isFavorited
                                ? 'bg-red-500 scale-110'
                                : 'bg-white/90 hover:bg-white hover:scale-110'
                            }`}
                        title={isFavorited ? 'Remove from favorites' : 'Save to favorites'}
                        aria-label={isFavorited ? 'Remove from favorites' : 'Save to favorites'}
                    >
                        <span className="text-lg leading-none">{isFavorited ? '❤️' : '🤍'}</span>
                    </button>
                )}

                {/* Selection Checkbox — top-right */}
                {onToggleSelect && (
                    <button
                        onClick={(e) => {
                            e.preventDefault();
                            onToggleSelect();
                        }}
                        className={`absolute top-3 right-3 z-20 w-8 h-8 rounded-full flex items-center justify-center shadow-md transition-all duration-200 ${isSelected
                                ? 'bg-red-600 text-white scale-110'
                                : 'bg-white/90 text-gray-400 hover:bg-white hover:text-red-500 hover:scale-105'
                            }`}
                        title={isSelected ? "Remove from comparison" : "Add to comparison"}
                    >
                        {isSelected ? (
                            <Check size={16} strokeWidth={3} />
                        ) : (
                            <div className="w-5 h-5 border-2 border-current rounded-md" />
                        )}
                    </button>
                )}

                {/* Badges — below the heart */}
                <div className="absolute top-14 left-3 z-10 flex flex-col gap-1.5 items-start">
                    {isOneHourDelivery && (
                        <div className="bg-green-600 text-white text-[10px] font-bold px-2.5 py-1 rounded-full shadow-sm flex items-center gap-1 backdrop-blur-sm bg-opacity-95">
                            <Zap size={10} fill="currentColor" /> Same Day Delivery
                        </div>
                    )}
                    {promo && (
                        <div className="bg-blue-600 text-white text-[10px] font-bold px-2.5 py-1 rounded-full shadow-sm flex items-center gap-1 backdrop-blur-sm bg-opacity-95">
                            <Star size={10} fill="currentColor" /> {promo}
                        </div>
                    )}
                    {productImageTag && !promo && (
                        <div className="bg-orange-500 text-white text-[10px] font-bold px-2.5 py-1 rounded-full shadow-sm backdrop-blur-sm bg-opacity-95">
                            {productImageTag}
                        </div>
                    )}
                </div>

                {!imageLoaded && !imageError && (
                    <div className="absolute inset-0 animate-shimmer rounded-t-xl" />
                )}
                {imageError ? (
                    <div className="image-placeholder w-full h-full">
                        <span>🍓</span>
                    </div>
                ) : (
                    <img
                        src={imageUrl}
                        alt={name}
                        className="w-full h-full object-cover transition-opacity duration-300"
                        style={{ opacity: imageLoaded ? 1 : 0 }}
                        onLoad={() => setImageLoaded(true)}
                        onError={() => setImageError(true)}
                        loading="lazy"
                    />
                )}
            </div>

            {/* Content section */}
            <div className="p-3.5">
                <div className="flex items-start justify-between gap-2 mb-1.5">
                    <h3
                        className="font-semibold text-[15px] leading-snug line-clamp-2"
                        style={{ color: 'var(--edible-dark)' }}
                    >
                        {name}
                    </h3>
                    <span
                        className="text-sm font-bold shrink-0 mt-0.5"
                        style={{ color: 'var(--edible-red)' }}
                    >
                        {price}
                    </span>
                </div>

                <p
                    className="text-xs leading-relaxed line-clamp-2 mb-2"
                    style={{ color: 'var(--edible-muted)' }}
                >
                    {description}
                </p>

                {/* Allergy, Ingredients & Size Badges */}
                {(allergyInfo || (sizeCount && sizeCount > 1) || ingredients) && (
                    <div className="flex flex-wrap gap-1 mb-2">
                        {allergyInfo && (
                            <span
                                className="inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-300"
                                title={allergyInfo}
                            >
                                <ShieldAlert size={8} /> {allergyInfo.length > 30 ? allergyInfo.slice(0, 30) + '…' : allergyInfo}
                            </span>
                        )}
                        {sizeCount && sizeCount > 1 && (
                            <span className="inline-flex items-center gap-0.5 text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-200">
                                <Layers size={8} /> {sizeCount} sizes
                            </span>
                        )}
                        {ingredients && (
                            <span
                                className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200 truncate max-w-[140px]"
                                title={ingredients}
                            >
                                {ingredients.split(',').slice(0, 3).join(', ')}{ingredients.split(',').length > 3 ? '\u2026' : ''}
                            </span>
                        )}
                    </div>
                )}

                <a
                    href={productUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full inline-flex items-center justify-center gap-1.5 text-xs font-semibold px-3.5 py-2 rounded-lg transition-all"
                    style={{
                        backgroundColor: 'var(--edible-red)',
                        color: 'white',
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'var(--edible-red-dark)';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'var(--edible-red)';
                    }}
                    aria-label={`View ${name} on Edible Arrangements`}
                >
                    View on Edible
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                        <path
                            d="M2.5 6H9.5M9.5 6L6.5 3M9.5 6L6.5 9"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />
                    </svg>
                </a>

                {/* Action row: Cart + Write Message */}
                <div className="flex items-center gap-2 mt-3">
                    {onAddToCart && (
                        <button
                            onClick={(e) => {
                                e.preventDefault();
                                onAddToCart();
                            }}
                            className={`flex-1 flex items-center justify-center gap-1.5 text-[11px] font-semibold px-3 py-2 rounded-lg border transition-all ${
                                isInCart
                                    ? 'bg-green-50 border-green-200 text-green-600'
                                    : 'bg-red-50 border-red-200 text-red-600 hover:bg-red-100'
                            }`}
                            title={isInCart ? 'Already in cart' : 'Add to cart'}
                            aria-label={isInCart ? 'Already in cart' : 'Add to cart'}
                        >
                            <ShoppingCart size={12} />
                            {isInCart ? 'In Cart' : 'Add to Cart'}
                        </button>
                    )}
                    {onWriteMessage && (
                        <button
                            onClick={(e) => {
                                e.preventDefault();
                                onWriteMessage();
                            }}
                            className="flex-1 flex items-center justify-center gap-1.5 text-[11px] font-semibold px-3 py-2 rounded-lg border bg-gray-50 border-gray-200 text-gray-500 hover:border-purple-200 hover:text-purple-500 hover:bg-purple-50 transition-all"
                            title="Write a gift message for this product"
                            aria-label="Write gift card message"
                        >
                            <MessageSquareHeart size={12} />
                            Write Card
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
