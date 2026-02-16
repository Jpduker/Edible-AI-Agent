# Design Decisions — Edible AI Gift Concierge

> A comprehensive record of every design, architectural, and business decision made during development — and the reasoning behind each one.

---

## Architecture Decisions

### 1. Why Next.js 16 with App Router
**Decision**: Next.js 16+ with the App Router over alternatives like Create React App, Vite, or Remix.

**Reasoning**: Next.js provides server-side API routes (eliminating the need for a separate backend), native streaming support via the Web Streams API, and first-class Vercel deployment. The App Router's server components give us a secure place to keep the Anthropic API key server-side while maintaining React's component model.

**Alternatives Considered**: Vite + Express (more setup, separate deployment concerns), Remix (less community tooling for AI streaming).

### 2. Why Vercel AI SDK v6
**Decision**: Use the `ai` package (v6.0.86) with `@ai-sdk/anthropic` and `@ai-sdk/react`.

**Reasoning**: The Vercel AI SDK provides a first-class abstraction for streaming LLM responses to the UI. It handles chunked transfer encoding, tool call round-trips, and message state management — eliminating hundreds of lines of boilerplate. The v6 API uses `UIMessage` with parts-based composition, `DefaultChatTransport`, and `sendMessage()` for a cleaner separation of concerns.

**Trade-off**: Tight coupling to Vercel's SDK. If Vercel deprecates or pivots, migration is required. Worth it for POC velocity and quality.

### 3. Why Server-Side API Proxy
**Decision**: Proxy all Edible API calls through `/api/search` instead of calling from the client.

**Reasoning**: 
- **CORS**: The Edible API doesn't allow cross-origin requests from browsers
- **Security**: Server-side calls hide the request patterns and any future auth tokens
- **Reliability**: We can add caching, retry logic, and rate limiting at the proxy layer
- **Normalization**: Raw API responses are cleaned/normalized before reaching Claude or the UI

### 4. Project Structure Rationale
```
src/
├── app/
│   ├── api/chat/     → AI orchestration endpoint
│   ├── api/search/   → Edible API proxy
│   ├── page.tsx      → Main page composition
│   ├── layout.tsx    → Root layout + SEO
│   └── globals.css   → Design system
├── components/       → UI components
│   ├── ChatInterface.tsx
│   ├── MessageBubble.tsx
│   ├── ProductCard.tsx
│   ├── QuickReplies.tsx
│   ├── TypingIndicator.tsx
│   ├── WelcomeScreen.tsx
│   └── Header.tsx
└── lib/              → Shared logic
    ├── edible-api.ts  → API client + normalization
    ├── system-prompt.ts → Claude's persona/rules
    ├── tools.ts       → Tool schemas
    └── types.ts       → TypeScript interfaces
```

**Principle**: Clear separation between API routes (server), UI components (client), and shared logic (lib). Each component is a single file for easy review and iteration.

---

## AI & Prompt Engineering Decisions

### 5. Model Selection: Claude Sonnet 4 (claude-sonnet-4-20250514)
**Decision**: Use Claude Sonnet 4 over Haiku, Opus, or GPT-4o.

**Reasoning**: Sonnet 4 strikes the optimal balance for this use case:
- **Quality**: Superior instruction-following and natural conversation tone
- **Speed**: Sub-second first-token latency for streaming
- **Cost**: ~$3/$15 per million tokens (in/out) — sustainable for a POC
- **Tool Use**: Excellent at deciding WHEN to search and crafting good keywords

**Why Not Opus**: 3-5x more expensive, slower responses, marginal quality improvement for a gift search use case.
**Why Not Haiku**: Too terse, misses conversational warmth the brand needs.

### 6. System Prompt Architecture — 6-Section Design
**Decision**: Structure the system prompt into 6 explicit sections with visual separators.

