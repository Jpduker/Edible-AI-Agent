import { anthropic } from '@ai-sdk/anthropic';
import { streamText, tool, stepCountIs, convertToModelMessages } from 'ai';
import type { ModelMessage } from 'ai';
import { z } from 'zod';
import { getSystemPrompt, SYSTEM_PROMPT_VERSION } from '@/lib/system-prompt';
import { searchProductsServer } from '@/lib/edible-api';
import { TOOL_DESCRIPTIONS, MAX_TOOL_STEPS, MAX_PRODUCTS_PER_SEARCH, MAX_PRODUCTS_PER_SIMILARITY } from '@/lib/tools';

export const maxDuration = 60;

// ─── Structured Logger ───
function log(level: 'info' | 'warn' | 'error', event: string, data?: Record<string, unknown>) {
    const entry = {
        timestamp: new Date().toISOString(),
        level,
        event,
        promptVersion: SYSTEM_PROMPT_VERSION,
        ...data,
    };
    if (level === 'error') {
        console.error(JSON.stringify(entry));
    } else if (level === 'warn') {
        console.warn(JSON.stringify(entry));
    } else {
        console.log(JSON.stringify(entry));
    }
}

// Simple in-memory rate limiting
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT = 20;
const RATE_WINDOW_MS = 60 * 1000;

function checkRateLimit(ip: string): boolean {
    const now = Date.now();
    const entry = rateLimitMap.get(ip);

    if (!entry || now > entry.resetTime) {
        rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_WINDOW_MS });
        return true;
    }

    if (entry.count >= RATE_LIMIT) {
        return false;
    }

    entry.count++;
    return true;
}

// ─── Conversation Window Management ───
// Rough token estimation: ~4 chars per token
// Keep conversations under ~80k tokens to leave room for system prompt + response
const MAX_ESTIMATED_TOKENS = 80000;
const CHARS_PER_TOKEN = 4;

function estimateTokens(messages: ModelMessage[]): number {
    return Math.ceil(
        JSON.stringify(messages).length / CHARS_PER_TOKEN
    );
}

function trimConversation(messages: ModelMessage[]): ModelMessage[] {
    const estimated = estimateTokens(messages);
    if (estimated <= MAX_ESTIMATED_TOKENS) return messages;

    log('warn', 'conversation_trimmed', {
        originalMessages: messages.length,
        estimatedTokens: estimated,
    });

    // Keep the first message (initial user intent) and the last N messages
    // Remove from the middle to preserve context bookends
    const keepLast = Math.max(10, Math.floor(messages.length * 0.6));
    const trimmed = [
        messages[0],
        ...messages.slice(-keepLast),
    ];

    return trimmed;
}

