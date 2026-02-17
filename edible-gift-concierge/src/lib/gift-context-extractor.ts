/**
 * Gift Context Extractor
 * 
 * Client-side NLP-style heuristic engine that parses user messages to auto-detect
 * gift context: recipient, occasion, budget, preferences, dietary needs, etc.
 * 
 * Inspired by: Google Flights' search sidebar, Notion AI's contextual awareness.
 * Purpose: Shows users what the AI "understands" so they can correct misinterpretations.
 */

import type { GiftContext } from './types';

// ─── Pattern Matchers ───

const RECIPIENT_PATTERNS: { pattern: RegExp; label: string }[] = [
    { pattern: /\b(?:my |for )?(?:wife|spouse)\b/i, label: 'Wife / Spouse' },
    { pattern: /\b(?:my |for )?(?:husband)\b/i, label: 'Husband' },
    { pattern: /\b(?:my |for )?(?:girlfriend|gf)\b/i, label: 'Girlfriend' },
    { pattern: /\b(?:my |for )?(?:boyfriend|bf)\b/i, label: 'Boyfriend' },
    { pattern: /\b(?:my |for )?(?:partner|significant other|SO)\b/i, label: 'Partner' },
    { pattern: /\b(?:my |for )?(?:mom|mother|mama|mum)\b/i, label: 'Mom' },
    { pattern: /\b(?:my |for )?(?:dad|father|papa)\b/i, label: 'Dad' },
    { pattern: /\b(?:my |for )?(?:grandma|grandmother|nana|granny)\b/i, label: 'Grandma' },
    { pattern: /\b(?:my |for )?(?:grandpa|grandfather|grandad|gramps)\b/i, label: 'Grandpa' },
    { pattern: /\b(?:my |for )?(?:sister|sis)\b/i, label: 'Sister' },
    { pattern: /\b(?:my |for )?(?:brother|bro)\b/i, label: 'Brother' },
    { pattern: /\b(?:my |for )?(?:daughter)\b/i, label: 'Daughter' },
    { pattern: /\b(?:my |for )?(?:son)\b/i, label: 'Son' },
    { pattern: /\b(?:my |for )?(?:boss|manager|supervisor)\b/i, label: 'Boss' },
    { pattern: /\b(?:my |for )?(?:coworker|colleague|teammate)\b/i, label: 'Coworker' },
    { pattern: /\b(?:my |for )?(?:friend|bestie|best friend|buddy|pal)\b/i, label: 'Friend' },
    { pattern: /\b(?:my |for )?(?:teacher|professor|instructor)\b/i, label: 'Teacher' },
    { pattern: /\b(?:my |for )?(?:client|customer)\b/i, label: 'Client' },
    { pattern: /\b(?:my |for )?(?:neighbor|neighbour)\b/i, label: 'Neighbor' },
];

