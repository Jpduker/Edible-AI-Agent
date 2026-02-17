# 🍓 Edible Gift Concierge

An AI-powered gift discovery experience for Edible Arrangements. Ask about any occasion, budget, or recipient — and get personalized product recommendations from the live Edible catalog.

> **Built with**: Next.js 16 · Python FastAPI · LangChain · Claude Sonnet 4 · ChromaDB · Docker

![Docker](https://img.shields.io/badge/Docker-Ready-blue?logo=docker) ![Python](https://img.shields.io/badge/Python-3.11-green?logo=python) ![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)

---

## 🚀 Quick Start (Docker — Recommended)

The easiest way to run the full application locally is with Docker. One command spins up both the frontend and backend.

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running

### 1. Clone the repository

```bash
git clone https://github.com/Jpduker/Edible-AI-Agent.git
cd Edible-AI-Agent
```

### 2. Set up your API key

```bash
cp .env.example .env
```

Edit `.env` and add your Anthropic API key:

```
ANTHROPIC_API_KEY=sk-ant-...
```

### 3. Run with Docker

```bash
docker compose up --build
```

That's it! Open [http://localhost:3000](http://localhost:3000) and start chatting.

> **First build** takes 3–5 minutes (downloads Python + Node.js dependencies, loads the embedding model). Subsequent starts are near-instant thanks to Docker layer caching.

### Stopping the app

```bash
docker compose down
```

---

## Architecture

```
┌───────────────────────────────────────────────────────┐
│                      Browser                          │
│   ChatInterface · ProductCards · QuickReplies         │
│   ComparisonModal · SpinWheel · GiftPlanner           │
│   CartDrawer · FavoritesDrawer · ChatHistory          │
└──────────────────┬────────────────────────────────────┘
                   │ HTTP (port 3000)
┌──────────────────▼────────────────────────────────────┐
│              Next.js 16 Frontend                      │
│         (Vercel AI SDK v6 · useChat)                  │
│         Rewrites /api/* → backend:8000                │
└──────────────────┬────────────────────────────────────┘
                   │ HTTP (port 8000)
┌──────────────────▼────────────────────────────────────┐
│            Python FastAPI Backend                      │
│  ┌─────────────────┐   ┌──────────────────────────┐  │
│  │  LangChain Agent │──→│  Claude Sonnet 4 (LLM)   │  │
│  │  (tool calling)  │←──│  Anthropic API            │  │
│  └────────┬─────────┘   └──────────────────────────┘  │
│           │                                            │
│  ┌────────▼─────────┐   ┌──────────────────────────┐  │
│  │ search_products   │──→│  Edible Arrangements API  │  │
│  │ find_similar      │   │  (live product catalog)   │  │
│  └────────┬──────────┘   └──────────────────────────┘  │
│           │                                            │
│  ┌────────▼──────────┐                                 │
│  │   ChromaDB (HNSW)  │  455 products · cosine sim     │
│  │   sentence-transformers (local embeddings)          │
│  └────────────────────┘                                │
└────────────────────────────────────────────────────────┘
```

---

## Docker Services

| Service | Container | Port | Description |
|---------|-----------|------|-------------|
| `backend` | `edible-backend` | 8000 | FastAPI + LangChain + ChromaDB |
| `frontend` | `edible-frontend` | 3000 | Next.js 16 (standalone) |

The backend includes a pre-populated ChromaDB vector database with 455 Edible Arrangements products. No manual ingestion needed.

---

## Key Features

- **Conversational Gift Discovery** — Natural language chat powered by Claude Sonnet 4
- **Live Product Search** — Real-time data from the Edible Arrangements API
- **Vector Similarity Search** — ChromaDB with HNSW index for "find similar" recommendations
- **Anti-Hallucination** — AI never invents products; all recommendations come from verified API searches
- **AI Product Comparison** — Side-by-side comparison with AI-generated recommendation
- **Smart Quick Replies** — Contextual suggestion buttons generated by the AI
- **Streaming Responses** — Token-by-token SSE streaming for sub-second perceived latency
- **Gift Context Sidebar** — Auto-detected recipient, occasion, budget, preferences
- **Cart & Favorites** — Save products, build a cart, persist with localStorage
- **Chat History** — Multiple conversation sessions with localStorage persistence
- **Gift Message Composer** — AI-written gift card messages with tone selection
- **Surprise Me Wheel** — Spin-the-wheel for random gift discovery
- **Mobile Responsive** — Touch-friendly, compact cards, scrollable quick replies

---

## Project Structure

```
Edible-AI-Agent/
├── docker-compose.yml              # One-command full-stack deployment
├── .env.example                    # Template for API keys
│
├── backend/                        # Python FastAPI backend
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── app/
│   │   ├── main.py                 # FastAPI app, CORS, rate limiting
│   │   ├── chains/
│   │   │   ├── chat_chain.py       # LangChain agent + tool loop + SSE streaming
│   │   │   └── prompts.py          # System prompt v2.0
│   │   ├── tools/
│   │   │   ├── edible_api.py       # Async Edible API client with TTL cache
│   │   │   └── search_tools.py     # LangChain tools: search + similarity
│   │   ├── db/
│   │   │   ├── embeddings.py       # ChromaDB vector operations
│   │   │   └── ingest.py           # Product ingestion script
│   │   └── models/
│   │       └── schemas.py          # Pydantic models
│   └── chroma_data/                # Pre-built vector DB (455 products)
│
└── edible-gift-concierge/          # Next.js 16 frontend
    ├── Dockerfile
    ├── vercel.json
    ├── DESIGN_DECISIONS.md         # 80+ documented design decisions
    ├── src/
    │   ├── app/                    # Next.js App Router pages
    │   ├── components/             # React components (13 files)
    │   └── lib/                    # Shared utilities & types
    └── public/                     # Static assets
```

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | ✅ | Your Anthropic API key for Claude Sonnet 4 |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16 (App Router, standalone output) |
| AI Model | Claude Sonnet 4 (`claude-sonnet-4-20250514`) |
| Frontend AI SDK | Vercel AI SDK v6 (`@ai-sdk/react`) |
| Backend | Python 3.11 + FastAPI |
| AI Orchestration | LangChain + `langchain-anthropic` |
| Vector DB | ChromaDB (HNSW, cosine similarity) |
| Embeddings | `sentence-transformers` (`all-MiniLM-L6-v2`, local) |
| Styling | Tailwind CSS 4 + Custom CSS Variables |
| Containerization | Docker + Docker Compose |
| Deployment | Vercel (frontend) + any container host (backend) |

---

## Advanced: Manual Setup (Without Docker)

<details>
<summary>Click to expand manual setup instructions</summary>

If you prefer running without Docker, you need to start the backend and frontend separately.

### Backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Set API key
cp .env.example .env
# Edit .env and add ANTHROPIC_API_KEY

# Populate vector DB (first time only)
python -m app.db.ingest --full

# Start backend
uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd edible-gift-concierge
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

</details>

---

## Design Decisions

See [DESIGN_DECISIONS.md](./edible-gift-concierge/DESIGN_DECISIONS.md) for a comprehensive record of 80+ design, architectural, and business decisions — each with detailed reasoning.

---

## License

This is a proof-of-concept project. Not affiliated with Edible Arrangements.
