import { Product, SearchResult } from './types';

const EDIBLE_BASE_URL = 'https://www.ediblearrangements.com';

function normalizeProduct(raw: SearchResult): Product {


    // Build full product URL from the relative slug
    const productUrl = raw.url
        ? `${EDIBLE_BASE_URL}/fruit-gifts/${raw.url}`
        : EDIBLE_BASE_URL;

    // Use full-size image, fallback to thumbnail 
    const imageUrl = raw.image || raw.thumbnail || '';

    // Ensure ID is a string to prevent selection bugs
    const id = String(raw.id || raw.number || Math.random());

    // Robust price extraction
    const price = raw.minPrice || raw.maxPrice || raw.price || 0;

    return {
        id,
        name: raw.name || 'Edible Arrangement',
        price: Math.round(price * 100) / 100,
        priceFormatted: `$${price.toFixed(2)}`,
        imageUrl,
        thumbnailUrl: raw.thumbnail || imageUrl,
        productUrl,
        description: raw.description || '',
        category: raw.category || undefined,
        occasion: raw.occasion || undefined,
        isOneHourDelivery: raw.isOneHourDelivery || false,
        promo: raw.promo || undefined,
        productImageTag: raw.productImageTag || undefined,
    };
}

export async function searchProducts(keyword: string, zipCode?: string): Promise<Product[]> {
    try {
        const response = await fetch('/api/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ keyword, zipCode }),
        });

        if (!response.ok) {
            console.error(`[edible-api] Search failed with status ${response.status}`);
            return [];
        }

        const data = await response.json();

        if (!Array.isArray(data)) {
            console.error('[edible-api] Unexpected response format:', typeof data);
            return [];
        }

        return data
            .filter((item: SearchResult) => item.liveSku !== false)
            .map(normalizeProduct);
    } catch (error) {
        console.error('[edible-api] Error searching products:', error);
        return [];
    }
}

/**
 * Server-side version that calls the Edible API directly
 * Used in API route handlers where the proxy isn't needed
 */
export async function searchProductsServer(keyword: string, zipCode?: string): Promise<Product[]> {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const response = await fetch('https://www.ediblearrangements.com/api/search/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'User-Agent': 'EdibleGiftConcierge/1.0',
            },
            body: JSON.stringify({ keyword, zipCode }),
            signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            console.error(`[edible-api-server] API returned status ${response.status}`);
            return [];
        }

        const data = await response.json();

        if (!Array.isArray(data)) {
            return [];
        }

        return data
            .filter((item: SearchResult) => item.liveSku !== false)
            .map(normalizeProduct);
    } catch (error) {
        console.error('[edible-api-server] Error:', error);
        return [];
    }
}
