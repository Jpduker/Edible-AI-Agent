import React, { useState } from 'react';
import { Product } from '@/lib/types';
import { GiftContext } from '@/lib/types';
import { X, Trash2, Check, ExternalLink, Sparkles, Loader2 } from 'lucide-react';
import MessageBubble from './MessageBubble';

interface ComparisonModalProps {
    isOpen: boolean;
    onClose: () => void;
    products: Product[];
    onRemoveProduct: (productId: string) => void;
    giftContext?: GiftContext;
}

export function ComparisonModal({
    isOpen,
    onClose,
    products,
    onRemoveProduct,
    giftContext,
}: ComparisonModalProps) {
    const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analysisError, setAnalysisError] = useState<string | null>(null);

    if (!isOpen) return null;

    const handleAiCompare = async () => {
        if (products.length < 2) return;

        setIsAnalyzing(true);
        setAnalysisError(null);
        setAiAnalysis(null);

        try {
            const response = await fetch('/api/compare', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    products: products.map((p) => ({
                        name: p.name,
                        price: p.price,
                        priceFormatted: p.priceFormatted,
                        description: p.description,
                        allergyInfo: p.allergyInfo,
                        ingredients: p.ingredients,
                        occasion: p.occasion,
                        category: p.category,
                        isOneHourDelivery: p.isOneHourDelivery,
                        sizeCount: p.sizeCount,
                    })),
                    context: giftContext
                        ? {
                              recipient: giftContext.recipient,
                              occasion: giftContext.occasion,
                              budget: giftContext.budget,
                              preferences: giftContext.preferences,
                              dietaryNeeds: giftContext.dietaryNeeds,
                          }
                        : {},
                }),
            });

            if (!response.ok) {
                throw new Error('Comparison failed');
            }

            const data = await response.json();
            setAiAnalysis(data.analysis);
        } catch {
            setAnalysisError('Failed to get AI comparison. Please try again.');
        } finally {
            setIsAnalyzing(false);
        }
    };

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
                    <div className="flex items-center gap-2">
                        {products.length >= 2 && (
                            <button
                                onClick={handleAiCompare}
                                disabled={isAnalyzing}
                                className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-sm font-semibold rounded-lg hover:from-purple-700 hover:to-indigo-700 transition-all shadow-sm hover:shadow-md disabled:opacity-70 disabled:cursor-not-allowed"
                            >
                                {isAnalyzing ? (
                                    <Loader2 size={16} className="animate-spin" />
                                ) : (
                                    <Sparkles size={16} />
                                )}
                                {isAnalyzing ? 'Analyzing...' : 'Compare using AI'}
                            </button>
                        )}
                        <button
                            onClick={onClose}
                            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                            aria-label="Close comparison"
                        >
                            <X size={24} />
                        </button>
                    </div>
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

                {/* AI Analysis Panel */}
                {(aiAnalysis || isAnalyzing || analysisError) && (
                    <div className="border-t border-gray-100 p-6 bg-gradient-to-b from-purple-50/50 to-white">
                        <div className="flex items-center gap-2 mb-4">
                            <Sparkles size={18} className="text-purple-600" />
                            <h3 className="text-lg font-bold text-gray-900">AI Analysis</h3>
                        </div>

                        {isAnalyzing && (
                            <div className="flex items-center gap-3 text-purple-600 py-8 justify-center">
                                <Loader2 size={24} className="animate-spin" />
                                <span className="text-sm font-medium">Analyzing products based on your preferences...</span>
                            </div>
                        )}

                        {analysisError && (
                            <div className="text-sm text-red-600 bg-red-50 px-4 py-3 rounded-lg border border-red-200">
                                {analysisError}
                            </div>
                        )}

                        {aiAnalysis && (
                            <div className="prose prose-sm max-w-none">
                                <MessageBubble role="assistant" content={aiAnalysis} />
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
