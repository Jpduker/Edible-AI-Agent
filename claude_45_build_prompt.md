# Build the Edible Arrangements AI Gift Concierge — Full Application

You are building a complete, production-quality proof-of-concept for an **AI-powered product discovery experience** for Edible Arrangements (edible.com). This is a technical assessment for an AI Application Developer role, so quality, thoughtfulness, and attention to detail matter enormously.

---

## IMPORTANT: DESIGN DECISIONS LOG

**Before and during building, create a file called `DESIGN_DECISIONS.md` in the project root.** Every time you make a design decision — tech stack choice, prompt wording, UX pattern, architecture choice, error handling approach, model selection, styling decision — write a clear entry in this file explaining:
1. **What** the decision was
2. **Why** you chose it (the reasoning)
3. **What alternatives** you considered
4. **What trade-offs** you accepted

This file should be comprehensive and well-organized by category (Architecture, UX, AI/Prompt Design, Styling, Error Handling, etc.). It will be used as reference material for a technical interview. Be thorough — aim for 50+ entries.

---

## CONTEXT: What This Project Is

Edible Arrangements has a large catalog of fruit arrangements, chocolate-dipped fruit, gift baskets, baked goods, and more. Their customers are primarily **gift-givers** — people buying gifts for others on occasions like birthdays, Valentine's Day, thank you, sympathy, anniversaries, corporate events, etc.

Customer pain points:
- Don't know where to start (overwhelming catalog)
- Struggle to compare similar items
- Abandon sessions without purchasing

Your job: Build an **AI Gift Concierge** — a conversational experience that helps users find the perfect Edible gift confidently and quickly.

---

## STEP 1: Project Setup

Create a **Next.js 14+ application** with the App Router. Here's the exact setup:

```bash
npx create-next-app@latest edible-gift-concierge --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"
cd edible-gift-concierge
npm install ai @ai-sdk/anthropic
```

### Project Structure
```
src/
├── app/
│   ├── layout.tsx          # Root layout with fonts, metadata
│   ├── page.tsx            # Main page — renders the concierge experience
│   ├── globals.css         # Global styles + Tailwind + custom brand styles
│   └── api/
│       ├── chat/
│       │   └── route.ts    # POST endpoint — handles Claude conversation
│       └── search/
│           └── route.ts    # POST endpoint — proxies Edible Arrangements API
├── components/
│   ├── ChatInterface.tsx   # Main chat container
│   ├── MessageBubble.tsx   # Individual message display (user & AI)
│   ├── ProductCard.tsx     # Product recommendation card
│   ├── QuickReplies.tsx    # Clickable suggestion buttons
│   ├── WelcomeScreen.tsx   # Initial welcome state before first message
│   ├── TypingIndicator.tsx # Loading animation while AI responds
│   └── Header.tsx          # App header with Edible branding
├── lib/
│   ├── edible-api.ts       # Edible Arrangements API integration
│   ├── system-prompt.ts    # Modular system prompt for Claude
│   ├── tools.ts            # Tool definitions for Claude (search_products)
│   └── types.ts            # TypeScript types/interfaces
└── public/
    └── edible-logo.svg     # Brand logo (create a clean SVG placeholder)
```

**Log in DESIGN_DECISIONS.md**: Why Next.js over Vite/React SPA, why App Router, why Vercel AI SDK.

---

## STEP 2: Edible Arrangements API Integration

The Edible Arrangements product search API works as follows:

**Endpoint:** `https://www.ediblearrangements.com/api/search/`
**Method:** POST
**Body:** `{ "keyword": "birthday" }`
**Returns:** Top 50 SKUs matching the keyword, with metadata including product name, price, image URL, product URL, description, and other attributes.

### Build the API proxy (`src/app/api/search/route.ts`):

```typescript
// Proxy the Edible API to avoid CORS issues on the client
// Accept a keyword, call the Edible API, return cleaned results
// Handle errors gracefully — if the API is down, return a helpful error
// Add reasonable timeout (10 seconds)
// Log the keyword searched for debugging
```

### Build the API helper (`src/lib/edible-api.ts`):

```typescript
// searchProducts(keyword: string): Promise<Product[]>
// - Calls your proxy endpoint
// - Parses and normalizes the response
// - Returns clean Product[] objects
// - Handles empty results gracefully

// IMPORTANT: First, make a test call to the Edible API to understand the exact
// response schema. Inspect the JSON response and map it to your Product type.
// The response structure may include fields like:
// - product name/title
// - price (may be formatted as string or number)
// - image URL(s)  
// - product page URL
// - description/short description
// - category
// - availability
// - SKU/product ID

// If the API returns unexpected data or is unavailable, implement a fallback
// that returns a message to the user explaining the situation.
```

