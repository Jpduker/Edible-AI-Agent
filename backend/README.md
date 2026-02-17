# Edible Gift Concierge — Python Backend

Python-based backend powered by **FastAPI + LangChain + Claude + ChromaDB**.

Replaces the original Next.js API routes with a Python backend featuring:
- **LangChain** for AI orchestration with tool calling
- **ChromaDB** for vector similarity search (find similar products)
- **FastAPI** with SSE streaming (compatible with Vercel AI SDK `useChat`)
- **Hybrid search**: Vector DB similarity + live Edible API fallback

## Architecture

```
Frontend (Next.js)  →  /api/chat  →  Python FastAPI (port 8000)
                                         ↓
                                    LangChain Agent
                                    ├── search_products_tool  → Edible API (live)
                                    └── find_similar_products_tool
                                        ├── ChromaDB (vector similarity)
                                        └── Edible API (fallback)
```

## Quick Start

### 1. Setup
```bash
cd backend
chmod +x setup.sh
./setup.sh
```

### 2. Configure
Edit `backend/.env` and add your Anthropic API key:
```
ANTHROPIC_API_KEY=sk-ant-...
```

### 3. Populate Vector DB
```bash
source venv/bin/activate
python -m app.db.ingest          # Default 15 keywords
python -m app.db.ingest --full   # Comprehensive 30+ keywords
```

### 4. Start Backend
```bash
source venv/bin/activate
uvicorn app.main:app --reload --port 8000
```

### 5. Start Frontend (separate terminal)
```bash
cd edible-gift-concierge
npm run dev
```

The Next.js frontend will proxy `/api/chat` requests to `localhost:8000` via `next.config.ts` rewrites.

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check + vector DB stats |
| `/api/chat` | POST | Chat with SSE streaming |
| `/api/search` | POST | Proxy to Edible search API |
| `/api/stats` | GET | Vector DB statistics |

## Project Structure

```
backend/
├── app/
│   ├── main.py              # FastAPI app, CORS, rate limiting, SSE
│   ├── chains/
│   │   ├── chat_chain.py     # LangChain chat chain + tool loop + streaming
│   │   └── prompts.py        # System prompt (ported from TS, v2.0)
│   ├── tools/
│   │   ├── edible_api.py     # Async Edible API client with TTL cache
│   │   └── search_tools.py   # LangChain tools: search + similarity
│   ├── db/
│   │   ├── embeddings.py     # ChromaDB: upsert, query, metadata filtering
│   │   └── ingest.py         # Ingestion script: Edible API → ChromaDB
│   └── models/
│       └── schemas.py        # Pydantic models (Product, SearchResult, etc.)
├── requirements.txt
├── setup.sh
├── .env.example
└── .gitignore
```

## Key Differences from TypeScript Backend

| Feature | TypeScript (old) | Python (new) |
|---------|-----------------|--------------|
| Framework | Next.js API Routes | FastAPI |
| AI SDK | Vercel AI SDK v6 | LangChain |
| LLM | `@ai-sdk/anthropic` | `langchain-anthropic` |
| Similarity Search | Keyword heuristics | **ChromaDB vector search** |
| Embeddings | None | `sentence-transformers` (local) |
| Streaming | Vercel SDK SSE | FastAPI `StreamingResponse` |
| Caching | In-memory Map | In-memory dict (same pattern) |
| Type System | TypeScript interfaces | Pydantic models |
| Tool Calling | Zod schemas | LangChain `@tool` decorator |
