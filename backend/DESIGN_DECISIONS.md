# Design Decisions — Edible Gift Concierge (Python Backend)

Technical decisions and justifications for the AI-powered gift recommendation chatbot built with Python, LangChain, and ChromaDB.

---

## 1. Language & Runtime: Python 3.9+

**Decision**: Use Python as the backend language.

**Why**:
- Python is the **de facto language for AI/ML engineering**. Every major LLM framework (LangChain, LlamaIndex, Haystack, Semantic Kernel) has Python as its primary SDK.
- The richest ecosystem for vector databases, embeddings, NLP, and data processing — all native Python.
- Async support via `asyncio` + `httpx` gives us non-blocking I/O without sacrificing the AI tooling ecosystem.
- Faster prototyping cycle for prompt engineering and tool experimentation — no compile step, dynamic typing for rapid iteration.
- Direct access to `sentence-transformers`, `torch`, `chromadb` — these libraries are Python-first with no comparable alternatives in other languages.

**Trade-off**: Slightly higher cold-start latency than compiled languages, but irrelevant for a chat application where LLM response time dominates (2-5s per turn).

---

## 2. Web Framework: FastAPI

**Decision**: Use FastAPI over Flask, Django, or other Python web frameworks.

**Why**:
- **Native async/await** — critical for our architecture where every chat turn involves multiple async operations (LLM call, API calls, vector DB queries).
- **Built-in SSE support** via `StreamingResponse` — essential for streaming LLM responses token-by-token to the frontend.
- **Automatic OpenAPI docs** — every endpoint gets interactive Swagger docs at `/docs` for free.
- **Pydantic integration** — request/response validation uses the same Pydantic models we already define for our domain objects (Product, ChatMessage, etc.).
- **Lifespan events** — clean startup/shutdown hooks for initializing ChromaDB connections and logging stats.
- **Performance** — built on Starlette/uvicorn (ASGI), benchmarks show 2-3x throughput over Flask for async workloads.

**Alternatives considered**:
- Flask: No native async, would need `gevent` or `asyncio` bridges — adds complexity.
- Django: Too heavy for an API-only backend; ORM, admin panel, and template engine are unnecessary overhead.
- Starlette (raw): FastAPI adds Pydantic validation and OpenAPI docs on top of Starlette with zero performance cost.

---

## 3. AI Orchestration: LangChain

**Decision**: Use LangChain for LLM orchestration, tool calling, and conversation management.

**Why**:
- **Tool calling abstraction** — the `@tool` decorator turns any Python function into a structured tool that Claude can invoke. LangChain handles the JSON schema generation, argument parsing, and result serialization automatically.
- **Provider-agnostic** — swapping from Claude to GPT-4, Gemini, or a local model requires changing one line (`ChatAnthropic` → `ChatOpenAI`). The tools, prompts, and chain logic remain identical.
- **Conversation memory patterns** — built-in message types (`HumanMessage`, `AIMessage`, `ToolMessage`) with proper role mapping, trimming, and token counting.
- **Mature ecosystem** — community tools, vector store integrations (LangChain-Chroma), and debugging with LangSmith tracing.
- **Streaming support** — first-class `astream` and `astream_events` for token-level streaming through the entire chain.

**How we use it**:
- `ChatAnthropic` as the LLM with tool binding via `.bind_tools()`
- Custom tool-calling loop (max 5 iterations) that executes tools and feeds results back
- Message conversion layer between frontend format and LangChain message types

**Alternatives considered**:
- Raw Anthropic SDK: Would work but requires manual tool schema definition, argument parsing, and multi-step loop management. LangChain provides this out of the box.
- LlamaIndex: Better for RAG-heavy apps, but our use case is more tool-calling than document retrieval.
- Semantic Kernel: Microsoft-focused, less Python community adoption.

---

## 4. LLM: Claude Sonnet 4 (claude-sonnet-4-20250514)

**Decision**: Use Anthropic's Claude Sonnet 4 as the primary LLM.