### Define types (`src/lib/types.ts`):

```typescript
export interface Product {
  id: string;
  name: string;
  price: number;
  priceFormatted: string;
  imageUrl: string;
  productUrl: string;
  description: string;
  category?: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  products?: Product[];        // Attached product recommendations
  quickReplies?: string[];     // Suggested next responses
}

export interface ConversationState {
  recipient?: string;
  occasion?: string;
  preferences?: string[];
  budget?: string;
  searchesPerformed: string[];
}
```

**CRITICAL:** Before building anything else, write a small test script that actually calls the Edible API with a few different keywords ("birthday", "chocolate", "thank you", "valentines", "sympathy", "fruit arrangement") and log the full response. Inspect the JSON schema carefully. Map every field you'll need. Document the actual response shape in DESIGN_DECISIONS.md.

**Log in DESIGN_DECISIONS.md**: The exact API response schema you discovered, which fields you chose to use and why, how you handle price formatting, image URL construction, and product URLs.

---

## STEP 3: System Prompt Design (THIS IS CRITICAL)

Create a modular, well-structured system prompt in `src/lib/system-prompt.ts`. This is one of the most heavily evaluated parts of the assessment.

The system prompt should have these clearly separated sections:

### Section 1: Role & Identity
```
You are the Edible Gift Concierge — a warm, knowledgeable gift advisor for 
Edible Arrangements. You help customers find the perfect edible gift for any 
occasion. Think of yourself as that one friend who always picks the PERFECT 
gift and makes it look effortless.
```

### Section 2: Core Rules (Anti-Hallucination)
```
ABSOLUTE RULES — NEVER BREAK THESE:
1. ONLY recommend products returned by the search_products tool. Never invent 
   product names, prices, descriptions, or URLs.
2. When presenting products, use the EXACT name, price, and URL from the API 
   response. Never modify or embellish product details.
3. If the search returns no results, say so honestly. Suggest broadening the 
   search or trying a different keyword. Never make up products.
4. Never make claims about delivery times, freshness guarantees, allergy safety, 
   or return policies. For these topics, direct users to ediblearrangements.com 
   or customer service.
5. Never claim a product contains or doesn't contain specific allergens unless 
   that information is explicitly in the product data.
6. You are a gift advisor, not a customer service agent. You cannot process 
   orders, handle complaints, or access account information.
```

### Section 3: Conversation Flow
```
Guide the conversation naturally through these stages. You don't have to be 
rigid — adapt to what the user tells you. If they provide multiple pieces of 
info at once, skip ahead.

STAGE 1 — UNDERSTAND THE GIFT CONTEXT:
- Who is the recipient? (partner, friend, family, coworker, client)
- What's the occasion? (birthday, Valentine's, thank you, sympathy, just because, etc.)

STAGE 2 — GATHER PREFERENCES:
- Any taste preferences? (chocolate lover, fruit-forward, mixed/variety)
- Any dietary concerns? (Note: defer to Edible's official info for allergy details)
- Budget range? (under $50, $50-$75, $75-$100, $100+)

STAGE 3 — SEARCH & RECOMMEND:
- Use the search_products tool with relevant keywords based on what you've learned
- You may call search_products MULTIPLE TIMES with different keywords to get 
  diverse results (e.g., "birthday chocolate" AND "birthday fruit arrangement")
- Select the TOP 3 products that best match the user's needs
- Present each with: name, price, a 1-2 sentence personalized reason why it's 
  a great fit for their specific situation
- Include the direct product URL for each recommendation

STAGE 4 — SUPPORT THE DECISION:
- After presenting options, step back. Say something like "Any of these would 
  make a wonderful gift!" Don't pressure.
- If they want to compare, help them understand differences
- If they want different options, search again with adjusted keywords
- If they're ready, provide the link and wish them well

WHEN TO STOP GUIDING:
- After presenting 3 curated recommendations, let the user lead
- Never hard-sell or create urgency ("buy now!", "limited time!")
- If the user seems decided, confirm their choice and provide the link
- If the user says thank you or goodbye, wrap up warmly
```