**Sections**:
1. **Role Definition**: "You are the Edible Gift Concierge" — warm, knowledgeable, zero-pressure
2. **Absolute Rules**: Anti-hallucination guardrails (NEVER invent products)
3. **Conversation Flow**: 4-stage progression (open → narrow → search → present)
4. **Tone Guidelines**: Warm, concise, tasteful food puns, never salesy
5. **Edge Cases**: Allergies, sympathy, off-topic, competitor mentions
6. **Output Format**: Markdown with embedded quick reply format

**Reasoning**: Claude performs best with explicit structure. The visual separators (`═══`) help the model identify section boundaries, reducing drift. Each section is independently testable and modifiable.

### 7. Anti-Hallucination Strategy
**Decision**: Zero-tolerance policy for fabricated products. Three layers of defense:

1. **System Prompt Rule**: "NEVER mention specific products, prices, or URLs unless returned by the search tool"
2. **Tool Design**: The `search_products` tool is the ONLY way to reference real products
3. **Result Validation**: Only products returned by the live API are shown to users

**Why This Matters**: A hallucinated product with a fake price or URL would destroy user trust instantly. For an e-commerce assistant, accuracy isn't just nice-to-have — it's the entire value proposition.

### 8. Tool Use Design — RAG Pattern
**Decision**: Single `search_products` tool with keyword-based search + Claude as the reasoning layer.

**How It Works**:
1. User describes what they want ("birthday gift for mom")
2. Claude generates optimal search keywords ("birthday fruit arrangement mother")
3. Tool fetches live products from Edible API
4. Claude curates and presents the best matches with personalized reasoning

**Why Single Tool**: Multiple tools (search, filter, sort, details) would add complexity without proportional value. Claude can call search multiple times with different keywords to get diverse results via `stopWhen: stepCountIs(5)`.

### 9. Conversation Flow Design — 4 Stages
**Stage 1**: Open probe — "Who are you shopping for?"
**Stage 2**: Narrow down — occasion, budget, preferences
**Stage 3**: Search — tool call with optimized keywords
**Stage 4**: Present — curated recommendations with reasoning

**Design Principle**: Never jump to product recommendations on the first message. A brief qualifying conversation builds trust and improves recommendation quality. But we also don't force a rigid wizard — if the user says "I want chocolate strawberries under $50", we skip straight to search.

### 10. When to Stop Guiding
**Decision**: Claude stops asking questions after 2-3 exchanges maximum.

**Reasoning**: The user came here to find a gift, not answer a survey. If we have enough signal (recipient + occasion OR product type), we search immediately. Over-qualifying feels like a bad customer service call.

### 11. Handling Ambiguity
**Decision**: When the user is vague, search broadly and let the results inspire specificity.

**Example**: "I need a gift" → Claude asks ONE question (recipient/occasion), then searches. If results come back, Claude presents them with context. The products themselves help the user narrow down.

### 12. Dynamic Date Injection
**Decision**: Inject `TODAY'S DATE: ${currentDate}` into the system prompt.

**Reasoning**: Seasonality is critical for gift shopping. If it's February, Claude should proactively suggest Valentine's options. If it's near Christmas, holiday arrangements make sense. Without the date, Claude can't make seasonal recommendations.

---

## UX & Design Decisions

### 13. Gift-Giver First Design Philosophy
**Decision**: Every UI element is designed from the gift-giver's perspective, not the gift-recipient's.

**Implication**: The welcome screen says "I'll help YOU find the perfect gift" — not "Browse our products." Quick replies are occasion-based ("Shopping for a birthday"), not product-based ("View chocolate strawberries").

### 14. Why Quick Reply Buttons
**Decision**: Show 3-4 contextual quick replies after each AI message.

**Reasoning**: Quick replies reduce typing friction (especially on mobile) and guide users who don't know what to ask. They're parsed from the AI response using the `[[Reply 1|Reply 2|Reply 3]]` format, making them contextually relevant to the conversation.