**Why**:
- **Best tool-calling reliability** — Claude Sonnet 4 has near-perfect structured output adherence. When given tool schemas, it consistently produces valid JSON arguments with correct types.
- **Strong instruction following** — our system prompt is complex (~2000 tokens with tone rules, formatting constraints, product knowledge, and multi-step reasoning instructions). Claude follows these without drift.
- **Cost-performance sweet spot** — Sonnet is 5x cheaper than Opus while maintaining comparable quality for our use case (product recommendation, not creative writing or complex reasoning).
- **Streaming** — Anthropic's streaming API sends tokens as they're generated, enabling real-time chat UX.
- **Large context window** (200K tokens) — handles long conversation histories without truncation issues.

**Configuration**:
- `temperature=0.7` — warm enough for natural conversation, not so high that it hallucinates products.
- `max_tokens=4096` — sufficient for detailed product recommendations with formatting.
- Streaming enabled for all chat interactions.

---

## 5. Vector Database: ChromaDB (Local Persistent)

**Decision**: Use ChromaDB with local file persistence over cloud-hosted alternatives.

**Why**:
- **Zero infrastructure** — runs in-process, no separate server to deploy or manage. Just a directory on disk (`./chroma_data/`).
- **Cosine similarity** — the standard distance metric for semantic text search. Products that are described similarly cluster together regardless of exact keyword overlap.
- **Metadata filtering** — ChromaDB supports `$and`, `$or`, `$gt`, `$lt`, `$eq` operators on metadata fields. We use this for **server-side price and delivery filtering** before results are returned:
  ```python
  where={"$and": [
      {"price": {"$lte": max_price}},
      {"is_one_hour_delivery": {"$eq": True}}
  ]}
  ```
- **Built-in embeddings** — ships with a default ONNX embedding model, though we use sentence-transformers for consistency.
- **Python-native** — no REST API overhead; direct function calls to `collection.query()`.

**Alternatives considered**:
- Pinecone: Cloud-hosted, adds latency + cost + API key management for a catalog of only ~450 products.
- Weaviate: Powerful but requires running a separate Docker container — overkill for our scale.
- FAISS: No metadata filtering, no persistence out of the box, lower-level API.
- PostgreSQL + pgvector: Requires a running Postgres instance; good for production but heavy for development.

**Scale justification**: Our catalog is ~450 products. ChromaDB handles millions; at our scale, queries return in <50ms including embedding generation.

---

## 6. Embedding Model: all-MiniLM-L6-v2 (Local)

**Decision**: Use a local sentence-transformer model for embeddings instead of an API-based service.

**Why**:
- **No API key required** — one fewer secret to manage, no billing, no rate limits.
- **Zero latency overhead** — embeddings are generated locally in ~5ms per text. No network round-trip to OpenAI/Cohere.
- **Privacy** — product data never leaves the server for embedding generation.
- **384-dimensional vectors** — compact enough for fast similarity search, expressive enough to capture semantic meaning.
- **Proven quality** — MiniLM-L6-v2 is the most widely benchmarked small embedding model. It ranks top-tier on MTEB for its size class.

**Model size**: ~80MB download (one-time), ~200MB in memory. Negligible for a server.

**What gets embedded**: Each product is converted to a rich text document combining multiple fields:
```
Product: Chocolate Dipped Strawberries Box
Price: $49.99
Description: Fresh strawberries hand-dipped in chocolate...
Category: Chocolate | Occasion: Birthday, Anniversary
Allergy Info: Contains milk, soy
Ingredients: Strawberries, chocolate, cocoa butter
Delivery: Available for delivery
Sizes: 3 available
Promo: FREE delivery on orders $65+
```
This ensures similarity search considers price range, occasion, dietary info, and delivery — not just the product name.

---

## 7. Hybrid Search Strategy

**Decision**: Implement a hybrid search combining vector similarity (ChromaDB) + live API keyword search.

**Why**:

The Edible Arrangements API is **keyword-based only** — it matches product names and tags. This fails for:
- Semantic queries: "something romantic under $50" → no keyword match
- Attribute-based: "nut-free gift for a coworker" → API doesn't filter by allergy
- Vague requests: "similar to what I just saw but bigger" → requires understanding context