### Section 4: Tone & Voice
```
TONE GUIDELINES:
- Warm and friendly, like a knowledgeable friend — not a corporate bot
- Enthusiastic about the products without being salesy
- Concise — keep messages short and scannable. No walls of text.
- Use occasional emojis sparingly (🍓 🎂 🎉 💐) — max 1-2 per message
- Speak naturally: "Oh, that's a great occasion!" not "I understand you are 
  looking for birthday gifts."
- When presenting products, lead with WHY it's a good fit, not just what it is
- Be honest if you're unsure — "I'm not 100% sure about allergen details, 
  but you can check directly on their product page"
```

### Section 5: Edge Cases
```
HANDLING SPECIAL SITUATIONS:
- Off-topic questions: "I'm best at helping you find the perfect Edible gift! 
  For other questions, I'd recommend reaching out to Edible's customer service."
- Price complaints: Acknowledge, suggest the "Under $50" range, never apologize 
  for pricing
- Allergy concerns: Take seriously, recommend checking the product page or 
  contacting Edible directly. Note that products may contain peanuts/tree nuts.
- Competitor mentions: Stay positive about Edible, don't disparage competitors
- No results: "Hmm, I couldn't find an exact match for that. Let me try a 
  broader search..." then search with different keywords
- Vague requests ("I need a gift"): Ask ONE clarifying question at a time. 
  Start with the occasion.
```

### Section 6: Output Formatting
```
When presenting product recommendations, structure your response like this:

1. A brief personalized intro sentence connecting their needs to your picks
2. For each product (present 2-3):
   - **Product Name** — $Price
   - 1-2 sentence explanation of why this is great for their specific situation
   - [View on Edible →](product_url)
3. A brief closing that empowers their decision without pressuring

IMPORTANT: When you call the search_products tool, pass a relevant keyword 
or short phrase. Good examples: "birthday chocolate", "thank you fruit", 
"valentines strawberries", "sympathy basket", "corporate gift".
After receiving results, select the best 2-3 options — don't dump all 50 results.
```

**Export the system prompt as a function** that can accept dynamic context (like current date for seasonal awareness):

```typescript
export function getSystemPrompt(): string {
  const currentDate = new Date().toLocaleDateString('en-US', { 
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' 
  });
  
  return `
    [All sections above]
    
    TODAY'S DATE: ${currentDate}
    Use this for seasonal awareness. If Valentine's Day, Mother's Day, 
    or another holiday is approaching, you can mention it naturally.
  `;
}
```

**Log in DESIGN_DECISIONS.md**: Why each section exists, what anti-hallucination strategies you chose and why, how you decided on the conversation flow stages, why you chose this tone over alternatives (formal, casual, quirky), how you handle the tension between being helpful and not being pushy.

---

## STEP 4: Claude Tool Definitions

Create tool definitions in `src/lib/tools.ts`:

```typescript
// Define a search_products tool that Claude can call
// Parameters:
//   - keyword: string (required) — the search term to find products
//   - context: string (optional) — why the AI is searching (for logging)
//
// When Claude calls this tool:
// 1. Your route handler intercepts the tool call
// 2. Calls the Edible API proxy with the keyword
// 3. Returns the product results back to Claude
// 4. Claude then selects and presents the best options
//
// This is the RAG pattern: the AI can ONLY recommend products it has 
// actually retrieved from the live API. It cannot hallucinate products.
```

**Log in DESIGN_DECISIONS.md**: Why you chose tool use over hardcoded API calls, why a single tool vs multiple tools, how this prevents hallucination.

---

## STEP 5: Chat API Route

Build `src/app/api/chat/route.ts`:

```typescript
// This is the core orchestration endpoint
// 
// 1. Receive the conversation messages from the frontend
// 2. Send to Claude (Sonnet 4) with:
//    - System prompt from system-prompt.ts
//    - Tool definitions from tools.ts
//    - Full conversation history
// 3. Handle tool calls:
//    - When Claude wants to search products, execute the search
//    - Return results to Claude so it can formulate its response
// 4. Stream the response back to the frontend
//
// USE: Vercel AI SDK's streamText() for streaming responses
// MODEL: claude-sonnet-4-20250514 (best balance of quality/speed/cost)
//
// Error handling:
// - If Claude API fails: return a friendly error message
// - If tool execution fails: tell Claude the search failed, let it respond gracefully
// - Rate limiting: basic protection against abuse
```

**IMPORTANT:** Use the Vercel AI SDK (`ai` and `@ai-sdk/anthropic` packages) for clean streaming integration. The pattern is:

```typescript
import { anthropic } from '@ai-sdk/anthropic';
import { streamText, tool } from 'ai';
import { z } from 'zod';

export async function POST(req: Request) {
  const { messages } = await req.json();
  
  const result = streamText({
    model: anthropic('claude-sonnet-4-20250514'),
    system: getSystemPrompt(),
    messages,
    tools: {
      search_products: tool({
        description: 'Search the Edible Arrangements product catalog...',
        parameters: z.object({
          keyword: z.string().describe('Search keyword...'),
        }),
        execute: async ({ keyword }) => {
          // Call your Edible API proxy and return results
        },
      }),
    },
    maxSteps: 5, // Allow multiple tool calls in one turn
  });
  
  return result.toDataStreamResponse();
}
```

**Log in DESIGN_DECISIONS.md**: Why Claude Sonnet over Opus/Haiku, why streaming, why maxSteps: 5, why Vercel AI SDK over raw API calls.

---

## STEP 6: Frontend — Chat Interface

Build the main chat experience. This should feel premium, on-brand, and purpose-built — NOT like a generic chatbot.

### Design System & Brand

**Colors:**
- Primary Red: `#E10700` (Edible brand red)
- Dark: `#1A1A1A`
- Light background: `#FBF9F7` (warm off-white, not cold white)
- Card background: `#FFFFFF`
- Muted text: `#6B7280`
- Success/CTA: `#E10700` (brand red for buttons)
- AI message background: `#F3F4F6` (light gray)
- User message background: `#E10700` (brand red with white text)

**Typography:**
- Use a refined sans-serif font pairing. Import from Google Fonts:
  - Headings: `DM Sans` (700 weight) — modern, friendly, distinctive
  - Body: `DM Sans` (400, 500 weight)
  - Or alternatively: `Outfit` for a warmer feel
- Chat messages: 15-16px for readability
- Product card titles: 17-18px bold

**Layout:**
- Full-height centered chat interface (max-width 720px)
- Clean header with Edible branding
- Messages area with auto-scroll
- Fixed bottom input area with send button
- Product cards rendered inline within the chat flow
- Quick-reply buttons above the input area when available

### Component Details:

**`Header.tsx`**:
- Clean bar with "Edible Gift Concierge" title
- Small tagline: "Find the perfect gift, powered by AI"
- Edible brand red accent
- Subtle, minimal — don't overpower the chat

**`WelcomeScreen.tsx`**:
- Shown before any messages
- Warm greeting: "Hi there! 👋 I'm your Edible Gift Concierge"
- Brief description: "I'll help you find the perfect fruit arrangement, chocolate-dipped treats, or gift basket for any occasion."
- 3-4 starter quick-reply buttons:
  - "🎂 Shopping for a birthday"
  - "❤️ Valentine's Day gift"
  - "🙏 Thank you gift"
  - "🎁 Just browsing"

**`ChatInterface.tsx`**:
- Manages conversation state using `useChat` hook from Vercel AI SDK
- Renders message list, product cards, quick replies
- Handles sending messages and quick-reply clicks
- Auto-scrolls to latest message
- Shows typing indicator when AI is responding

**`MessageBubble.tsx`**:
- User messages: right-aligned, brand red background, white text, rounded corners
- AI messages: left-aligned, light gray background, dark text, rounded corners
- Support for markdown rendering in AI messages (bold, links)
- Smooth fade-in animation on new messages

**`ProductCard.tsx`**:
- Rendered inline in the chat when AI recommends products
- Shows: product image, name, price, short AI-generated reason
- "View on Edible →" button/link (opens in new tab)
- Clean card design with subtle shadow, rounded corners
- Hover effect on the card
- If image fails to load, show a branded placeholder
- Responsive — stacks nicely on mobile

**`QuickReplies.tsx`**:
- Horizontal scrollable row of pill-shaped buttons
- Shown above the input area when the AI suggests quick replies
- Clicking a quick reply sends it as a user message
- Disappear after one is clicked
- Smooth entrance animation

**`TypingIndicator.tsx`**:
- Three animated dots in an AI message bubble
- Shows while waiting for the AI response
- Clean, subtle animation

### Input Area:
- Text input with placeholder "Type your message..."
- Send button (brand red) with arrow icon
- Disabled while AI is responding
- Subtle border and shadow
- Pressing Enter sends the message

