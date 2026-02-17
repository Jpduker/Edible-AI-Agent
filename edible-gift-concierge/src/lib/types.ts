export interface Product {
    id: string;
    name: string;
    price: number;
    priceFormatted: string;
    imageUrl: string;
    thumbnailUrl: string;
    productUrl: string;
    description: string;
    category?: string;
    occasion?: string;
    isOneHourDelivery?: boolean;
    promo?: string;
    productImageTag?: string;
    allergyInfo?: string;       // e.g. "Contains: Milk, Soy. May contain: Tree Nuts, Peanuts"
    ingredients?: string;       // e.g. "Strawberries, Semisweet Chocolate, White Chocolate"
    sizeCount?: number;         // Number of size variants (e.g. 7 = seven size options)
}

/**
 * Gift context extracted from the conversation — powers the sidebar.
 * Auto-detected from user messages using NLP-style heuristics.
 */
export interface GiftContext {
    recipient?: string;       // "my mom", "my boss", "my wife"
    recipientName?: string;   // "Sarah", "John" — if mentioned
    occasion?: string;        // "birthday", "valentine's day", "thank you"
    budget?: {
        min?: number;
        max?: number;
        raw: string;          // "under $50", "around $75"
    };
    preferences: string[];    // "chocolate lover", "fruit-forward", "no nuts"
    dietaryNeeds: string[];   // "vegan", "nut-free", "gluten-free"
    deliveryZip?: string;     // ZIP code
    deliveryDate?: string;    // "by Friday", "Feb 14"
    tone?: string;            // "romantic", "professional", "fun"
}

/**
 * A saved/favorited product for the wishlist.
 */
export interface FavoriteProduct extends Product {
    addedAt: number; // timestamp
    giftMessage?: string;
}

export interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    products?: Product[];
    quickReplies?: string[];
}

export interface ConversationState {
    recipient?: string;
    occasion?: string;
    preferences?: string[];
    budget?: string;
    searchesPerformed: string[];
}

export interface SearchResult {
    '@search.score': number;
    id: string;
    name: string;
    description: string;
    minPrice: number;
    maxPrice: number;
    image: string;
    thumbnail: string;
    url: string;
    category: string;
    occasion: string;
    allergyinformation: string;
    ingrediantNames: string;
    number: string;
    liveSku: boolean;
    isOneHourDelivery: boolean;
    productImageTag: string;
    promo: string;
    nonPromo: string;
    sizeCount: number;
    price?: number;
}
