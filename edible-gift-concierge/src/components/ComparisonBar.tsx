import React from 'react';
import { Product } from '@/lib/types';
import { X, ArrowRightLeft } from 'lucide-react';

interface ComparisonBarProps {
    selectedProducts: Product[];
    onClear: () => void;
    onCompare: () => void;
}

export default function ComparisonBar({
    selectedProducts,
    onClear,
    onCompare,
}: ComparisonBarProps) {
    if (selectedProducts.length === 0) return null;

    return (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 animate-in slide-in-from-bottom-4 fade-in duration-300">
            <div className="bg-gray-900 text-white px-4 py-3 rounded-full shadow-xl flex items-center gap-4 border border-gray-800">
                <div className="flex items-center gap-3 pl-2">
                    <span className="bg-white text-gray-900 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold">
                        {selectedProducts.length}
                    </span>
                    <span className="text-sm font-medium hidden sm:inline">
                        {selectedProducts.length === 1 ? 'Product' : 'Products'} Selected
                    </span>
                </div>

                <div className="h-4 w-px bg-gray-700" />

                <button
                    onClick={onCompare}
                    disabled={selectedProducts.length < 2}
                    className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-bold transition-all ${selectedProducts.length >= 2
                            ? 'bg-white text-gray-900 hover:bg-gray-100 hover:scale-105 shadow-md'
                            : 'bg-gray-800 text-gray-500 cursor-not-allowed'
                        }`}
                >
                    <ArrowRightLeft size={16} />
                    Compare
                </button>

                <button
                    onClick={onClear}
                    className="p-1.5 hover:bg-gray-800 rounded-full text-gray-400 hover:text-white transition-colors"
                    aria-label="Clear selection"
                >
                    <X size={18} />
                </button>
            </div>
        </div>
    );
}
