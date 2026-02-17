# ─── Edible Gift Concierge — Python Backend ───
# Multi-stage build for FastAPI + LangChain + ChromaDB

FROM python:3.11-slim AS base

# System deps for building native extensions (chromadb, numpy, etc.)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies first (cache layer)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY app/ ./app/

# Copy pre-built ChromaDB vector data (455 products)
# This avoids running ingestion on every container start
COPY chroma_data/ ./chroma_data/

# Copy env example for reference (actual env vars injected at runtime)
COPY .env.example .

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')" || exit 1

# Run with uvicorn
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