**Format Choice**: The `[[...]]` format was chosen because it's easy for Claude to generate, easy to parse with regex, and unlikely to appear in natural language.

### 15. Chat vs. Search vs. Wizard — Why Conversational
**Decision**: Full conversational interface over search bar or multi-step wizard.

**Reasoning**:
- **Search**: Requires the user to know what they want. Poor for "I need a gift" use cases
- **Wizard**: Rigid, can't handle edge cases, feels like a form
- **Chat**: Natural, flexible, handles ambiguity, builds rapport, and can seamlessly pivot between browsing and specificity

### 16. Product Card Design
**Decision**: Compact cards with image, name, price, and a CTA link.

**Design Choices**:
- **Lazy-loaded images**: Performance optimization, especially with 3-6 product images per response
- **Shimmer loading state**: Visual polish while images load
- **Fallback emoji (🍓)**: If an image fails to load, show a branded placeholder instead of a broken image icon
- **"View on edible.com" CTA**: Opens in new tab. We don't process orders — we guide users to the real site

### 17. Mobile-First Considerations
**Decision**: CSS responsive design with flexbox/grid, touch-friendly targets.

**Key Mobile Choices**:
- Quick reply buttons scroll horizontally on small screens
- Input area is always visible (sticky footer pattern)
- Product cards stack vertically on mobile, grid on desktop
- Touch targets are minimum 44x44px

### 18. Brand Alignment — Color & Typography
**Decision**: Edible Arrangements brand red (`#E10700`) as primary, DM Sans font.

**Color System**:
- Primary: `#E10700` (Edible Red)
- Background: `#F5F0EB` (warm off-white, not stark white)
- Card background: `#FFFFFF`
- Text: `#2D2926` (warm near-black)
- Muted: `#7B7B7B`

**Why DM Sans**: Clean, modern geometric sans-serif that pairs well with warm brand colors. Free via Google Fonts. Professional without being corporate.

### 19. Animation Strategy
**Decision**: Subtle entrance animations on messages and cards, typing indicator with bouncing dots.

**Animations Used**: `fadeInUp`, `slideInLeft` (AI), `slideInRight` (user), `scaleIn` (cards), `shimmer` (loading), `bounce` (typing).

**Philosophy**: Animations should feel alive and responsive, never distracting. Each animation is under 300ms and uses ease-out curves for natural movement.

---

## Business & Product Decisions

### 20. Understanding the Edible Customer
**Key Insight**: Edible Arrangements customers are _giving_ a gift, not buying for themselves. They need:
- Confidence ("Is this a good gift?")
- Speed ("I need something by Friday")
- Guidance ("I don't know what they'd like")

**Design Impact**: The AI provides reassurance ("Great choice!"), mentions delivery context, and proactively asks about dietary restrictions.

### 21. Why "Concierge" Not "Chatbot"
**Decision**: Brand as "Gift Concierge" in all copy.

**Reasoning**: "Chatbot" implies a basic Q&A tool. "Concierge" implies personalized, high-touch service. This aligns with Edible's premium positioning and sets user expectations for a quality experience.

### 22. How We Build Trust
**Three Trust Pillars**:
1. **No Hallucination**: Every product shown comes from a live API search
2. **No Pressure**: Claude never says "Buy now!" or creates false urgency
3. **Transparency**: "I'd recommend checking edible.com for real-time availability" — honesty about our limitations

### 23. Handling Sensitive Situations
**Allergies**: "I'd recommend contacting Edible directly at 1-877-DO-FRUIT for specific allergen information."
**Sympathy**: "I'm sorry for your loss. Here are some thoughtful sympathy arrangements..." — warm, understated, no food puns.
**Competitors**: If someone asks about a competitor, acknowledge politely and redirect: "I specialize in Edible Arrangements! Let me find something great for you."

---

## Technical Trade-offs

### 24. Streaming vs. Wait-for-Complete
**Decision**: Stream responses token-by-token using `streamText()` and `toUIMessageStreamResponse()`.