**Log in DESIGN_DECISIONS.md**: Why this layout pattern, font choices, color decisions, why quick-reply buttons (and how they solve the "don't know where to start" problem), mobile considerations, accessibility decisions.

---

## STEP 7: Smart Quick Replies System

The quick-reply system is a key differentiator. Implement logic to generate contextual quick replies based on the conversation state:

```typescript
// After the AI responds, parse the response to determine appropriate quick replies
// 
// Examples:
// - After greeting → ["🎂 Birthday gift", "❤️ Valentine's Day", "🙏 Thank you", "🎁 Just browsing"]
// - After asking about recipient → ["Partner/Spouse", "Friend", "Parent", "Coworker"]
// - After showing products → ["Show me more options", "Compare these", "Different price range", "Perfect, I'll go with one of these!"]
// - After asking about budget → ["Under $50", "$50-$75", "$75-$100", "$100+"]
//
// Strategy: Have Claude include quick reply suggestions in a structured way
// You can add to the system prompt:
// "At the end of each response, if appropriate, include suggested quick replies 
//  in this format: [[Quick Reply 1|Quick Reply 2|Quick Reply 3]]
//  These will be shown as clickable buttons to the user."
//
// Then parse the AI response to extract and render them.
```

**Alternative approach**: Use a separate lightweight function that looks at the conversation stage and returns appropriate quick replies without relying on the AI to generate them. This is more reliable.

**Log in DESIGN_DECISIONS.md**: Which quick reply strategy you chose and why, how you handle the parsing, edge cases.

---

## STEP 8: Error Handling & Edge Cases

Build robust error handling throughout:

### API Failures
- Edible API down → Show friendly message: "I'm having trouble searching the catalog right now. You can browse directly at ediblearrangements.com while I sort this out!"
- Claude API down → Show: "I'm taking a quick break — please try again in a moment!"
- Network timeout → Retry once, then show error

### Empty Results
- No products match → AI should try a broader keyword, then explain: "I couldn't find an exact match, but here are some similar options..."

### Input Validation
- Empty messages → Don't send
- Very long messages → Truncate at 500 chars with notice
- Rapid-fire messages → Disable input while AI responds

### Image Loading
- Product images fail → Show a clean branded placeholder (gradient with Edible colors + fruit emoji)
- Lazy load images for performance

**Log in DESIGN_DECISIONS.md**: Every error case you handle and the UX decision behind each.

---

## STEP 9: Polish & Micro-Interactions

Add these finishing touches that elevate the POC from "student project" to "professional prototype":

1. **Smooth scroll** to new messages
2. **Fade-in animation** on new messages (CSS `@keyframes` or Framer Motion)
3. **Hover effects** on product cards and buttons
4. **Focus management** — input auto-focuses after quick reply click
5. **Responsive design** — works beautifully on mobile (test at 375px width)
6. **Loading skeleton** for product cards while images load
7. **Subtle gradient** on the header or background for depth
8. **Keyboard support** — Enter to send, Escape to clear input
9. **Brand-consistent** empty states and transitions
10. **Accessibility** — proper ARIA labels on buttons, semantic HTML, sufficient color contrast

**Log in DESIGN_DECISIONS.md**: Which polish items you prioritized and why, what you'd add with more time.

---

## STEP 10: Testing Scenarios

After building, test these scenarios end-to-end and document results in DESIGN_DECISIONS.md:

### Scenario 1: Happy Path — Birthday Gift
```
User: "I need a birthday gift for my mom"
Expected: AI asks about preferences/budget → searches → presents 3 curated options
```

### Scenario 2: Vague Request
```
User: "I need a gift"
Expected: AI asks ONE clarifying question (occasion or recipient)
```

### Scenario 3: Specific Request
```
User: "I want chocolate covered strawberries under $50 for Valentine's Day"
Expected: AI searches immediately (enough info given) → presents matching options
```

### Scenario 4: No Results
```
User: "Do you have sushi arrangements?"
Expected: AI searches, gets no/poor results, explains honestly, suggests alternatives
```

### Scenario 5: Off-Topic
```
User: "What's the weather like?"
Expected: Friendly redirect to gift-finding purpose
```

### Scenario 6: Allergy Concern
```
User: "My friend has a nut allergy, is this safe?"
Expected: AI does NOT make safety claims. Directs to product page or customer service.
```

### Scenario 7: Comparison
```
User: "What's the difference between the first two options?"
Expected: AI compares based on real product data from the API response
```

