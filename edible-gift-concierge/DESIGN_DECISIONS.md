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
- ~~Cache frequent searches (TTL: 5 minutes)~~ → **Implemented** (Decision #51 — 2-min TTL in-memory cache)
- Use Haiku for simple follow-up questions (price inquiries, delivery questions)
- ~~Implement token budgets per conversation~~ → **Implemented** (Decision #54 — 80K token conversation window)

### 37. Caching Strategy
~~Redis-based caching for product searches with a 5-minute TTL.~~ → **Partially Implemented** (Decision #51 — In-memory Map cache with 2-min TTL. Redis upgrade for production.)

### 38. Accessibility Audit
~~Full WCAG 2.1 AA compliance: proper ARIA labels, keyboard navigation, screen reader support, high contrast mode, and reduced motion preferences.~~ → **Partially Implemented** (Decision #59 — ARIA roles, labels, and live regions added. Full audit still recommended for production.)

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

---

## Phase 2 Engineering Improvements

### 51. In-Memory Search Cache (2-Minute TTL)
**Decision**: Cache product search results server-side in a `Map` with 2-minute TTL and 100-entry cap.

**Reasoning**: Edible's catalog doesn't change minute-to-minute. When Claude makes multiple tool calls for the same keyword (e.g., refining results), caching avoids redundant API calls, reduces latency by ~200-400ms per cache hit, and is kind to the upstream API. The 2-minute window is short enough to stay fresh while covering multi-turn conversations. LRU eviction when the map exceeds 100 entries prevents unbounded memory growth.

**Trade-off**: In-memory cache is per-process — not shared across serverless instances. Acceptable for a POC; production would use Redis.

### 52. Prompt Versioning
**Decision**: Export `SYSTEM_PROMPT_VERSION` from `system-prompt.ts` and include it in every structured log entry.

**Reasoning**: When iterating on a system prompt, you need to correlate behavioral changes with prompt revisions. Tagging every log entry with the prompt version makes it trivial to A/B test prompts or diagnose regressions. This is a lightweight observability pattern borrowed from ML model versioning.

### 53. Structured JSON Logging
**Decision**: Replace ad-hoc `console.log` strings with a `log(level, event, data)` function that outputs structured JSON entries.

**Reasoning**: Structured logs are queryable, parseable, and production-ready. Each entry includes: timestamp, level (info/warn/error), event name, prompt version, and arbitrary data. This enables log aggregation (Datadog, CloudWatch, etc.) without post-processing. Events logged: `chat_request`, `tool_call`, `tool_result`, `tool_error`, `response_complete`, `conversation_trimmed`, `unhandled_error`.

### 54. Conversation Window Management
**Decision**: Estimate token usage (~4 chars/token) and trim conversations exceeding 80K tokens by removing middle messages while keeping the first message (initial intent) and the last 60% of messages.

**Reasoning**: Claude Sonnet's 200K context window is generous, but sending unnecessary history wastes tokens (money) and can degrade response quality. The "keep bookends" strategy preserves the user's original intent and recent context — the two most important parts of a conversation. The 80K threshold leaves ample room for the system prompt (~4K tokens), tool results, and the response.

### 55. Dynamic Spin the Wheel
**Decision**: Fetch live products from the search API when the Spin the Wheel modal opens, with hardcoded fallbacks and a "Shuffle products" button.

**Reasoning**: A static wheel is a novelty once; a dynamic wheel that shows real, available products every time is a genuine discovery tool. Products are fetched with random search terms ("popular gifts", "best sellers", "chocolate strawberries", etc.) and randomly sampled to create variety. The fallback products ensure the feature works even if the API is down. Auto-generated short labels (`makeShortName()`) keep the wheel readable regardless of product name length.

### 56. Markdown List Rendering
**Decision**: Enhanced `MessageBubble.parseContent()` to detect and render unordered (`- item`, `• item`) and ordered (`1. item`) lists as proper HTML `<ul>` and `<ol>` elements.

**Reasoning**: Claude naturally produces markdown lists when presenting product comparisons or feature breakdowns. Rendering these as plain text with bullet characters looks unprofessional. Proper list rendering with `list-disc`, `list-inside`, and `space-y-1` classes creates visual hierarchy that matches user expectations from modern chat interfaces.

### 57. Tool Constants Centralization
**Decision**: Moved tool descriptions and magic numbers (`MAX_TOOL_STEPS`, `MAX_PRODUCTS_PER_SEARCH`, `MAX_PRODUCTS_PER_SIMILARITY`) into `tools.ts` as named exports, imported by `route.ts`.

**Reasoning**: The original `tools.ts` had dead code — schemas defined but never imported. Rather than delete the file, it now serves as a single source of truth for tool configuration. This removes duplication, makes it easy to tune limits without hunting through the route handler, and keeps the route file focused on orchestration logic.

### 58. Response Quality Validation
**Decision**: Added an `onFinish` callback to `streamText()` that analyzes the completed response for quality signals: presence of quick replies, product mentions, word count, tool call count, and step count.

**Reasoning**: The system prompt instructs Claude to end responses with `[[Quick Reply 1|Quick Reply 2]]` format, but compliance isn't guaranteed. Logging when quick replies are missing (on substantive responses) creates a feedback signal for prompt engineering. Product mention detection (`**Name** — $Price`) validates that tool results are being properly synthesized into the response. This is lightweight runtime validation — not blocking, just observing.

### 59. ARIA Accessibility
**Decision**: Added `role="log"` and `aria-live="polite"` to the messages container, `role="region"` with labels to content areas, `aria-label` to interactive elements, and `aria-busy` to the typing indicator.

**Reasoning**: Chat interfaces are notoriously inaccessible. `role="log"` tells screen readers this is a message history. `aria-live="polite"` announces new messages without interrupting the user's current task. These are low-effort, high-impact accessibility wins that move toward WCAG 2.1 AA compliance.

---

## Phase 3 — Big Tech-Inspired Decision Support Features

### 60. Gift Context Sidebar (Notion AI / Google Flights)
**Decision**: Built a real-time Gift Planner sidebar that auto-detects recipient, occasion, budget, preferences, dietary needs, delivery ZIP, and gift tone from user messages using client-side NLP heuristics.

**Reasoning**: Big tech products (Google Flights, Notion, Kayak) show users what the system "understands" in a persistent sidebar. This serves three critical purposes:
1. **Trust**: Users see the AI isn't a black box — it's extracting structured understanding from natural language
2. **Error Correction**: If the sidebar shows "Budget: Under $50" but the user meant $75, they instantly see the mismatch
3. **Decision Support**: Seeing all criteria in one place helps users think more clearly about what they want

**Architecture**: `gift-context-extractor.ts` uses regex-based pattern matching across 6 categories (recipient, occasion, budget, preferences, dietary, tone) with 50+ patterns. Context is computed via `useMemo` on user messages for performance. The sidebar uses tabbed navigation (Context / Products) with a completeness progress bar.

**Inspired by**: Google Flights' search criteria panel, Notion AI sidebar, Kayak's filter panel.

### 61. Budget Progress Visualization (Mint / Personal Finance Apps)
**Decision**: Added a visual budget progress bar inside the Gift Context Sidebar that shows how recommended products relate to the stated budget. Green segments = in budget, amber = over budget.

**Reasoning**: Budget is the #1 constraint in gift purchasing. Personal finance apps (Mint, YNAB) proved that visualizing spending relative to a budget is more effective than raw numbers. Seeing 6 green bars and 2 amber bars instantly communicates "most options work for you" without reading prices. This is a micro-interaction that reduces cognitive load during decision-making.

**Trade-off**: The per-segment bars only show the most recent 8 products. In long conversations with many recommendations, this could be misleading. Acceptable for POC — production would show all products with scrolling.

### 62. Gift Message Composer (Hallmark AI / Google Smart Compose)
**Decision**: Built an AI-powered gift card message writer that generates 3 personalized messages based on the detected occasion, recipient, and user-selected tone (warm, funny, romantic, professional, heartfelt). Includes a "Write Your Own" tab with direct editing.

**Reasoning**: The gifting journey doesn't end at product selection — writing the card message is often the hardest part. By completing this "last mile," we increase the likelihood of conversion and create a differentiated experience. No other edible gift site offers AI-assisted card writing. The 5 tone options correspond to the most common emotional registers in gift-giving.

**Architecture**: Primary path calls the chat API with a specialized prompt for generating 3 numbered messages. Fallback uses curated, occasion-specific message templates when the API is unavailable. Copy-to-clipboard with visual feedback. The composer receives the detected `GiftContext` to auto-personalize output.

**Inspired by**: Hallmark's card message generator, Gmail's Smart Compose, ChatGPT's tone adjustment.

### 63. Product Favorites / Wishlist (Pinterest / Airbnb)
**Decision**: Added a "Save" (heart) button on each product card that adds products to an in-session favorites list. Favorited products persist through the conversation and are visually indicated on cards.

**Reasoning**: Pinterest and Airbnb proved that saving items for later comparison reduces decision paralysis. In a chat interface, products scroll past quickly and can be hard to find again. The favorites list creates a persistent "short list" that the user builds throughout the conversation. Combined with the Gift Context Sidebar's Products tab, users can see all recommended products in one place with price ranges and budget indicators.

**Inspired by**: Pinterest boards, Airbnb wishlists, Instagram saves.

### 64. Products Tab in Sidebar (Amazon Recently Viewed)
**Decision**: The Gift Context Sidebar includes a "Products" tab that shows all unique products recommended across the entire conversation, with mini-cards showing thumbnail, name, price, and quick status badges (Same Day delivery, Over Budget).

**Reasoning**: In a multi-turn conversation, the user may have seen 10-15 products across different searches. Without a unified view, they'd have to scroll through the chat history to find "that one product from earlier." The Products tab deduplicates by product ID and shows a compact, linked list with price range summary. This is an information architecture improvement that turns a linear chat into a browsable catalog.

**Technical Detail**: Product deduplication uses a `Set<string>` keyed by product ID, extracted via `useMemo` across all conversation messages. Only unique products are tracked, preventing duplicates from multiple searches returning the same item.

**Inspired by**: Amazon's "Recently Viewed" sidebar, Google Shopping's saved items.

### 65. Context-Aware System Prompt (Prompt v1.1)
**Decision**: Updated the system prompt to version v1.1 with a new `CONTEXT-AWARE GIFTING` section that instructs Claude to phrase questions in ways that help the client-side context extractor work better, and to mention the Gift Message Composer when users are ready to order.

**Reasoning**: The sidebar's context extraction relies on users naturally mentioning details like "for my mom" or "under $50." By tuning the system prompt to ask questions in extractable ways ("Who's the lucky recipient?" over "Tell me more"), we improve the accuracy of the NLP pipeline without adding complexity. This is a lightweight example of prompt-UI co-design — the prompt adapts to complement the frontend's capabilities.

### 66. Client-Side NLP Pattern Engine
**Decision**: Built a 50+ pattern regex engine in `gift-context-extractor.ts` that extracts structured data from unstructured user messages. Categories: recipients (19 patterns), occasions (18 patterns), budgets (9 patterns), preferences (12 patterns), dietary needs (8 patterns), tones (6 patterns), ZIP codes, and recipient names.

**Reasoning**: While we could have Claude extract this context server-side (and include it in the response), client-side extraction has three advantages:
1. **Zero latency**: Context updates instantly as messages arrive, no API call needed
2. **Zero cost**: No additional tokens consumed for context extraction
3. **Privacy**: User data is analyzed locally, never sent to a separate extraction endpoint

The 50+ regex patterns cover the most common ways people describe gift recipients, occasions, and constraints in natural English. The engine uses last-mentioned budget (most refined), cumulative preferences, and first-matched recipient/occasion for accuracy.

**Trade-off**: Regex can't handle ambiguous or creative language as well as an LLM. "Something for the person who has everything" wouldn't match any recipient pattern. Acceptable for POC — production could layer an LLM extraction pass as a fallback.

### 67. Favorites Drawer with localStorage Persistence
**Decision**: Created a dedicated `FavoritesDrawer.tsx` slide-out panel that displays all saved products, with localStorage persistence so favorites survive page refreshes and browser restarts.

**Reasoning**: The original Save (heart) button stored favorites in React state but provided no way to view them — a broken feature. The drawer adds: thumbnail + name + price for each saved item, per-item actions (Buy, Write Card, Copy Link, Remove), total value calculator, and a "Share My Gift List" button that uses the Web Share API (or clipboard fallback). localStorage persistence makes the feature production-ready; gift-shopping often spans multiple sessions.

**Inspired by**: Pinterest boards, Airbnb wishlists, IKEA shopping lists.

### 68. Surfacing Hidden API Data (Allergy, Ingredients, Size Variants)
**Decision**: Extended the `Product` interface with three fields already returned by the Edible API but previously discarded: `allergyInfo` (from `allergyinformation`), `ingredients` (from `ingrediantNames`), and `sizeCount`.

**Reasoning**: We were fetching this data in every API call and throwing it away during normalization. This is free, high-value information:
- **allergyInfo**: Critical for dietary safety — users with nut allergies, gluten sensitivity, etc. can see an "Allergy Info" badge with full details on hover
- **ingredients**: Shows first 3 ingredients as a green badge, full list on hover — helps users quickly assess what's inside
- **sizeCount**: Shows "X sizes" badge when a product has multiple size options — signals value flexibility to budget-conscious users

Data now flows: Edible API → normalizeProduct → tool results → Claude (for AI-powered allergy guidance) → ProductCard UI badges.

**Trade-off**: Ingredient data quality depends on the Edible API. Some products return empty strings. We conditionally render badges only when data exists, gracefully degrading.

### 69. Edible Domain Knowledge in System Prompt (v1.2)
**Decision**: Added a comprehensive `PRODUCT KNOWLEDGE & ALLERGY GUIDANCE` section to the system prompt with curated Edible Arrangements expertise: freshness guarantees, storage tips, delivery windows, customization options, corporate gifting, price ranges, and contact info.

**Reasoning**: Since the Edible website doesn't expose customer reviews or ratings via their API, we can't scrape and present social proof. Instead, we embedded verified domain knowledge directly into the prompt so Claude acts as a genuine product expert — answering questions about freshness ("Are the strawberries fresh?"), storage ("How long does it last?"), delivery ("Can I get it today?"), and sizing ("Does it come in a smaller size?") with accurate, helpful information rather than generic responses.

**Why not scrape reviews?**: Investigation showed that Edible Arrangements product pages do not contain a reviews/ratings section. The product URLs redirect to category listing pages rather than individual product detail pages. No review API endpoints were found. The domain knowledge approach is more reliable and doesn't risk scraping issues.

### 70. Allergy-Aware AI Recommendations
**Decision**: Updated Claude's system prompt to instruct it to proactively check `allergyInfo` and `ingredients` in tool results, flag allergens when users mention dietary needs, reference specific product data, and always caveat with "double-check on the product page."

**Reasoning**: This turns the chatbot into a dietary-aware assistant — a feature most e-commerce chatbots lack. When a user says "my mom has a nut allergy," Claude can now scan search results and highlight which products are safe vs. risky based on actual product data, rather than giving generic "check the website" responses. The caveat protects against data staleness.

---

## Phase 4 — UX Polish, Observability & Complexity Analysis

### 71. Mid-Conversation Context Change Handling (System Prompt v2.0)
**Decision**: Added a dedicated `MID-CONVERSATION CONTEXT CHANGES` section to the system prompt that instructs Claude to immediately acknowledge and act on budget, recipient, occasion, or preference changes mid-chat.

**Reasoning**: Users frequently change their minds during gifting conversations — "Actually, make it $100 instead of $75" or "Wait, it's for my boss, not my friend." The frontend's `gift-context-extractor.ts` already handled this correctly (iterating all messages with last-match-wins), but the AI itself would sometimes ignore the update and keep recommending based on the original context. The new prompt section enforces four rules:
1. Immediately acknowledge the change ("Got it — updated to $100!")
2. Re-search if the change materially affects results (new budget, different recipient type)
3. Never ignore a mid-conversation context change
4. Reference the Gift Planner sidebar's auto-update so the AI's behavior matches the UI

**Architecture**: Pure prompt engineering — no code change required. The sidebar already auto-updates because `gift-context-extractor.ts` recomputes on every new message via `useMemo`.

### 72. AI Compare Recommendation Styling — Dark Blue with Bold Lead
**Decision**: In the `ComparisonModal`, the AI-generated recommendation section is visually separated from the main comparison body, rendered in a dark blue styled box (`#1e3a5f` text, `border-blue-200`, `bg-blue-50/60` background) with the first sentence bolded.

**Reasoning**: The recommendation is the most important part of the AI comparison — it's the actionable takeaway. Burying it at the end of a wall of text reduces its impact. Separating it into a distinct visual container with a contrasting color (dark blue vs. the default chat bubble styling) creates an information hierarchy: scan the comparison, then focus on the recommendation. Bolding the first sentence provides an instant "tl;dr" for users who skim.

**Implementation**: The `aiAnalysis` string is split on `**Recommendation:**`. The pre-recommendation content renders in a standard `MessageBubble`. The recommendation renders in a custom `<div>` with:
- `border-2 border-blue-200 rounded-xl` for the container
- `bg-blue-50/60` for subtle blue background
- Text color `#1e3a5f` (dark navy) for readability
- First sentence extracted via regex and wrapped in `<strong>` tags
- A "🏆 Our Recommendation" header for clarity

### 73. Single-Click Chat History Loading (React State Race Fix)
**Decision**: Refactored `ChatInterface.tsx` to use a `useEffect` triggered by `activeChatId` changes instead of calling `setMessages` directly in the `loadChat` event handler.

**Root Cause**: The double-click bug was a React state batching issue with Vercel AI SDK's `useChat`. When `loadChat` called both `setActiveChatId(newId)` and `setMessages(savedMessages)` in the same event handler, React batched the state updates. However, `setMessages` was still bound to the OLD `useChat` instance (keyed by the previous `activeChatId`). The first click updated the id but loaded messages into the wrong instance. The second click worked because the id was already correct.

**Fix**: `loadChat` now only calls `setActiveChatId(sessionId)` to update which chat is active, plus clears transient UI state (comparison bar, sidebar). A separate `useEffect` watches `activeChatId` and calls `setMessages(loadMessagesForSession(activeChatId))` — by this time, `useChat` has re-keyed to the new id, so messages load into the correct instance.

**Lesson**: When using keyed hooks like `useChat({ id })`, always defer dependent state updates to effects rather than setting them synchronously in the same handler that changes the key.

### 74. Header Button Tooltips
**Decision**: Added native `title` attributes to all header action buttons — History, Favorites, Cart, and Gift Planner.

**Tooltip Text**:
- **History** (clock icon): "Start a new chat or view previous conversations"
- **Favorites** (heart icon): "View your saved favorite products"
- **Cart** (shopping bag icon): "View your cart items"
- **Gift Planner** (sparkles icon): "View your gift context — occasion, recipient, budget"

**Reasoning**: Icon-only buttons are compact but can confuse first-time users, especially the Gift Planner (sparkles) icon which isn't universally recognized. Native `title` attributes provide zero-cost, accessible hover hints without adding visual clutter. They also improve accessibility for screen readers via implicit `aria-label` behavior.

**Why native `title` over custom tooltip component**: For a POC, native tooltips are sufficient. Custom tooltips (with animations, positioning, mobile support) would add complexity disproportionate to the value. Production would use a tooltip library like Radix or Headless UI.

### 75. Token Usage Measurement & Analysis
**Decision**: Added per-request token logging to `chat_chain.py` that reports system prompt tokens, conversation tokens, and actual Anthropic API usage metadata (input/output/total) for every LLM step.

**Measured Results** (Claude Sonnet 4, prompt v2.0):

| Scenario | Messages | LLM Steps | Input Tokens | Output Tokens | Total |
|---|---|---|---|---|---|
| Greeting (no tool) | 1 | 1 | 4,637 | 72 | **4,709** |
| Full flow + 1 search (14 products) | 9 | 2 | 14,729 | 279 | **15,008** |
| Long chat + budget change + search (15 products) | 15 | 2 | 15,703 | 356 | **16,059** |

**Key Findings**:
- **System prompt is ~4,637 tokens** — this is the fixed cost on every single request, regardless of conversation length
- **Conversation history** adds only ~100–272 tokens for short-to-medium chats (grows linearly with message count)
- **Tool results dominate cost**: each search returning ~15 products injects ~5,300–6,200 tokens of product JSON into the context
- **Output tokens are minimal**: 72–356 tokens per request (Claude is concise)
- **Average per request**: ~11,925 total tokens across all scenarios (heavily weighted by whether a search tool fires)
- **Trim threshold** (80K tokens) is well above typical usage — most conversations stay under 16K tokens

**Cost Implication**: At Anthropic's Sonnet pricing (~$3/$15 per million tokens in/out), a typical 10-message conversation with 2 searches costs approximately $0.05–$0.08. The system prompt alone accounts for ~30–98% of input tokens depending on conversation stage.

**Optimization Opportunities**: Prompt compression could reduce the 4,637-token system prompt by 20–30%. Caching the system prompt via Anthropic's prompt caching feature would reduce cost by ~90% on cached requests. Product JSON could be trimmed to essential fields only (name, price, URL) to cut tool result tokens by ~50%.

### 76. Similarity Search & Overall Search Time Complexity
**Decision**: Documented the algorithmic complexity of every search path in the system.

**ChromaDB Vector Search (HNSW Algorithm)**:
- **Algorithm**: Hierarchical Navigable Small World (HNSW) graph
- **Search complexity**: O(log N) where N = number of indexed products (currently 455)
- **Space complexity**: O(N × M) where M = connections per node (default 16)
- **Distance metric**: Cosine similarity, computed in O(d) per comparison where d = embedding dimension (384 for `all-MiniLM-L6-v2`)

**`similarity_search()` in `embeddings.py`**: **O(log N + K)**
- O(log N) for HNSW approximate nearest neighbor traversal
- O(K) for returning top-K results (K ≤ 10)
- WHERE clauses (price, delivery) filter during HNSW traversal, not post-search

**`search_products_tool()` — Live API Path**: **O(R)**
- O(1) for the HTTP API call (constant algorithmic cost; ~600–700ms network latency)
- O(R) linear scan of R returned results for price/delivery filtering (R ≤ 50 from API, capped at 15 output)

**`find_similar_products_tool()` — Hybrid Path**: **O(log N + R + (K+R) log(K+R))**
- O(log N) for ChromaDB vector search
- O(1) for live API call (sequential with vector search)
- O(K + R) to merge results from both sources
- O((K+R) log(K+R)) worst case for deduplication via sorting

**End-to-End Pipeline Breakdown**:

| Phase | Complexity | Real-World Latency |
|---|---|---|
| Embedding generation (local) | O(d) | ~10ms |
| Vector search (ChromaDB HNSW) | O(log N) | ~5ms for N=455 |
| Live API call (Edible) | O(1) | ~600–700ms |
| Result filtering/merge | O(R) | <1ms |
| LLM inference (Claude) | O(T) | ~1–4s (T = token count) |

**Key Insight**: The pipeline is **I/O-bound, not compute-bound**. Network latency (Edible API call + Anthropic LLM inference) dominates at ~2–5 seconds total, while all algorithmic search operations complete in under 20ms combined. Optimizing the HNSW index structure or switching distance metrics would yield negligible real-world improvement. The highest-impact optimization would be parallelizing the API call with the vector search in `find_similar_products_tool()`, saving ~600ms on hybrid searches.

### 77. "Surprise Me" Rename (from "Spin & Win")
**Decision**: Renamed the spin wheel feature from "Spin & Win" to "Surprise Me" across all UI surfaces — button label, modal header, and CTA text.

**Reasoning**: "Spin & Win" implies the user is winning a prize, discount, or reward — a common dark pattern in e-commerce that creates false expectations. Since the wheel simply suggests random gift ideas from the catalog (no discounts, no prizes), the name is misleading. "Surprise Me" accurately communicates the feature's purpose: serendipitous gift discovery. The modal header changed from "Spin for Ideas!" to "Surprise Me!" and the action button from "SPIN THE WHEEL" to "SPIN & DISCOVER" to reinforce the discovery framing. The result text changed from "We found your match!" to "Here's a gift idea for you!" — neutral and honest.

**Also added**: Tooltip on the Surprise Me button: "Spin the wheel to discover random gift ideas" — clarifying the feature for first-time users.

### 78. Full-Stack Containerization (Docker + Docker Compose)
**Decision**: Created Dockerfiles for both the Python backend and Next.js frontend, plus a `docker-compose.yml` for one-command full-stack deployment.

**Architecture**:
```
docker-compose.yml          → Orchestrates both services
├── backend/Dockerfile      → Python 3.11-slim + FastAPI + ChromaDB + sentence-transformers
└── edible-gift-concierge/Dockerfile → Node 20-alpine, multi-stage (deps → build → runner)
```

**Backend Dockerfile** (`python:3.11-slim`):
- Single-stage build: installs `requirements.txt`, copies app code and pre-built `chroma_data/` (455 products)
- Includes `build-essential` for native extensions (chromadb, numpy, sentence-transformers)
- Health check pings `/health` endpoint every 30s
- ChromaDB data is baked into the image to avoid runtime ingestion delay (~2 min)

**Frontend Dockerfile** (`node:20-alpine`, 3-stage):
- **Stage 1 (deps)**: `npm ci` in isolation for optimal Docker layer caching
- **Stage 2 (builder)**: Copies source + node_modules, runs `npm run build` producing standalone output
- **Stage 3 (runner)**: Minimal runtime image with only `.next/standalone` and `.next/static` — no dev dependencies, no source code. Runs as non-root `nextjs` user (UID 1001)
- Requires `output: "standalone"` in `next.config.ts`

**Docker Compose**:
- Backend starts first with health check gate (`service_healthy`)
- Frontend uses `depends_on` with `condition: service_healthy` — won't start until backend is confirmed ready
- `BACKEND_URL` environment variable connects frontend rewrites to backend container via Docker networking (`http://backend:8000`)
- ChromaDB data persisted via named volume (`chroma-data`) to survive container restarts
- Single command to run: `docker-compose up --build`

**Trade-offs**:
- Backend image is ~2GB due to sentence-transformers + PyTorch dependencies. Production would use a slimmer embedding approach (ONNX runtime) or a hosted embedding API
- ChromaDB data is baked in — fresh products require rebuilding the image or mounting a volume with updated data. Production would use a scheduled re-ingestion cron job
- No HTTPS in containers — TLS termination happens at Vercel/Cloudflare/load balancer layer

### 79. Vercel Deployment Configuration
**Decision**: Configured the Next.js frontend for Vercel deployment with `vercel.json`, and made the backend URL configurable via environment variable.

**Frontend (Vercel-native)**:
- `vercel.json` specifies `framework: "nextjs"`, build command, and output directory
- `BACKEND_URL` environment variable (set as `@backend-url` Vercel secret) controls where API rewrites point
- API routes use `Cache-Control: no-store` headers to prevent stale responses
- Region set to `iad1` (US East) for low-latency Anthropic API calls

**Backend URL Configuration**:
- `next.config.ts` rewrites now use `process.env.BACKEND_URL || "http://localhost:8000"` instead of hardcoded localhost
- Works across all environments: local dev (default localhost), Docker Compose (`http://backend:8000`), Vercel (deployed backend URL)

**Backend Deployment Options**:
- **Option A — Render/Railway/Fly.io**: Deploy the backend Dockerfile as a persistent service. Best for ChromaDB persistence and sentence-transformers model loading (one-time startup cost amortized across requests)
- **Option B — AWS ECS/GCP Cloud Run**: Container-as-a-service with auto-scaling. Cold starts may be 15-30s due to model loading
- **Option C — Self-hosted VPS**: Most control, lowest cost at scale. Run `docker-compose up -d` on any machine with Docker

**Why not Vercel Serverless for the backend**: The Python backend loads a 90MB sentence-transformers model into memory and maintains a ChromaDB persistent database — both require a long-running process. Vercel's serverless functions have a 250MB package limit and cold-start on every request, making them unsuitable for this architecture. The backend is designed as a stateful service, not a stateless function.

### 80. Next.js Standalone Output Mode
**Decision**: Added `output: "standalone"` to `next.config.ts` to enable Docker-optimized production builds.

**Reasoning**: Next.js standalone mode produces a self-contained `server.js` that includes only the files needed to run in production — no `node_modules`, no source code. This reduces the Docker image from ~1GB (full `node_modules`) to ~150MB (standalone). The trade-off is that `next.config.ts` rewrites and middleware are baked into the build, requiring a rebuild to change the backend URL. This is acceptable since environment variables are injected at runtime for dynamic values.

**Also fixed**: Excluded `test/` directory from `tsconfig.json` — legacy test files referencing the old TypeScript API (pre-Python migration) were breaking the production build.
