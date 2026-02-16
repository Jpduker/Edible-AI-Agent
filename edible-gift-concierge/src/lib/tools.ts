import { z } from 'zod';

export const searchProductsToolSchema = z.object({
    keyword: z
        .string()
        .describe(
            'The search keyword or short phrase to find products in the Edible Arrangements catalog. Examples: "birthday chocolate", "thank you fruit", "valentines strawberries", "sympathy basket", "corporate gift".'
        ),
    context: z
        .string()
        .optional()
        .describe(
            'Optional context about why this search is being performed, e.g. "User wants chocolate gifts for their mom\'s birthday under $75".'
        ),
});

export const searchProductsToolDescription = `Search the Edible Arrangements product catalog by keyword. Returns up to 50 products with names, prices, descriptions, images, and direct product page URLs. Use this tool whenever you need to find or recommend products. You can call this tool multiple times with different keywords to get diverse results. NEVER recommend products without first searching for them using this tool.`;
