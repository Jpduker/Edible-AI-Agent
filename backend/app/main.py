"""
FastAPI backend for the Edible Gift Concierge.
Replaces the Next.js API routes with Python + LangChain + ChromaDB.
"""

import os
import json
import time
import logging
from collections import defaultdict
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
from dotenv import load_dotenv

from app.chains.chat_chain import chat_stream, compare_products
from app.chains.prompts import SYSTEM_PROMPT_VERSION
from app.db.embeddings import get_collection_count
from app.models.schemas import ChatRequest

load_dotenv()

# ─── Logging ───
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


# ─── Rate Limiting ───
RATE_LIMIT = 20
RATE_WINDOW_MS = 60_000
_rate_map: dict[str, dict] = defaultdict(lambda: {"count": 0, "reset_time": 0})


def check_rate_limit(ip: str) -> bool:
    now = int(time.time() * 1000)
    entry = _rate_map[ip]

    if now > entry["reset_time"]:
        entry["count"] = 1
        entry["reset_time"] = now + RATE_WINDOW_MS
        return True

    if entry["count"] >= RATE_LIMIT:
        return False

    entry["count"] += 1
    return True


# ─── App Lifecycle ───
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup / shutdown events."""
    product_count = get_collection_count()
    logger.info(f"🚀 Edible Gift Concierge Backend started (prompt={SYSTEM_PROMPT_VERSION})")
    logger.info(f"📦 ChromaDB: {product_count} products indexed")

    if product_count == 0:
        logger.warning(
            "⚠️  ChromaDB is empty! Run 'python -m app.db.ingest' to populate the vector DB."
        )

    yield

    logger.info("👋 Backend shutting down")


# ─── FastAPI App ───
app = FastAPI(
    title="Edible Gift Concierge API",
    description="AI-powered gift advisor for Edible Arrangements — powered by LangChain + Claude + ChromaDB",
    version="2.0.0",
    lifespan=lifespan,
)

# CORS — allow the Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Health Check ───
@app.get("/health")
async def health():
    return {
        "status": "ok",
        "prompt_version": SYSTEM_PROMPT_VERSION,
        "vector_db_count": get_collection_count(),
    }


# ─── Chat Endpoint (SSE Streaming) ───
@app.post("/api/chat")
async def chat(request: Request):
    """
    Main chat endpoint — receives messages, streams AI response via SSE.
    Compatible with the Vercel AI SDK useChat hook on the frontend.
    """
    # Rate limiting
    forwarded = request.headers.get("x-forwarded-for")
    ip = forwarded.split(",")[0] if forwarded else request.client.host if request.client else "unknown"

    if not check_rate_limit(ip):
        raise HTTPException(
            status_code=429,
            detail="Too many requests. Please wait a moment and try again.",
        )

    # Parse request body
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON body.")

    messages = body.get("messages")
    if not messages or not isinstance(messages, list):
        raise HTTPException(status_code=400, detail="Messages array is required.")

    logger.info(json.dumps({
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "level": "info",
        "event": "chat_request",
        "promptVersion": SYSTEM_PROMPT_VERSION,
        "ip": ip,
        "messageCount": len(messages),
    }))

    # Stream SSE response (AI SDK v6 UI Message Stream Protocol)
    return StreamingResponse(
        chat_stream(messages),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Vercel-AI-UI-Message-Stream": "v1",
            "X-Accel-Buffering": "no",
            "X-Prompt-Version": SYSTEM_PROMPT_VERSION,
        },
    )


# ─── Search Proxy (for frontend direct search) ───
@app.post("/api/search")
async def search_proxy(request: Request):
    """Proxy search requests to the Edible API (for frontend use)."""
    import httpx

    try:
        body = await request.json()
        keyword = body.get("keyword", "")
        zip_code = body.get("zipCode")

        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                "https://www.ediblearrangements.com/api/search/",
                json={"keyword": keyword, "zipCode": zip_code},
                headers={
                    "Content-Type": "application/json",
                    "Accept": "application/json",
                    "User-Agent": "EdibleGiftConcierge/2.0",
                },
            )

            if response.status_code != 200:
                return JSONResponse(
                    content={"error": f"Upstream API returned {response.status_code}"},
                    status_code=502,
                )

            return JSONResponse(content=response.json())

    except Exception as e:
        logger.error(f"Search proxy error: {e}")
        raise HTTPException(status_code=500, detail="Search failed.")


# ─── AI Compare Endpoint ───
@app.post("/api/compare")
async def ai_compare(request: Request):
    """
    AI-powered product comparison — receives products + gift context,
    returns a structured pros/cons analysis with recommendation.
    """
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON body.")

    products = body.get("products")
    context = body.get("context", {})

    if not products or not isinstance(products, list) or len(products) < 2:
        raise HTTPException(status_code=400, detail="At least 2 products are required.")

    logger.info(f"AI Compare: {len(products)} products, context={list(context.keys())}")

    try:
        analysis = await compare_products(products, context)
        return JSONResponse(content={"analysis": analysis})
    except Exception as e:
        logger.error(f"AI Compare error: {e}")
        raise HTTPException(status_code=500, detail="Comparison failed.")


# ─── Vector DB Stats ───
@app.get("/api/stats")
async def stats():
    """Return vector DB stats for debugging."""
    return {
        "prompt_version": SYSTEM_PROMPT_VERSION,
        "vector_db_products": get_collection_count(),
    }