**How it works**:

```
User: "Find me something similar to the strawberry box but nut-free"
                    │
    ┌───────────────┴───────────────┐
    ▼                               ▼
ChromaDB Vector Search          Edible API Search
(semantic similarity on          (keyword: "strawberry")
 "strawberry nut-free gift")
    │                               │
    ▼                               ▼
 Results filtered by             Results filtered by
 metadata (allergy_info)         server-side logic
    │                               │
    └───────────┬───────────────────┘
                ▼
         Merge + Deduplicate
         (by product ID)
                ▼
         Return top 10
```

**Why not vector-only?**
- The live API has real-time pricing and availability. Vector DB data can be stale.
- New products added to the Edible catalog won't appear in ChromaDB until re-ingestion.

**Why not API-only?**
- Can't do semantic similarity — "romantic" won't match "Valentine's Chocolate Strawberries."
- Can't filter by attributes the API doesn't expose as search parameters (allergy, ingredients, size count).

---

## 8. Product Ingestion Pipeline

**Decision**: Pre-populate ChromaDB by searching the Edible API with 36 curated keywords.

**Why**:
- The Edible API has **no "list all products" endpoint** — search is the only way to discover products.
- We use 36 keywords across 4 categories to maximize catalog coverage:
  - **Occasions** (15): birthday, thank you, sympathy, valentine's, anniversary, congratulations, new baby, graduation, wedding, holiday, mother's day, father's day, christmas, easter, get well
  - **Product types** (11): chocolate strawberries, fruit arrangement, cake, cookies, gift basket, brownies, popcorn, fruit bouquet, cupcakes, cheesecake, flowers
  - **Themes** (4): corporate gift, summer treats, winter gifts, spring collection
  - **Ingredients** (6): apple, pineapple, melon, berries, chocolate, caramel

**Deduplication**: Products are keyed by their API ID. Since many products appear across multiple keyword searches (e.g., a birthday cake also shows up for "cake", "birthday", "chocolate"), we deduplicate before upserting. Typical overlap: ~70% (1594 fetched → 453 unique).

**Result**: ~450 unique products covering the full Edible Arrangements catalog, each with rich metadata (price, category, occasion, allergy info, ingredients, delivery type, sizes, promotions).

---

## 9. Streaming Protocol: Vercel AI SDK–Compatible SSE

**Decision**: Implement Server-Sent Events (SSE) that match the Vercel AI SDK `useChat` wire format.

**Why**:
- The frontend uses `useChat()` from the Vercel AI SDK, which expects a **specific SSE format**:
  ```
  0:"token text"\n        ← text chunk
  d:{"finishReason":"stop"}\n  ← completion signal
  ```
- By matching this protocol exactly, the **frontend code doesn't need any changes** — it continues using `useChat()` and the React components work identically.
- SSE is simpler than WebSockets for unidirectional streaming (server → client). No connection upgrade, works through proxies, auto-reconnects.

**Implementation**:
- FastAPI `StreamingResponse` with `text/event-stream` content type
- Each LLM token is JSON-encoded and prefixed with `0:` 
- Tool-calling happens server-side in a loop (invisible to frontend)
- Only the final natural language response is streamed to the user

---

## 10. Caching: In-Memory TTL Cache

**Decision**: Use a simple in-memory dictionary with TTL expiration for API response caching.

**Why**:
- The Edible API is rate-limited and adds 200-500ms latency per call. Caching identical searches saves both time and API goodwill.
- **TTL = 120 seconds** — long enough to cache within a conversation (user asks about "birthday gifts", then refines), short enough that prices/availability stay fresh.
- **Max 100 entries** — prevents memory bloat; LRU eviction when full.
- In-memory is appropriate because:
  - Single-process deployment (uvicorn)
  - Cache is warm per-session, cold-starts are acceptable
  - No Redis needed for a single-server app

**What's cached**: Only live API search results (keyword → product list). ChromaDB queries are not cached (they're already local and fast).