**Reasoning**: Streaming reduces perceived latency by 60-80%. Users see the AI "typing" within 500ms instead of waiting 3-5 seconds for a complete response. For a conversational interface, this is non-negotiable for a quality UX.

### 25. Single Tool vs. Multiple Tools
**Decision**: One `search_products` tool, with `stopWhen: stepCountIs(5)` for multi-step capability.

**Why Not Multiple Tools**:
- `get_product_details`: Not needed — search results include all necessary info
- `filter_products`: Claude can filter in context based on the search results
- `get_categories`: Would add latency for minimal UX gain

**If We Added More**: A delivery-check tool (zip code → delivery availability) would be highest value.

### 26. Quick Reply Generation Strategy
**Decision**: Claude embeds quick replies in its text response using `[[Reply 1|Reply 2|Reply 3]]` format.

**Parsing**: Regex extraction from the end of each AI text response.

**Alternative Considered**: Separate tool for generating quick replies. Rejected because it adds an extra tool call round-trip and the inline format is simpler and faster.

### 27. Error Handling Philosophy
**Decision**: Graceful degradation with branded error messages.

**Layers**:
1. **API Proxy**: 10-second timeout, returns friendly error if Edible API is down
2. **Tool Execution**: Returns `{ success: false, message: "..." }` — Claude can inform the user naturally
3. **Chat Route**: Rate limiting (20 req/min), input validation, catch-all error response
4. **UI**: Error toast with strawberry emoji 🍓 — stays on-brand even when things break

### 28. API Response Normalization
**Decision**: Transform raw Edible API responses into a clean `Product` interface.

**Fields Used**: `name`, `minPrice`, `image`, `description`, `routeUrl`, `category`, `occasion`
**Fields Ignored**: `maxPrice`, `discount`, `rating`, `availability` — not available in search results or not reliable
**Constructed**: `productUrl` (full URL from `routeUrl`), `priceFormatted` (from `minPrice`)

### 29. Rate Limiting Strategy
**Decision**: Simple in-memory IP-based rate limiting (20 requests per minute).

**Why In-Memory**: POC doesn't need Redis/distributed rate limiting. In-memory works fine for a single instance.

**Trade-off**: Resets on server restart. Not suitable for production at scale.

### 30. AI SDK v6 Migration
**Decision**: Build with AI SDK v6 (latest), not v3/v4 which most tutorials reference.

**Key API Differences from v3/v4**:
- `inputSchema` instead of `parameters` for tool definitions
- `stopWhen: stepCountIs(N)` instead of `maxSteps: N`
- `toUIMessageStreamResponse()` instead of `toDataStreamResponse()`
- `sendMessage({ text })` instead of `handleSubmit`
- `status` ('submitted' | 'streaming' | 'ready' | 'error') instead of `isLoading`
- `DefaultChatTransport` instead of `api` string
- `onFinish({ message })` instead of `onFinish(message)`
- UIMessage uses `parts` array, no `content` string

---

## What I'd Improve for Production (Next Steps)

### 31. Personalization & User Accounts
Add user authentication to remember past purchases, favorite recipients, and preference patterns. "Last time you sent chocolate strawberries to Sarah — would you like to send something similar?"

### 32. Multi-Search Strategy
Instead of a single search, execute 2-3 parallel searches with different keyword strategies to improve result diversity. E.g., for "birthday gift", search "birthday", "birthday fruit", and "birthday chocolate" simultaneously.

### 33. Delivery/Zip Code Integration
Add a delivery availability tool to check if a product can be delivered to a specific address by a given date. This is the #1 missing feature for actual conversion.

### 34. A/B Testing Framework
Test different system prompt variations, quick reply strategies, and product card layouts to optimize conversion rates.

### 35. Analytics & Conversion Tracking
Track: search queries, products viewed, CTA clicks, conversation length, and drop-off points. Use this data to improve prompt quality and product recommendations.