export async function POST(req: Request) {
    try {
        const forwarded = req.headers.get('x-forwarded-for');
        const ip = forwarded?.split(',')[0] ?? 'unknown';

        if (!checkRateLimit(ip)) {
            return new Response(
                JSON.stringify({ error: 'Too many requests. Please wait a moment and try again.' }),
                { status: 429, headers: { 'Content-Type': 'application/json' } }
            );
        }

        const { messages } = await req.json();

        if (!messages || !Array.isArray(messages)) {
            return new Response(
                JSON.stringify({ error: 'Messages array is required.' }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
        }

        // Convert UIMessages (parts-based) from v6 client to ModelMessages (content-based) for streamText
        const modelMessages = await convertToModelMessages(messages);

        // Trim conversation if it's getting too long to prevent context window overflow
        const trimmedMessages = trimConversation(modelMessages);

        log('info', 'chat_request', {
            ip,
            messageCount: messages.length,
            trimmedCount: trimmedMessages.length,
            estimatedTokens: estimateTokens(trimmedMessages),
        });

        const result = streamText({
            model: anthropic('claude-sonnet-4-20250514'),
            system: getSystemPrompt(),
            messages: trimmedMessages,
            tools: {
                search_products: tool({
                    description: TOOL_DESCRIPTIONS.search_products,
                    inputSchema: z.object({
                        keyword: z
                            .string()
                            .describe(
                                'The search keyword or short phrase to find products. Examples: "birthday chocolate", "thank you fruit", "valentines strawberries".'
                            ),
                        maxPrice: z
                            .number()
                            .optional()
                            .describe(
                                'STRICT maximum price filter. If the user says "under $50", set this to 50. Products above this price will be EXCLUDED from results. Always set this when the user mentions a budget.'
                            ),
                        minPrice: z
                            .number()
                            .optional()
                            .describe(
                                'STRICT minimum price filter. If the user asks for "premium" or "upscale" options relative to a product priced at $X, set this to X. Products below this price will be EXCLUDED. Always set this for premium/upscale requests.'
                            ),
                        zipCode: z
                            .string()
                            .optional()
                            .describe('Recipient ZIP code for delivery availability check.'),
                        deliveryFilter: z
                            .enum(['delivery', 'pickup', 'any'])
                            .optional()
                            .describe(
                                'Filter products by delivery type. Set to "delivery" when the user asks for delivery/shipping/same-day delivery options — this EXCLUDES in-store pickup only items. Set to "pickup" for in-store pickup only. Defaults to "any" (no filtering). ALWAYS set this to "delivery" when the user mentions delivery, shipping, or sending a gift to someone.'
                            ),
                    }),
                    execute: async ({ keyword, maxPrice, minPrice, zipCode, deliveryFilter }) => {
                        log('info', 'tool_call', { tool: 'search_products', keyword, maxPrice, minPrice, zipCode, deliveryFilter });

                        try {
                            let products = await searchProductsServer(keyword, zipCode);

                            // STRICT server-side price filtering
                            if (maxPrice !== undefined) {
                                products = products.filter((p) => p.price < maxPrice);
                            }
                            if (minPrice !== undefined) {
                                products = products.filter((p) => p.price >= minPrice);
                            }

                            // STRICT server-side delivery type filtering
                            if (deliveryFilter === 'delivery') {
                                // Exclude in-store pickup only products
                                products = products.filter((p) => {
                                    const tag = (p.productImageTag || '').toLowerCase();
                                    return !tag.includes('in-store') && !tag.includes('pickup only');
                                });
                            } else if (deliveryFilter === 'pickup') {
                                // Only show in-store pickup products
                                products = products.filter((p) => {
                                    const tag = (p.productImageTag || '').toLowerCase();
                                    return tag.includes('in-store') || tag.includes('pickup');
                                });
                            }

                            if (products.length === 0) {
                                const priceInfo = maxPrice ? ` under $${maxPrice}` : minPrice ? ` above $${minPrice}` : '';
                                const deliveryInfo = deliveryFilter === 'delivery' ? ' with delivery available' : deliveryFilter === 'pickup' ? ' for in-store pickup' : '';
                                return {
                                    success: false,
                                    message: `No products found for "${keyword}"${priceInfo}${deliveryInfo}. Try a different search term or adjust the filters.`,
                                    products: [],
                                    appliedFilters: { maxPrice, minPrice, deliveryFilter },
                                };
                            }

                            const topProducts = products.slice(0, MAX_PRODUCTS_PER_SEARCH).map((p) => ({
                                id: p.id,
                                name: p.name,
                                price: p.price,
                                priceFormatted: p.priceFormatted,
                                description: p.description,
                                productUrl: p.productUrl,
                                imageUrl: p.imageUrl,
                                category: p.category,
                                occasion: p.occasion,
                                isOneHourDelivery: p.isOneHourDelivery,
                                promo: p.promo,
                                productImageTag: p.productImageTag,
                                allergyInfo: p.allergyInfo,
                                ingredients: p.ingredients,
                                sizeCount: p.sizeCount,
                            }));

                            log('info', 'tool_result', { tool: 'search_products', keyword, resultCount: topProducts.length, maxPrice, minPrice, deliveryFilter });

                            return {
                                success: true,
                                keyword,
                                resultCount: products.length,
                                products: topProducts,
                                appliedFilters: { maxPrice, minPrice, deliveryFilter },
                            };
                        } catch (error) {
                            log('error', 'tool_error', { tool: 'search_products', keyword, error: String(error) });
                            return {
                                success: false,
                                message: `I had trouble searching for "${keyword}". The product catalog might be temporarily unavailable.`,
                                products: [],
                            };
                        }
                    },
                }),
                find_similar_products: tool({
                    description: TOOL_DESCRIPTIONS.find_similar_products,
                    inputSchema: z.object({
                        productName: z
                            .string()
                            .describe(
                                'The name of the product the user likes, e.g. "Chocolate Dipped Strawberries"'
                            ),
                        attributes: z
                            .string()
                            .describe(
                                'Key attributes extracted from the product: category, flavor profile, price range, occasion type. E.g. "chocolate, fruit, dipped, romantic, $30-50"'
                            ),
                        maxPrice: z
                            .number()
                            .optional()
                            .describe(
                                'STRICT maximum price. If user wants similar but "under $50", set to 50. Products above this are EXCLUDED.'
                            ),
                        minPrice: z
                            .number()
                            .optional()
                            .describe(
                                'STRICT minimum price. If user wants "premium" version of a $50 product, set to 50. Products below this are EXCLUDED.'
                            ),
                        zipCode: z
                            .string()
                            .optional()
                            .describe('Recipient ZIP code for delivery availability check.'),
                        deliveryFilter: z
                            .enum(['delivery', 'pickup', 'any'])
                            .optional()
                            .describe(
                                'Filter by delivery type. Set to "delivery" to exclude in-store pickup only items. Set to "pickup" for in-store only. Defaults to "any".'
                            ),
                    }),
                    execute: async ({ productName, attributes, maxPrice, minPrice, zipCode, deliveryFilter }) => {
                        log('info', 'tool_call', { tool: 'find_similar_products', productName, attributes, maxPrice, minPrice, zipCode, deliveryFilter });

                        try {
                            // Run two parallel searches for diverse results
                            const attributeKeywords = attributes
                                .split(',')
                                .map((a) => a.trim())
                                .filter((a) => !a.startsWith('$'))
                                .slice(0, 3)
                                .join(' ');

                            const [byAttributes, byName] = await Promise.all([
                                searchProductsServer(attributeKeywords, zipCode),
                                searchProductsServer(productName.split(' ').slice(0, 2).join(' '), zipCode),
                            ]);

                            // Merge results, deduplicate by name, exclude original
                            const seen = new Set<string>();
                            const originalLower = productName.toLowerCase();
                            let merged = [...byAttributes, ...byName].filter((p) => {
                                const nameLower = p.name.toLowerCase();
                                if (seen.has(nameLower) || nameLower === originalLower) return false;
                                seen.add(nameLower);
                                return true;
                            });

                            // STRICT server-side price filtering
                            if (maxPrice !== undefined) {
                                merged = merged.filter((p) => p.price <= maxPrice);
                            }
                            if (minPrice !== undefined) {
                                merged = merged.filter((p) => p.price >= minPrice);
                            }

                            // STRICT server-side delivery type filtering
                            if (deliveryFilter === 'delivery') {
                                merged = merged.filter((p) => {
                                    const tag = (p.productImageTag || '').toLowerCase();
                                    return !tag.includes('in-store') && !tag.includes('pickup only');
                                });
                            } else if (deliveryFilter === 'pickup') {
                                merged = merged.filter((p) => {
                                    const tag = (p.productImageTag || '').toLowerCase();
                                    return tag.includes('in-store') || tag.includes('pickup');
                                });
                            }

                            if (merged.length === 0) {
                                const priceInfo = maxPrice ? ` under $${maxPrice}` : minPrice ? ` above $${minPrice}` : '';
                                const deliveryInfo = deliveryFilter === 'delivery' ? ' with delivery available' : deliveryFilter === 'pickup' ? ' for in-store pickup' : '';
                                return {
                                    success: false,
                                    message: `I couldn't find similar products to "${productName}"${priceInfo}${deliveryInfo}. Let me try a different search approach.`,
                                    originalProduct: productName,
                                    products: [],
                                    appliedFilters: { maxPrice, minPrice, deliveryFilter },
                                };
                            }

                            const topProducts = merged.slice(0, MAX_PRODUCTS_PER_SIMILARITY).map((p) => ({
                                id: p.id,
                                name: p.name,
                                price: p.price,
                                priceFormatted: p.priceFormatted,
                                description: p.description,
                                productUrl: p.productUrl,
                                imageUrl: p.imageUrl,
                                category: p.category,
                                occasion: p.occasion,
                                isOneHourDelivery: p.isOneHourDelivery,
                                promo: p.promo,
                                productImageTag: p.productImageTag,
                                allergyInfo: p.allergyInfo,
                                ingredients: p.ingredients,
                                sizeCount: p.sizeCount,
                            }));

                            log('info', 'tool_result', { tool: 'find_similar_products', productName, resultCount: topProducts.length, maxPrice, minPrice, deliveryFilter });

                            return {
                                success: true,
                                originalProduct: productName,
                                searchedAttributes: attributes,
                                resultCount: merged.length,
                                products: topProducts,
                                appliedFilters: { maxPrice, minPrice, deliveryFilter },
                            };
                        } catch (error) {
                            log('error', 'tool_error', { tool: 'find_similar_products', productName, error: String(error) });
                            return {
                                success: false,
                                message: `I had trouble finding similar products. Let me try a regular search instead.`,
                                originalProduct: productName,
                                products: [],
                            };
                        }
                    },
                }),
            },
            stopWhen: stepCountIs(MAX_TOOL_STEPS),
            onFinish({ text, steps, finishReason }) {
                // ─── Response Validation ───
                // Log quality signals for observability
                const hasQuickReplies = /\[\[.+\]\]\s*$/.test(text);
                const hasProductMention = /\*\*.+\*\*\s*—?\s*\$[\d.]+/.test(text);
                const wordCount = text.split(/\s+/).length;
                const toolCallCount = steps?.reduce(
                    (acc, s) => acc + (s.toolCalls?.length ?? 0), 0
                ) ?? 0;

                if (!hasQuickReplies && wordCount > 20) {
                    log('warn', 'missing_quick_replies', { finishReason, wordCount });
                }

                log('info', 'response_complete', {
                    finishReason,
                    wordCount,
                    toolCallCount,
                    hasQuickReplies,
                    hasProductMention,
                    steps: steps?.length ?? 0,
                });
            },
        });

        return result.toUIMessageStreamResponse();
    } catch (error) {
        log('error', 'unhandled_error', { error: String(error) });

        return new Response(
            JSON.stringify({
                error: "I'm having a moment — please try again shortly! 🍓",
            }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
    }
}