### Scenario 8: Budget Sensitive
```
User: "These are too expensive, anything cheaper?"
Expected: AI searches for lower-price options without making the user feel bad
```

Document the actual AI responses for each scenario in DESIGN_DECISIONS.md.

---

## STEP 11: Environment & Deployment

### Environment Variables
Create `.env.local`:
```
ANTHROPIC_API_KEY=your_key_here
```

### README.md
Create a clean README with:
- Project overview (2-3 sentences)
- Setup instructions (install, env vars, run)
- Architecture overview
- Key design decisions (link to DESIGN_DECISIONS.md)
- Screenshots/demo

### Deployment
- Configure for Vercel deployment (`vercel.json` if needed)
- Ensure the Edible API proxy works in production (CORS, headers)
- Test deployed version

**Log in DESIGN_DECISIONS.md**: Deployment platform choice and reasoning.

---

## STEP 12: The DESIGN_DECISIONS.md File Structure

Organize the design decisions file with these sections:

```markdown
# Design Decisions — Edible AI Gift Concierge

## Architecture Decisions
### Why Next.js with App Router
### Why Vercel AI SDK  
### Why Server-Side API Proxy
### Project Structure Rationale

## AI & Prompt Engineering Decisions
### Model Selection (Claude Sonnet 4)
### System Prompt Architecture  
### Anti-Hallucination Strategy
### Tool Use Design (RAG Pattern)
### Conversation Flow Design
### When to Stop Guiding
### Handling Ambiguity

## UX & Design Decisions
### Gift-Giver First Design Philosophy
### Why Quick Reply Buttons
### Chat vs. Search vs. Wizard — Why Conversational
### Product Card Design
### Mobile-First Considerations
### Brand Alignment

## Business & Product Decisions
### Understanding the Edible Customer
### Why "Concierge" Not "Chatbot"
### How We Build Trust (No Hallucination, No Pressure)
### Handling Sensitive Situations (Allergies, Sympathy)

## Technical Trade-offs
### Streaming vs. Wait-for-Complete
### Single Tool vs. Multiple Tools
### Quick Reply Generation Strategy
### Error Handling Philosophy
### API Response Handling

## What I'd Improve for Production (Next Steps)
### Personalization & User Accounts
### Multi-Search Strategy
### Delivery/Zip Code Integration
### A/B Testing Framework
### Analytics & Conversion Tracking
### Cost Optimization
### Caching Strategy
### Accessibility Audit
### Internationalization
### Performance Optimization

## Test Results
### Scenario 1: Birthday Gift — [results]
### Scenario 2: Vague Request — [results]
### ... [all scenarios]

## API Response Schema
### Raw Response Example
### Fields Used and Why
### Fields Ignored and Why
```

---

## FINAL CHECKLIST

Before considering the project done, verify:

- [ ] App runs locally with `npm run dev`
- [ ] Chat interface loads with welcome screen and quick replies
- [ ] Typing a message sends it to Claude and gets a streamed response
- [ ] Claude can search the Edible API via tool use
- [ ] Product cards render inline with images, prices, and working links
- [ ] Quick replies work (clickable, send as message)
- [ ] All 8 test scenarios produce reasonable results
- [ ] Mobile responsive (test at 375px)
- [ ] Error states are handled gracefully
- [ ] No hardcoded product data — everything from live API
- [ ] DESIGN_DECISIONS.md is thorough (50+ entries)
- [ ] README.md is clean and professional
- [ ] Code is clean, typed, and well-organized
- [ ] The experience feels on-brand for Edible Arrangements
- [ ] Deployed and accessible via URL

---

## KEY REMINDERS

1. **This is a POC, not a production app.** Don't over-engineer with databases, auth, or caching. But DO make it polished and professional.
2. **The write-up matters as much as the code.** DESIGN_DECISIONS.md IS your write-up material.
3. **Business sense matters.** Every decision should trace back to: "Does this help a gift-giver find the right product confidently?"
4. **Anti-hallucination is non-negotiable.** The AI must NEVER make up products or claims. Tool use + strict prompting is your defense.
5. **Brand alignment matters.** Use Edible's colors, be warm and friendly, don't make it look like a generic chatbot template.
6. **Quality > Quantity.** A polished experience with 3 good features beats a rough experience with 10 features.

Now build it. Start with Step 1 and work through sequentially. Log every decision in DESIGN_DECISIONS.md as you go. Make something you'd be proud to demo in a technical interview.
