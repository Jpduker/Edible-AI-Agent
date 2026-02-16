import React from 'react';
import { Product } from '@/lib/types';
import { X, Trash2, Check, ExternalLink } from 'lucide-react';
import Image from 'next/image';

interface ComparisonModalProps {
    isOpen: boolean;
    onClose: () => void;
    products: Product[];
    onRemoveProduct: (productId: string) => void;
}

export function ComparisonModal({
    isOpen,
    onClose,
    products,
    onRemoveProduct,
}: ComparisonModalProps) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-in fade-in duration-200">
            <div
                className="relative w-full max-w-5xl max-h-[90vh] overflow-hidden bg-white rounded-2xl shadow-2xl flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-100 bg-gray-50/50">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">Compare Products</h2>
                        <p className="text-sm text-gray-500 mt-1">
                            Comparing {products.length} item{products.length !== 1 ? 's' : ''}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                        aria-label="Close comparison"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Comparison Content */}
                <div className="flex-1 overflow-auto p-6 bg-white custom-scrollbar">
                    {products.length === 0 ? (
                        <div className="text-center py-12 text-gray-400">
                            No products selected for comparison.
                        </div>
                    ) : (
                        <div
                            className="grid gap-8 min-w-full"
                            style={{
                                gridTemplateColumns: `150px repeat(${products.length}, minmax(280px, 1fr))`,
                            }}
                        >
                            {/* Attribute Labels Column */}
                            {/* Attribute Labels Column */}
                            <div className="flex flex-col gap-6 min-w-[150px]">
                                <div className="h-[200px] shrink-0" aria-hidden="true" />
                                <div className="flex flex-col gap-6 font-medium text-gray-500 text-sm">
                                    <div className="h-[24px] flex items-center">Price</div>
                                    <div className="h-[24px] flex items-center">Delivery</div>
                                    <div className="h-[24px] flex items-center">Occasion</div>
                                    <div className="h-[24px] flex items-center">Category</div>
                                    <div className="">Description</div>
                                </div>
                            </div>

                            {products.map((product, index) => (
                                <div key={`${product.id}-${index}`} className="flex flex-col gap-6 relative group h-full">
                                    <button
                                        onClick={() => onRemoveProduct(product.id)}
                                        className="absolute -top-2 -right-2 p-1.5 bg-white shadow-md text-gray-400 hover:text-red-500 rounded-full border border-gray-100 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                                        title="Remove from comparison"
                                    >
                                        <Trash2 size={16} />
                                    </button>

                                    {/* Image & Name */}
                                    <div className="flex flex-col gap-3 h-[200px]">
                                        <div className="relative w-full aspect-square rounded-xl overflow-hidden border border-gray-100 bg-gray-50">
                                            <img
                                                src={product.imageUrl}
                                                alt={product.name}
                                                className="w-full h-full object-cover"
                                            />
                                        </div>
                                        <h3 className="font-bold text-gray-900 leading-tight">
                                            <a href={product.productUrl} target="_blank" rel="noopener noreferrer" className="hover:text-red-600 transition-colors">
                                                {product.name}
                                            </a>
                                        </h3>
                                    </div>

                                    {/* Attributes */}
                                    <div className="flex flex-col gap-6 text-sm text-gray-700">
                                        <div className="font-bold text-lg text-red-600 h-[24px]">
                                            {product.priceFormatted}
                                        </div>

                                        <div className="h-[24px]">
                                            {product.isOneHourDelivery ? (
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                                                    <Check size={12} strokeWidth={3} /> Same Day
                                                </span>
                                            ) : (
                                                <span className="text-gray-400 text-xs">—</span>
                                            )}
                                        </div>

                                        <div className="h-[24px] truncate" title={product.occasion}>
                                            {product.occasion || <span className="text-gray-400">—</span>}
                                        </div>

                                        <div className="h-[24px] truncate" title={product.category}>
                                            {product.category || <span className="text-gray-400">—</span>}
                                        </div>

                                        <div className="h-[140px] text-gray-600 leading-relaxed text-xs bg-gray-50 p-3 rounded-lg border border-gray-100 overflow-y-auto custom-scrollbar">
                                            {product.description}
                                        </div>

                                        <a
                                            href={product.productUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="mt-auto inline-flex items-center justify-center gap-2 w-full px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors"
                                        >
                                            View Product <ExternalLink size={14} />
                                        </a>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
