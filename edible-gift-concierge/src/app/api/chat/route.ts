import { anthropic } from '@ai-sdk/anthropic';
import { streamText, tool, stepCountIs, convertToModelMessages } from 'ai';
import { z } from 'zod';
import { getSystemPrompt } from '@/lib/system-prompt';
import { searchProductsServer } from '@/lib/edible-api';

export const maxDuration = 60;

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

        const result = streamText({
            model: anthropic('claude-sonnet-4-20250514'),
            system: getSystemPrompt(),
            messages: modelMessages,
            tools: {
                search_products: tool({
                    description:
                        'Search the Edible Arrangements product catalog by keyword. Returns products with names, prices, descriptions, images, and direct product page URLs. Use this tool whenever you need to find or recommend products. You can call this tool multiple times with different keywords to get diverse results. NEVER recommend products without first searching for them using this tool. IMPORTANT: When the user specifies a budget, you MUST set maxPrice. When the user asks for premium/upscale options, you MUST set minPrice.',
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
                    }),
                    execute: async ({ keyword, maxPrice, minPrice, zipCode }) => {
                        console.log(`[Chat API] Tool call: search_products("${keyword}", maxPrice=${maxPrice}, minPrice=${minPrice}, zipCode=${zipCode})`);

                        try {
                            let products = await searchProductsServer(keyword, zipCode);

                            // STRICT server-side price filtering
                            if (maxPrice !== undefined) {
                                products = products.filter((p) => p.price < maxPrice);
                            }
                            if (minPrice !== undefined) {
                                products = products.filter((p) => p.price >= minPrice);
                            }

                            if (products.length === 0) {
                                const priceInfo = maxPrice ? ` under $${maxPrice}` : minPrice ? ` above $${minPrice}` : '';
                                return {
                                    success: false,
                                    message: `No products found for "${keyword}"${priceInfo}. Try a different search term or adjust the price range.`,
                                    products: [],
                                    appliedFilters: { maxPrice, minPrice },
                                };
                            }

                            const topProducts = products.slice(0, 15).map((p) => ({
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
                            }));

                            console.log(
                                `[Chat API] Returning ${topProducts.length} products for "${keyword}" (maxPrice=${maxPrice}, minPrice=${minPrice})`
                            );

                            return {
                                success: true,
                                keyword,
                                resultCount: products.length,
                                products: topProducts,
                                appliedFilters: { maxPrice, minPrice },
                            };
                        } catch (error) {
                            console.error(
                                `[Chat API] Tool execution failed for "${keyword}":`,
                                error
                            );
                            return {
                                success: false,
                                message: `I had trouble searching for "${keyword}". The product catalog might be temporarily unavailable.`,
                                products: [],
                            };
                        }
                    },
                }),
                find_similar_products: tool({
                    description:
                        'Find products similar to one the user already likes. Use this when a user says they like a specific product but want alternatives, or asks for "something similar" or "more like this." Extracts key attributes and searches for comparable products. IMPORTANT: When the user asks for "premium" or "more upscale" versions, set minPrice to the original product\'s price. When the user says "under $X" or specifies a budget, set maxPrice to X.',
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
                    }),
                    execute: async ({ productName, attributes, maxPrice, minPrice, zipCode }) => {
                        console.log(
                            `[Chat API] Tool call: find_similar_products("${productName}", "${attributes}", maxPrice=${maxPrice}, minPrice=${minPrice}, zipCode=${zipCode})`
                        );

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

                            if (merged.length === 0) {
                                const priceInfo = maxPrice ? ` under $${maxPrice}` : minPrice ? ` above $${minPrice}` : '';
                                return {
                                    success: false,
                                    message: `I couldn't find similar products to "${productName}"${priceInfo}. Let me try a different search approach.`,
                                    originalProduct: productName,
                                    products: [],
                                    appliedFilters: { maxPrice, minPrice },
                                };
                            }

                            const topProducts = merged.slice(0, 10).map((p) => ({
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
                            }));

                            console.log(
                                `[Chat API] Returning ${topProducts.length} similar products for "${productName}" (maxPrice=${maxPrice}, minPrice=${minPrice})`
                            );

                            return {
                                success: true,
                                originalProduct: productName,
                                searchedAttributes: attributes,
                                resultCount: merged.length,
                                products: topProducts,
                                appliedFilters: { maxPrice, minPrice },
                            };
                        } catch (error) {
                            console.error(
                                `[Chat API] Similarity search failed for "${productName}":`,
                                error
                            );
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
            stopWhen: stepCountIs(5),
        });

        return result.toUIMessageStreamResponse();
    } catch (error) {
        console.error('[Chat API] Unexpected error:', error);

        return new Response(
            JSON.stringify({
                error: "I'm having a moment — please try again shortly! 🍓",
            }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
    }
}
