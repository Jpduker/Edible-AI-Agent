/**
 * Tool constants and descriptions used by the chat API route.
 * Centralized here for maintainability and consistency.
 */

export const TOOL_DESCRIPTIONS = {
    search_products:
        'Search the Edible Arrangements product catalog by keyword. Returns products with names, prices, descriptions, images, and direct product page URLs. Use this tool whenever you need to find or recommend products. You can call this tool multiple times with different keywords to get diverse results. NEVER recommend products without first searching for them using this tool. IMPORTANT: When the user specifies a budget, you MUST set maxPrice. When the user asks for premium/upscale options, you MUST set minPrice. DELIVERY: When the user asks for delivery/shipping/same-day options, you MUST set deliveryFilter to "delivery" to exclude in-store pickup only items. MULTI-CATEGORY: When the user requests multiple distinct product types (e.g., "cakes and flowers"), make SEPARATE tool calls for each category — never combine them into a single keyword.',
    find_similar_products:
        'Find products similar to one the user already likes. Use this when a user says they like a specific product but want alternatives, or asks for "something similar" or "more like this." Extracts key attributes and searches for comparable products. IMPORTANT: When the user asks for "premium" or "more upscale" versions, set minPrice to the original product\'s price. When the user says "under $X" or specifies a budget, set maxPrice to X.',
} as const;

/** Maximum number of tool call round-trips before stopping */
export const MAX_TOOL_STEPS = 5;

/** Maximum number of products to return per tool call */
export const MAX_PRODUCTS_PER_SEARCH = 15;
export const MAX_PRODUCTS_PER_SIMILARITY = 10;
