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
                        'Search the Edible Arrangements product catalog by keyword. Returns up to 50 products with names, prices, descriptions, images, and direct product page URLs. Use this tool whenever you need to find or recommend products. You can call this tool multiple times with different keywords to get diverse results. NEVER recommend products without first searching for them using this tool.',
                    inputSchema: z.object({
                        keyword: z
                            .string()
                            .describe(
                                'The search keyword or short phrase to find products. Examples: "birthday chocolate", "thank you fruit", "valentines strawberries".'
                            ),
                    }),
                    execute: async ({ keyword }) => {
                        console.log(`[Chat API] Tool call: search_products("${keyword}")`);

                        try {
                            const products = await searchProductsServer(keyword);

                            if (products.length === 0) {
                                return {
                                    success: false,
                                    message: `No products found for "${keyword}". Try a different or broader search term.`,
                                    products: [],
                                };
                            }

                            const topProducts = products.slice(0, 15).map((p) => ({
                                name: p.name,
                                price: p.priceFormatted,
                                priceNumeric: p.price,
                                description: p.description,
                                url: p.productUrl,
                                imageUrl: p.imageUrl,
                                category: p.category,
                                occasion: p.occasion,
                            }));

                            console.log(
                                `[Chat API] Returning ${topProducts.length} products for "${keyword}"`
                            );

                            return {
                                success: true,
                                keyword,
                                resultCount: products.length,
                                products: topProducts,
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
