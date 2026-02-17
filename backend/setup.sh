#!/bin/bash
# Setup script for the Python backend
set -e

echo "═══════════════════════════════"
echo "Edible Gift Concierge - Python Backend Setup"
echo "═══════════════════════════════"

cd "$(dirname "$0")"

# Create virtual environment
if [ ! -d "venv" ]; then
    echo "📦 Creating virtual environment..."
    python3 -m venv venv
fi

# Activate venv
source venv/bin/activate

# Install dependencies
echo "📥 Installing dependencies..."
pip install -r requirements.txt

# Copy .env if needed
if [ ! -f ".env" ]; then
    echo "📋 Creating .env from template..."
    cp .env.example .env
    echo "⚠️  Please edit backend/.env and add your ANTHROPIC_API_KEY"
fi

echo ""
echo "✓ Setup complete!"
echo ""
echo "Next steps:"
echo "  1. Add your ANTHROPIC_API_KEY to backend/.env"
echo "  2. Populate the vector DB:  python -m app.db.ingest"
echo "  3. Start the server:        python -m uvicorn app.main:app --reload --port 8000"
echo ""