---

## 11. Rate Limiting: SlowAPI (In-Memory)

**Decision**: Rate-limit the `/api/chat` endpoint to 20 requests/minute per IP.

**Why**:
- Each chat request triggers an LLM call ($0.003-0.01 per request) and potentially multiple tool calls. Without rate limiting, a single abusive client could rack up significant API costs.
- 20/min is generous for normal chat (users rarely send more than 5-10 messages per minute) but blocks automated abuse.
- SlowAPI wraps `limits` library with FastAPI integration — 3 lines of code.
- In-memory storage is fine for single-server deployment; would swap to Redis for multi-instance.

---

## 12. Data Modeling: Pydantic v2

**Decision**: Use Pydantic models for all data structures.

**Why**:
- **Validation at the boundary** — raw API responses are validated and normalized into `Product` models. If the Edible API changes field names or types, we get clear errors instead of silent bugs.
- **Serialization** — `model.model_dump()` and `model.model_dump_json()` provide clean JSON output for API responses and ChromaDB metadata.
- **Alias support** — the Edible API has quirks (field named `ingrediantNames` with a typo, `@search.score` with a special character). Pydantic aliases handle this transparently:
  ```python
  search_score: Optional[float] = Field(None, alias="@search.score")
  ingrediant_names: Optional[str] = Field(None, alias="ingrediantNames")
  ```
- **FastAPI integration** — request bodies are automatically parsed and validated against Pydantic models.
- **IDE support** — full autocomplete and type checking in VS Code / PyCharm.

---

## 13. Tool Design: Two Specialized Tools

**Decision**: Give Claude exactly two tools instead of a single general-purpose search.

### `search_products_tool`
- **Purpose**: Fresh keyword search against the live Edible API
- **When Claude uses it**: User asks to browse ("show me birthday cakes"), search ("find chocolate under $30"), or explore categories
- **Data source**: Always live API (real-time prices/availability)
- **Filters**: `max_price`, `min_price`, `delivery_filter` (applied server-side after API returns results)

### `find_similar_products_tool`
- **Purpose**: Find semantically related products
- **When Claude uses it**: User wants alternatives ("something like this but cheaper"), comparisons, or similarity-based discovery
- **Data source**: ChromaDB vector search (primary) + live API (fallback), merged and deduplicated
- **Filters**: Same price/delivery filters, applied at both the ChromaDB query level (metadata `where` clause) and post-query

**Why two tools?**:
- **Clear intent mapping** — Claude can distinguish between "search for X" (keyword tool) and "find something like X" (similarity tool). This leads to better tool selection.
- **Different data sources** — search needs fresh data; similarity benefits from pre-computed embeddings.
- **Simpler schemas** — each tool has focused parameters. A combined tool would need a `mode` parameter and conditional logic, making it harder for the LLM to use correctly.

**Why not more tools?** (e.g., separate `filter_by_price`, `get_product_details`, `check_availability`):
- More tools = more decision points for the LLM = higher chance of wrong tool selection.
- Two tools cover 100% of our use cases. Adding tools would fragment the logic without adding capability.

---

## 14. Server-Side Filtering (Not LLM-Side)

**Decision**: Apply price and delivery filters in Python code, not by asking Claude to filter.

**Why**:
- **Reliability** — LLMs make mistakes when filtering. Asking Claude to "only show products under $50" might still show a $52 item if the LLM rounds or miscounts.
- **Efficiency** — filtering 50 products down to 10 takes microseconds in Python but would waste tokens if done in the prompt.
- **Consistency** — the same filter logic applies regardless of how the user phrases it ("under fifty dollars", "< $50", "budget-friendly").

**How it works**:
1. Claude extracts the user's intent and calls a tool with structured parameters: `max_price=50, delivery_filter="delivery"`
2. The tool fetches results from the API/ChromaDB
3. Python code filters the results by price range and delivery type
4. Only matching products are returned to Claude for presentation

---

## 15. Conversation Management

