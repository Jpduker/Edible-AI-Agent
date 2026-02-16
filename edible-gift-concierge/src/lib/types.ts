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
