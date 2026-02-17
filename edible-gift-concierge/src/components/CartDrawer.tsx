'use client';

import { useState } from 'react';
import { Product } from '@/lib/types';
import { X, ShoppingCart, Plus, Minus, Trash2, ExternalLink, AlertCircle } from 'lucide-react';

export interface CartItem {
    product: Product;
    quantity: number;
}

interface CartDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    items: CartItem[];
    onUpdateQuantity: (productId: string, quantity: number) => void;
    onRemoveItem: (productId: string) => void;
    onClearCart: () => void;
}

export function CartDrawer({
    isOpen,
    onClose,
    items,
    onUpdateQuantity,
    onRemoveItem,
    onClearCart,
}: CartDrawerProps) {
    const [showCheckoutMsg, setShowCheckoutMsg] = useState(false);

    if (!isOpen) return null;

    const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
    const totalPrice = items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);

    const handleCheckout = () => {
        setShowCheckoutMsg(true);
    };

    return (
        <div className="fixed inset-0 z-50 flex justify-end">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

            {/* Drawer */}
            <div className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-gray-100">
                    <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-full bg-red-50 flex items-center justify-center">
                            <ShoppingCart size={18} className="text-red-600" />
                        </div>
                        <div>
                            <h2 className="font-bold text-gray-900 text-lg">Your Cart</h2>
                            <p className="text-xs text-gray-500">
                                {totalItems} item{totalItems !== 1 ? 's' : ''}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {items.length > 0 && (
                            <button
                                onClick={onClearCart}
                                className="text-xs text-gray-400 hover:text-red-500 transition-colors px-2 py-1"
                            >
                                Clear All
                            </button>
                        )}
                        <button
                            onClick={onClose}
                            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Cart Items */}
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {items.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-3 px-6">
                            <ShoppingCart size={48} strokeWidth={1} />
                            <p className="text-sm font-medium">Your cart is empty</p>
                            <p className="text-xs text-center">
                                Browse products and tap &quot;Add to Cart&quot; to start building your order.
                            </p>
                        </div>
                    ) : (
                        <div className="p-4 space-y-3">
                            {items.map((item) => (
                                <div
                                    key={item.product.id}
                                    className="flex gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100"
                                >
                                    {/* Product Image */}
                                    <div className="w-20 h-20 rounded-lg overflow-hidden shrink-0 bg-white border border-gray-100">
                                        <img
                                            src={item.product.imageUrl}
                                            alt={item.product.name}
                                            className="w-full h-full object-cover"
                                        />
                                    </div>

                                    {/* Product Details */}
                                    <div className="flex-1 min-w-0">
                                        <h3 className="text-sm font-semibold text-gray-900 line-clamp-2 leading-tight">
                                            {item.product.name}
                                        </h3>
                                        <p className="text-sm font-bold text-red-600 mt-1">
                                            {item.product.priceFormatted}
                                        </p>

                                        {/* Quantity Controls */}
                                        <div className="flex items-center justify-between mt-2">
                                            <div className="flex items-center gap-1.5 bg-white rounded-lg border border-gray-200">
                                                <button
                                                    onClick={() =>
                                                        onUpdateQuantity(
                                                            item.product.id,
                                                            Math.max(1, item.quantity - 1)
                                                        )
                                                    }
                                                    className="p-1.5 text-gray-500 hover:text-gray-700 transition-colors"
                                                    aria-label="Decrease quantity"
                                                >
                                                    <Minus size={14} />
                                                </button>
                                                <span className="text-sm font-semibold text-gray-900 w-6 text-center">
                                                    {item.quantity}
                                                </span>
                                                <button
                                                    onClick={() =>
                                                        onUpdateQuantity(item.product.id, item.quantity + 1)
                                                    }
                                                    className="p-1.5 text-gray-500 hover:text-gray-700 transition-colors"
                                                    aria-label="Increase quantity"
                                                >
                                                    <Plus size={14} />
                                                </button>
                                            </div>

                                            <button
                                                onClick={() => onRemoveItem(item.product.id)}
                                                className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
                                                aria-label="Remove item"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer with Total & Checkout */}
                {items.length > 0 && (
                    <div className="border-t border-gray-100 p-5 space-y-3">
                        {/* Checkout Message */}
                        {showCheckoutMsg && (
                            <div className="flex items-start gap-2.5 p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-800 text-xs animate-in fade-in duration-300">
                                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                                <div>
                                    <p className="font-semibold mb-0.5">Login Required</p>
                                    <p>
                                        To complete your purchase, please visit{' '}
                                        <a
                                            href="https://www.ediblearrangements.com"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="underline font-medium hover:text-amber-900"
                                        >
                                            ediblearrangements.com
                                        </a>{' '}
                                        and add these items to your cart. Account login is required for checkout.
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Total */}
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs text-gray-500">Estimated Total</p>
                                <p className="text-xl font-bold text-gray-900">
                                    ${totalPrice.toFixed(2)}
                                </p>
                            </div>
                            <p className="text-[10px] text-gray-400">
                                {totalItems} item{totalItems !== 1 ? 's' : ''}
                            </p>
                        </div>

                        {/* Checkout Button */}
                        <button
                            onClick={handleCheckout}
                            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-600 text-white text-sm font-bold rounded-xl hover:bg-red-700 transition-all shadow-sm hover:shadow-md"
                        >
                            <ShoppingCart size={16} />
                            Proceed to Checkout
                            <ExternalLink size={14} />
                        </button>

                        {/* View individual products */}
                        <p className="text-[10px] text-center text-gray-400">
                            You can also view each product individually on ediblearrangements.com
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