**Decision**: Implement conversation trimming with a 80K token budget, keeping the first message + last 60% of history.

**Why**:
- Claude's context window is 200K tokens, but sending the full history of a long conversation wastes money and adds latency.
- **Keep first message**: Often contains the user's core intent ("I need a gift for my mom's birthday").
- **Keep last 60%**: Recent context matters more than middle turns for gift recommendation flow.
- **80K budget**: Leaves ~120K tokens for the system prompt, tool schemas, and response generation.

---

## 16. CORS Configuration

**Decision**: Allow origins `localhost:3000` and `localhost:3001` with full method/header access.

**Why**:
- The frontend (Next.js) runs on port 3000 (default) or 3001 (if 3000 is occupied).
- Backend runs on port 8000. Cross-origin requests require CORS headers.
- Credentials are allowed for potential future cookie-based auth.
- In production, this would be locked down to the specific deployed domain.

---

## 17. Frontend Proxying via Next.js Rewrites

**Decision**: Use Next.js `rewrites()` in `next.config.ts` to proxy `/api/chat` to the Python backend, rather than calling the backend directly from the browser.

**Why**:
- **No CORS issues in production** — browser sees same-origin requests.
- **No frontend code changes** — `useChat()` still calls `/api/chat`, unaware that it's proxied.
- **Flexible deployment** — the proxy target can be changed without rebuilding the frontend (environment variable or config change).
- **Security** — the Python backend URL is never exposed to the client.

---

## 18. Project Structure

**Decision**: Organize the backend into `models/`, `tools/`, `db/`, and `chains/` packages.

```
backend/
├── app/
│   ├── main.py              # FastAPI entry point, CORS, routes
│   ├── models/
│   │   └── schemas.py        # Pydantic models (data layer)
│   ├── tools/
│   │   ├── edible_api.py     # External API client (integration layer)
│   │   └── search_tools.py   # LangChain tools (AI layer)
│   ├── db/
│   │   ├── embeddings.py     # ChromaDB operations (persistence layer)
│   │   └── ingest.py         # Data ingestion script (CLI)
│   └── chains/
│       ├── chat_chain.py     # LLM orchestration (AI layer)
│       └── prompts.py        # System prompt (configuration)
```

**Why this structure**:
- **Separation of concerns** — each package has one responsibility. `tools/` handles external integrations, `db/` handles persistence, `chains/` handles AI logic.
- **Testability** — each module can be unit tested independently. Mock `edible_api` to test `search_tools`, mock `embeddings` to test `chat_chain`.
- **Discoverability** — a new developer can find the system prompt in `chains/prompts.py`, the API client in `tools/edible_api.py`, etc., without reading the whole codebase.

---

## 19. Error Handling Strategy

**Decision**: Graceful degradation at every layer.

| Layer | Failure | Behavior |
|-------|---------|----------|
| Edible API | Timeout/5xx | Return empty list, log warning. Claude tells user "I'm having trouble searching right now." |
| ChromaDB | Query fails | Fall back to live API search only. Log error. |
| LLM | Tool call fails | Feed error message back to Claude as a `ToolMessage`. Claude explains the issue conversationally. |
| LLM | Max tool iterations (5) | Force a text response. Prevents infinite tool-calling loops. |
| Rate limit | Exceeded | Return 429 with retry-after header. |

**Why**: A gift recommendation chatbot should never crash. Partial results are better than an error page. The LLM is particularly good at explaining failures conversationally ("I wasn't able to find exactly what you're looking for, but here are some alternatives...").

---

## 20. Observability

**Decision**: Structured logging with Python's `logging` module at key points.

**What's logged**:
- Every API call (URL, status code, response time)
- Cache hits/misses
- ChromaDB query results (count, search strategy)
- Tool executions (which tool, arguments, result count)
- Errors with full context

**Why not a more complex solution** (Datadog, custom metrics, etc.):
- This is a development/demo project. Structured logs are sufficient for debugging.
- LangSmith tracing is available via LangChain if deeper LLM debugging is needed (just set `LANGCHAIN_TRACING_V2=true`).
