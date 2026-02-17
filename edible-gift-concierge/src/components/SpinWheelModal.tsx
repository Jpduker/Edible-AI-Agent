import React, { useState, useEffect, useCallback } from 'react';
import { X, Sparkles, RefreshCw } from 'lucide-react';
import ProductCard from './ProductCard';

interface SpinWheelModalProps {
    isOpen: boolean;
    onClose: () => void;
}

interface WheelProduct {
    name: string;
    shortName: string;
    price: string;
    color: string;
    url: string;
    img: string;
    description: string;
    isOneHourDelivery: boolean;
}

// Wheel segment colors
const SEGMENT_COLORS = [
    '#FF3D38', // Red
    '#FBBF24', // Amber
    '#34D399', // Green
    '#60A5FA', // Blue
    '#A78BFA', // Purple
    '#F472B6', // Pink
];

// Fallback products in case API is unavailable
const FALLBACK_PRODUCTS: WheelProduct[] = [
    {
        name: "Birthday Box",
        shortName: "Birthday Box",
        price: "$54.99",
        color: SEGMENT_COLORS[0],
        url: "https://www.ediblearrangements.com/fruit-gifts/sprinkle-berry-birthday-box-9474",
        img: "https://resources.ediblearrangements.com/resources/en-us/i/a/t_Signature_Sprinkle_Berry_Birthday_Box.jpg",
        description: "A delightful box filled with chocolate-dipped strawberries and fresh fruit.",
        isOneHourDelivery: true
    },
    {
        name: "Cupcake Box",
        shortName: "Cupcakes",
        price: "$41.99",
        color: SEGMENT_COLORS[1],
        url: "https://www.ediblearrangements.com/fruit-gifts/create-your-own-cupcake-box",
        img: "https://resources.ediblearrangements.com/resources/en-us/i/a/t_12cupcakesjanCreate_Your_Own_Cupcake_Box___6_ct_or_12_ct.jpg",
        description: "Create your own box of delicious gourmet cupcakes.",
        isOneHourDelivery: false
    },
    {
        name: "Edible Bouquet",
        shortName: "Bouquet",
        price: "$32.99",
        color: SEGMENT_COLORS[2],
        url: "https://www.ediblearrangements.com/fruit-gifts/simply-edible-bouquet",
        img: "https://resources.ediblearrangements.com/resources/en-us/i/a/t_r_SimpEdiBouqe.jpg",
        description: "A classic arrangement of fresh fruit favorites.",
        isOneHourDelivery: true
    },
    {
        name: "Red Velvet Cake",
        shortName: "Red Velvet",
        price: "$57.99",
        color: SEGMENT_COLORS[3],
        url: "https://www.ediblearrangements.com/fruit-gifts/grand-red-velvet-cake-9221",
        img: "https://resources.ediblearrangements.com/resources/en-us/i/a/t_o_Oct25Grand_Red_Velvet_Cake.jpg",
        description: "A grand red velvet cake for a special celebration.",
        isOneHourDelivery: false
    },
    {
        name: "Dessert Board",
        shortName: "Dessert Board",
        price: "$59.99",
        color: SEGMENT_COLORS[4],
        url: "https://www.ediblearrangements.com/fruit-gifts/chocolate-lovers-dessert-board-9240",
        img: "https://resources.ediblearrangements.com/resources/en-us/i/a/t_med_May25240_Chocolate_Lovers_Dessert_Board_24ins.jpg",
        description: "A platter of chocolate-dipped treats for sharing.",
        isOneHourDelivery: true
    },
    {
        name: "Berry Arrangement",
        shortName: "Berries",
        price: "$29.99",
        color: SEGMENT_COLORS[5],
        url: "https://www.ediblearrangements.com/fruit-gifts/mini-berry-arrangement-9469",
        img: "https://resources.ediblearrangements.com/resources/en-us/i/a/t_chocconf_Jan2025Mini_Berry_Arrangement.jpg",
        description: "A sweet mini arrangement of fresh berries.",
        isOneHourDelivery: false
    }
];

/**
 * Generate a short label for the wheel from a product name.
 * Truncates to first 2 words or 14 chars max.
 */
function makeShortName(name: string): string {
    const words = name.split(' ');
    if (words.length <= 2) return name;
    const short = words.slice(0, 2).join(' ');
    return short.length > 14 ? short.slice(0, 13) + '…' : short;
}