### 36. Cost Optimization
- Cache frequent searches (TTL: 5 minutes)
- Use Haiku for simple follow-up questions (price inquiries, delivery questions)
- Implement token budgets per conversation

### 37. Caching Strategy
Redis-based caching for product searches with a 5-minute TTL. Edible's catalog doesn't change minute-to-minute, so moderate caching is safe and significantly reduces API calls.

### 38. Accessibility Audit
Full WCAG 2.1 AA compliance: proper ARIA labels, keyboard navigation, screen reader support, high contrast mode, and reduced motion preferences.

### 39. Internationalization
Multi-language support for Edible's international markets. The system prompt and quick replies would need localization.

### 40. Performance Optimization
- Image optimization with Next.js Image component and CDN
- Code splitting for chat components (lazy load product cards)
- Service worker for offline welcome screen

---

## API Response Schema

### Raw Response Example
```json
{
  "id": "12345",
  "name": "Chocolate Dipped Strawberries",
  "number": "SKU-001",
  "minPrice": 29.99,
  "maxPrice": 49.99,
  "image": "https://resources.ediblearrangements.com/...",
  "thumbnail": "https://resources.ediblearrangements.com/...",
  "description": "Juicy strawberries dipped in...",
  "routeUrl": "/product/12345",
  "category": "Chocolate",
  "occasion": "Birthday",
  "isLive": true
}
```

### Fields Used and Why
| Field | Used As | Reasoning |
|-------|---------|-----------|
| `name` | Product title | Primary identifier for the user |
| `minPrice` | Display price | "Starting at" is most useful for gift shoppers |
| `image` | Product photo | Visual is critical for gift confidence |
| `description` | Brief text | Helps Claude reason about relevance |
| `routeUrl` | Product link | Direct path to purchase on edible.com |
| `category` | Filter hint | Helps Claude match to user preferences |
| `occasion` | Context | Seasonal/occasion relevance |

### Fields Ignored and Why
| Field | Reason Ignored |
|-------|---------------|
| `maxPrice` | Confusing with min price; "starting at" is cleaner |
| `discount` | Not reliably present; could show stale promotions |
| `rating` | Not available in search results |
| `availability` | Would require zip code; out of scope for POC |

---

## UX Microdetails

### 41. Input Character Limit (500)
Prevents prompt injection attempts and ensures Claude gets focused input. Counter appears at 400+ characters.

### 42. Escape Key Clears Input
Power-user shortcut for quick input reset.

### 43. Smooth Auto-Scroll
Messages area scrolls to bottom on new messages with `behavior: 'smooth'`. Keeps the latest response visible without jarring jumps.

### 44. Send Button Disabled States
Button is disabled when: (a) input is empty, (b) message is loading. Prevents double-sends and empty submissions.

### 45. Focus Management
After sending a message or clicking a quick reply, the input field regains focus automatically.

### 46. Image Lazy Loading
Product images use native `loading="lazy"` for browsers that support it. Combined with shimmer loading states for a polished loading experience.

### 47. Error Recovery
Error messages are inline (not modal) and stay on-brand with the strawberry emoji. Users can immediately retry without page refresh.

### 48. Typing Indicator Animation
Three dots with staggered `bounce` animation (0s, 0.1s, 0.2s delay). Creates a natural "thinking" effect while Claude streams its response.

### 49. Message Alignment Convention
User messages: right-aligned, red background (brand color)
AI messages: left-aligned, off-white background
This follows the universal messaging app convention (iMessage, WhatsApp).

### 50. Welcome Screen Information Hierarchy
1. Brand icon (visual anchor)
2. Greeting ("Hi there! 👋") — warm, personal
3. Role description — sets expectations
4. Quick reply buttons — reduces blank-page anxiety
5. Helper text — guides without overwhelming

---

*Document maintained throughout development. Each decision traces back to: "Does this help a gift-giver find the right product confidently?"*
