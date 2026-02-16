import { NextRequest, NextResponse } from 'next/server';

const EDIBLE_API_URL = 'https://www.ediblearrangements.com/api/search/';
const TIMEOUT_MS = 10000;

export async function POST(req: NextRequest) {
    try {
        const { keyword } = await req.json();

        if (!keyword || typeof keyword !== 'string') {
            return NextResponse.json(
                { error: 'A valid keyword string is required' },
                { status: 400 }
            );
        }

        const trimmedKeyword = keyword.trim().slice(0, 100);
        console.log(`[Edible API Proxy] Searching for: "${trimmedKeyword}"`);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

        try {
            const response = await fetch(EDIBLE_API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'User-Agent': 'EdibleGiftConcierge/1.0',
                },
                body: JSON.stringify({ keyword: trimmedKeyword }),
                signal: controller.signal,
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                console.error(`[Edible API Proxy] API returned status ${response.status}`);
                return NextResponse.json(
                    { error: 'Unable to search products at this time. Please try again.' },
                    { status: 502 }
                );
            }

            const data = await response.json();
            console.log(`[Edible API Proxy] Returned ${Array.isArray(data) ? data.length : 0} results for "${trimmedKeyword}"`);

            return NextResponse.json(data);
        } catch (fetchError: unknown) {
            clearTimeout(timeoutId);
            if (fetchError instanceof Error && fetchError.name === 'AbortError') {
                console.error('[Edible API Proxy] Request timed out');
                return NextResponse.json(
                    { error: 'The product search timed out. Please try again.' },
                    { status: 504 }
                );
            }
            throw fetchError;
        }
    } catch (error) {
        console.error('[Edible API Proxy] Unexpected error:', error);
        return NextResponse.json(
            { error: 'An unexpected error occurred while searching products.' },
            { status: 500 }
        );
    }
}