const OCCASION_PATTERNS: { pattern: RegExp; label: string; emoji: string }[] = [
    { pattern: /\bbirthday\b/i, label: 'Birthday', emoji: '🎂' },
    { pattern: /\bvalentin/i, label: "Valentine's Day", emoji: '❤️' },
    { pattern: /\bmother'?s?\s*day\b/i, label: "Mother's Day", emoji: '💐' },
    { pattern: /\bfather'?s?\s*day\b/i, label: "Father's Day", emoji: '👔' },
    { pattern: /\bthank\s*(?:you|s)\b/i, label: 'Thank You', emoji: '🙏' },
    { pattern: /\banniversary/i, label: 'Anniversary', emoji: '💍' },
    { pattern: /\bwedding\b/i, label: 'Wedding', emoji: '💒' },
    { pattern: /\bgraduat/i, label: 'Graduation', emoji: '🎓' },
    { pattern: /\bget\s*well|recovery|healing\b/i, label: 'Get Well Soon', emoji: '🏥' },
    { pattern: /\bsymp(?:athy|athies)\b|condolence|sorry for (?:your|the) loss/i, label: 'Sympathy', emoji: '🕊️' },
    { pattern: /\b(?:congrat|congratulat)/i, label: 'Congratulations', emoji: '🎉' },
    { pattern: /\bchristmas|xmas|holiday\b/i, label: 'Holiday', emoji: '🎄' },
    { pattern: /\bcorporate|business|office|work\b/i, label: 'Corporate', emoji: '🏢' },
    { pattern: /\bjust\s*because|no\s*reason|thinking\s*of/i, label: 'Just Because', emoji: '💝' },
    { pattern: /\bnew\s*baby|baby\s*shower|newborn\b/i, label: 'New Baby', emoji: '🍼' },
    { pattern: /\bhousewarming|new\s*home\b/i, label: 'Housewarming', emoji: '🏠' },
    { pattern: /\bapology|apologize|i'?m\s*sorry\b/i, label: 'Apology', emoji: '💔' },
    { pattern: /\bromantic|romance|date\s*night|love\b/i, label: 'Romantic', emoji: '🌹' },
];

const BUDGET_PATTERNS: { pattern: RegExp; extractor: (match: RegExpMatchArray) => { min?: number; max?: number; raw: string } }[] = [
    {
        pattern: /under\s*\$(\d+)/i,
        extractor: (m) => ({ max: Number(m[1]), raw: `Under $${m[1]}` }),
    },
    {
        pattern: /below\s*\$(\d+)/i,
        extractor: (m) => ({ max: Number(m[1]), raw: `Under $${m[1]}` }),
    },
    {
        pattern: /no\s*more\s*than\s*\$(\d+)/i,
        extractor: (m) => ({ max: Number(m[1]), raw: `Under $${m[1]}` }),
    },
    {
        pattern: /(?:at most|max(?:imum)?)\s*\$(\d+)/i,
        extractor: (m) => ({ max: Number(m[1]), raw: `Max $${m[1]}` }),
    },
    {
        pattern: /(?:around|about|roughly|approximately)\s*\$(\d+)/i,
        extractor: (m) => {
            const n = Number(m[1]);
            return { min: Math.round(n * 0.7), max: Math.round(n * 1.3), raw: `~$${n}` };
        },
    },
    {
        pattern: /\$(\d+)\s*[-–to]+\s*\$(\d+)/i,
        extractor: (m) => ({ min: Number(m[1]), max: Number(m[2]), raw: `$${m[1]}–$${m[2]}` }),
    },
    {
        pattern: /(?:budget|spend|spending)\s*(?:is|of)?\s*\$(\d+)/i,
        extractor: (m) => ({ max: Number(m[1]), raw: `Budget: $${m[1]}` }),
    },
    {
        pattern: /(?:over|above|more than|at least|minimum)\s*\$(\d+)/i,
        extractor: (m) => ({ min: Number(m[1]), raw: `$${m[1]}+` }),
    },
    {
        pattern: /\$(\d+)\+/,
        extractor: (m) => ({ min: Number(m[1]), raw: `$${m[1]}+` }),
    },
];

const PREFERENCE_PATTERNS: { pattern: RegExp; label: string }[] = [
    { pattern: /\bchocolate/i, label: '🍫 Chocolate lover' },
    { pattern: /\bfruit|berry|berries|strawberr/i, label: '🍓 Fruit forward' },
    { pattern: /\bcheesecake/i, label: '🍰 Cheesecake' },
    { pattern: /\bcookie/i, label: '🍪 Cookies' },
    { pattern: /\bbrownie/i, label: '🍫 Brownies' },
    { pattern: /\bcake|cupcake/i, label: '🎂 Cake' },
    { pattern: /\bpremium|luxur|upscale|fancy|deluxe/i, label: '✨ Premium / Luxury' },
    { pattern: /\bsimple|small|mini|minimal/i, label: '🎯 Simple & small' },
    { pattern: /\bbig|large|grand|impressive/i, label: '🎁 Grand / Impressive' },
    { pattern: /\barrangement|bouquet/i, label: '💐 Arrangement' },
    { pattern: /\bbasket|box/i, label: '📦 Gift basket / box' },
    { pattern: /\bdipped/i, label: '🫧 Dipped treats' },
];

const DIETARY_PATTERNS: { pattern: RegExp; label: string }[] = [
    { pattern: /\bvegan\b/i, label: '🌱 Vegan' },
    { pattern: /\bnut[- ]?free|no\s*nuts|(?:allerg(?:y|ic)\s*(?:to\s*)?nuts)|peanut\s*(?:allerg|free)/i, label: '🥜 Nut-free' },
    { pattern: /\bgluten[- ]?free|no\s*gluten|celiac/i, label: '🌾 Gluten-free' },
    { pattern: /\bdairy[- ]?free|no\s*dairy|lactose/i, label: '🥛 Dairy-free' },
    { pattern: /\bkosher\b/i, label: '✡️ Kosher' },
    { pattern: /\bhalal\b/i, label: '☪️ Halal' },
    { pattern: /\bhealthy|health[- ]?conscious|organic|natural\b/i, label: '🥗 Health-conscious' },
    { pattern: /\bdiabet|sugar[- ]?free|low[- ]?sugar/i, label: '💉 Sugar-conscious' },
];

const TONE_PATTERNS: { pattern: RegExp; label: string }[] = [
    { pattern: /\bromantic|sexy|sensual|intimate/i, label: '🌹 Romantic' },
    { pattern: /\bprofessional|formal|corporate|business/i, label: '🏢 Professional' },
    { pattern: /\bfun|playful|silly|quirky|cute/i, label: '🎉 Fun & playful' },
    { pattern: /\belegant|classy|sophisticat/i, label: '✨ Elegant' },
    { pattern: /\bcozy|warm|comfort/i, label: '🧸 Cozy & warm' },
    { pattern: /\bthoughtful|meaningful|personal/i, label: '💭 Thoughtful' },
];

const ZIP_PATTERN = /\b(\d{5})(?:-\d{4})?\b/;

const NAME_PATTERN = /\b(?:(?:for|named?|called?)\s+)([A-Z][a-z]{1,15})\b/;

/**
 * Extract gift context from an array of user message strings.
 * Scans all messages to build a cumulative context picture.
 */
export function extractGiftContext(userMessages: string[]): GiftContext {
    const context: GiftContext = {
        preferences: [],
        dietaryNeeds: [],
    };

    const allText = userMessages.join(' ');

    // Recipient
    for (const { pattern, label } of RECIPIENT_PATTERNS) {
        if (pattern.test(allText)) {
            context.recipient = label;
            break;
        }
    }

    // Recipient name
    const nameMatch = allText.match(NAME_PATTERN);
    if (nameMatch) {
        context.recipientName = nameMatch[1];
    }

    // Occasion
    for (const { pattern, label } of OCCASION_PATTERNS) {
        if (pattern.test(allText)) {
            context.occasion = label;
            break;
        }
    }

    // Budget (use last-mentioned budget — most refined)
    for (const msg of userMessages) {
        for (const { pattern, extractor } of BUDGET_PATTERNS) {
            const match = msg.match(pattern);
            if (match) {
                context.budget = extractor(match);
            }
        }
    }

    // Preferences (accumulate unique ones)
    const prefsSeen = new Set<string>();
    for (const { pattern, label } of PREFERENCE_PATTERNS) {
        if (pattern.test(allText) && !prefsSeen.has(label)) {
            prefsSeen.add(label);
            context.preferences.push(label);
        }
    }

    // Dietary needs
    const dietSeen = new Set<string>();
    for (const { pattern, label } of DIETARY_PATTERNS) {
        if (pattern.test(allText) && !dietSeen.has(label)) {
            dietSeen.add(label);
            context.dietaryNeeds.push(label);
        }
    }

    // Delivery ZIP
    const zipMatch = allText.match(ZIP_PATTERN);
    if (zipMatch) {
        context.deliveryZip = zipMatch[1];
    }

    // Tone
    for (const { pattern, label } of TONE_PATTERNS) {
        if (pattern.test(allText)) {
            context.tone = label;
            break;
        }
    }

    return context;
}

/**
 * Returns the occasion emoji for display.
 */
export function getOccasionEmoji(occasion: string): string {
    const found = OCCASION_PATTERNS.find((p) => p.label === occasion);
    return found?.emoji ?? '🎁';
}

/**
 * Compute how "complete" the gift context is (0-100%).
 * Helps show a progress indicator. 
 */
export function getContextCompleteness(ctx: GiftContext): number {
    let filled = 0;
    let total = 5; // recipient, occasion, budget, preferences, tone

    if (ctx.recipient) filled++;
    if (ctx.occasion) filled++;
    if (ctx.budget) filled++;
    if (ctx.preferences.length > 0) filled++;
    if (ctx.tone || ctx.dietaryNeeds.length > 0) filled++;

    return Math.round((filled / total) * 100);
}