export function SpinWheelModal({ isOpen, onClose }: SpinWheelModalProps) {
    const [isSpinning, setIsSpinning] = useState(false);
    const [winner, setWinner] = useState<WheelProduct | null>(null);
    const [rotation, setRotation] = useState(0);
    const [showConfetti, setShowConfetti] = useState(false);
    const [wheelProducts, setWheelProducts] = useState<WheelProduct[]>(FALLBACK_PRODUCTS);
    const [isLoadingProducts, setIsLoadingProducts] = useState(false);

    /**
     * Fetch trending/popular products from the live API to populate the wheel.
     * Uses diverse search terms to get varied results.
     */
    const fetchDynamicProducts = useCallback(async () => {
        setIsLoadingProducts(true);
        try {
            const searchTerms = ['popular gifts', 'best sellers', 'chocolate strawberries', 'fruit arrangements', 'birthday', 'gift basket'];
            const term = searchTerms[Math.floor(Math.random() * searchTerms.length)];

            const response = await fetch('/api/search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ keyword: term }),
            });

            if (!response.ok) throw new Error('Search failed');

            const data = await response.json();

            if (Array.isArray(data) && data.length >= 6) {
                // Pick 6 random products from results for variety
                const shuffled = data
                    .filter((p: { liveSku?: boolean }) => p.liveSku !== false)
                    .sort(() => Math.random() - 0.5)
                    .slice(0, 6);

                const dynamic: WheelProduct[] = shuffled.map((p: { name?: string; minPrice?: number; maxPrice?: number; price?: number; url?: string; image?: string; thumbnail?: string; description?: string; isOneHourDelivery?: boolean }, i: number) => ({
                    name: p.name || 'Edible Gift',
                    shortName: makeShortName(p.name || 'Edible Gift'),
                    price: `$${(p.minPrice || p.maxPrice || p.price || 0).toFixed(2)}`,
                    color: SEGMENT_COLORS[i % SEGMENT_COLORS.length],
                    url: p.url
                        ? `https://www.ediblearrangements.com/fruit-gifts/${p.url}`
                        : 'https://www.ediblearrangements.com',
                    img: p.image || p.thumbnail || '',
                    description: p.description || '',
                    isOneHourDelivery: p.isOneHourDelivery || false,
                }));

                setWheelProducts(dynamic);
            }
        } catch (err) {
            console.warn('[SpinWheel] Could not fetch live products, using fallbacks:', err);
            // Keep fallback products
        } finally {
            setIsLoadingProducts(false);
        }
    }, []);

    const segmentAngle = 360 / wheelProducts.length;

    // Fetch live products when modal opens
    useEffect(() => {
        if (isOpen) {
            setWinner(null);
            setRotation(0);
            setShowConfetti(false);
            setIsSpinning(false);
            fetchDynamicProducts();
        }
    }, [isOpen, fetchDynamicProducts]);

    const spinWheel = () => {
        if (isSpinning) return;

        setIsSpinning(true);
        setWinner(null);
        setShowConfetti(false);

        // Random rotation: at least 5 full spins + random offset
        const randomSpins = 5 + Math.random() * 3;
        const randomDegree = Math.floor(randomSpins * 360);

        // Calculate the target rotation
        const newRotation = rotation + randomDegree;
        setRotation(newRotation);

        // Calculate winner based on final position
        // The wheel rotates clockwise. The pointer is at the TOP (0 degrees).
        // Corrected logic: Use +90 degree offset to align pointer (12 o'clock) with calculation
        // This accounts for the segment phase shift and coordinate system differences
        const normalizedRotation = newRotation % 360;
        const segmentIndex = Math.floor(((360 - normalizedRotation + 90) % 360) / segmentAngle);

        // Handle negative index result from modulo logic edge cases
        const finalIndex = (segmentIndex + wheelProducts.length) % wheelProducts.length;

        const winningProduct = wheelProducts[finalIndex];

        setTimeout(() => {
            setIsSpinning(false);
            setWinner(winningProduct);
            setShowConfetti(true);
        }, 4500); // 4.5s spin duration
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl p-8 flex flex-col items-center gap-6 overflow-hidden max-h-[90vh] overflow-y-auto custom-scrollbar">

                {/* Confetti (Simple CSS particles) */}
                {showConfetti && (
                    <div className="absolute inset-0 pointer-events-none z-0">
                        {[...Array(20)].map((_, i) => (
                            <div
                                key={i}
                                className="absolute animate-confetti"
                                style={{
                                    left: `${Math.random() * 100}%`,
                                    top: `-10px`,
                                    backgroundColor: ['#FFD700', '#FF3D38', '#34D399', '#60A5FA'][Math.floor(Math.random() * 4)],
                                    width: `${Math.random() * 10 + 5}px`,
                                    height: `${Math.random() * 10 + 5}px`,
                                    animationDuration: `${Math.random() * 1 + 1}s`,
                                    animationDelay: `${Math.random() * 0.5}s`
                                }}
                            />
                        ))}
                    </div>
                )}

                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors z-20"
                >
                    <X size={24} />
                </button>

                <div className="text-center z-10 shrink-0">
                    <h2 className="text-2xl font-bold text-gray-900 flex items-center justify-center gap-2">
                        Surprise Me! <Sparkles className="text-yellow-500" size={24} />
                    </h2>
                    <p className="text-gray-500 text-sm mt-1">
                        {isLoadingProducts ? 'Loading fresh products...' : 'Stuck? Let fate decide the perfect gift.'}
                    </p>
                </div>

                {/* Wheel Container */}
                <div className="relative w-64 h-64 z-10 shrink-0">
                    {/* Pointer */}
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[12px] border-l-transparent border-r-[12px] border-r-transparent border-t-[20px] border-t-red-600 z-20 drop-shadow-md"></div>

                    {/* The Wheel */}
                    <div
                        className="w-full h-full rounded-full border-4 border-white shadow-xl overflow-hidden transition-transform"
                        style={{
                            transform: `rotate(${rotation}deg)`,
                            transitionDuration: isSpinning ? '4.5s' : '0s',
                            transitionTimingFunction: 'cubic-bezier(0.1, 0.75, 0.1, 1)', // Smoother premium deceleration
                            background: `conic-gradient(
                                ${wheelProducts.map((p, i) =>
                                `${p.color} ${i * segmentAngle}deg ${(i + 1) * segmentAngle}deg`
                            ).join(', ')}
                            )`
                        }}
                    >
                        {/* Segment Labels */}
                        {wheelProducts.map((p, i) => (
                            <div
                                key={i}
                                className="absolute w-full h-full text-center flex justify-center pt-2"
                                style={{
                                    transform: `rotate(${i * segmentAngle + segmentAngle / 2}deg)`,
                                    // Phase 2 Optimization: Larger, more legible text
                                    fontSize: '14px',
                                    fontWeight: '800',
                                    color: 'white',
                                    textShadow: '0 2px 4px rgba(0,0,0,0.5)',
                                    letterSpacing: '0.03em'
                                }}
                            >
                                <span className="transform -rotate-90 mt-6 w-28 truncate px-1 text-center leading-snug">
                                    {p.shortName}
                                </span>
                            </div>
                        ))}
                    </div>

                    {/* Center Cap - Enhanced with gradient ring */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 bg-gradient-to-br from-red-400 to-pink-400 rounded-full shadow-xl flex items-center justify-center z-20 p-1">
                        <div className="w-full h-full bg-white rounded-full flex items-center justify-center shadow-inner">
                            <span className="text-2xl">🍓</span>
                        </div>
                    </div>
                </div>

                {/* Controls / Result */}
                <div className="w-full z-10 min-h-[140px] flex items-center justify-center">
                    {!winner ? (
                        <div className="flex flex-col items-center gap-3">
                            <button
                                onClick={spinWheel}
                                disabled={isSpinning || isLoadingProducts}
                                className={`px-8 py-3 rounded-xl font-bold text-white shadow-lg transition-all transform hover:scale-105 active:scale-95 ${isSpinning || isLoadingProducts
                                        ? 'bg-gray-400 cursor-not-allowed'
                                        : 'bg-gradient-to-r from-red-500 to-pink-500 hover:shadow-red-500/30'
                                    }`}
                            >
                                {isSpinning ? 'Spinning...' : isLoadingProducts ? 'Loading...' : 'SPIN & DISCOVER'}
                            </button>
                            <button
                                onClick={fetchDynamicProducts}
                                disabled={isSpinning || isLoadingProducts}
                                className="text-xs text-gray-400 hover:text-red-500 font-medium flex items-center gap-1 transition-colors disabled:opacity-50"
                            >
                                <RefreshCw size={12} className={isLoadingProducts ? 'animate-spin' : ''} /> Shuffle products
                            </button>
                        </div>
                    ) : (
                        <div className="w-full animate-slide-in-up">
                            <div className="text-center mb-4">
                                <p className="text-sm font-medium text-gray-500 mb-1">Here's a gift idea for you!</p>
                                <button
                                    onClick={spinWheel}
                                    className="text-xs text-red-600 font-bold hover:underline"
                                >
                                    Spin Again?
                                </button>
                            </div>
                            <div className="max-w-[300px] mx-auto">
                                <ProductCard
                                    name={winner.name}
                                    price={winner.price}
                                    description={winner.description}
                                    imageUrl={winner.img}
                                    productUrl={winner.url}
                                    isOneHourDelivery={winner.isOneHourDelivery}
                                    isSelected={false}
                                />
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
