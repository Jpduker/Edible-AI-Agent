"""
Product ingestion script — fetches products from the Edible API
and embeds them into ChromaDB for vector similarity search.

Usage:
    python -m app.db.ingest                    # Default search terms
    python -m app.db.ingest --keywords "chocolate,fruit,birthday"
    python -m app.db.ingest --full             # Comprehensive 30+ keyword crawl
"""

import asyncio
import argparse
import logging
import sys
import os

# Add parent directory to path for module imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from dotenv import load_dotenv
load_dotenv()

from app.tools.edible_api import search_products
from app.db.embeddings import upsert_products, get_collection_count

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

# Search terms to bootstrap the vector DB with a diverse product catalog
DEFAULT_KEYWORDS = [
    "chocolate strawberries",
    "fruit arrangement",
    "birthday",
    "thank you",
    "sympathy",
    "valentines",
    "cake",
    "cookies",
    "gift basket",
    "corporate gift",
    "flowers",
    "get well",
    "anniversary",
    "congratulations",
    "new baby",
]

FULL_KEYWORDS = DEFAULT_KEYWORDS + [
    "graduation",
    "wedding",
    "holiday",
    "christmas",
    "easter",
    "mothers day",
    "fathers day",
    "halloween",
    "dipped fruit",
    "chocolate covered",
    "fruit bouquet",
    "edible box",
    "brownies",
    "treats",
    "snack",
    "party platter",
    "cheesecake",
    "apple",
    "pineapple",
    "melon",
    "berries",
]


async def ingest(keywords: list[str]) -> dict:
    """
    Fetch products for each keyword and upsert into ChromaDB.
    Returns stats about the ingestion.
    """
    all_products = {}
    total_fetched = 0

    logger.info(f"Starting ingestion with {len(keywords)} search terms...")

    for i, keyword in enumerate(keywords, 1):
        logger.info(f"[{i}/{len(keywords)}] Searching: '{keyword}'")
        products = await search_products(keyword)
        total_fetched += len(products)

        for p in products:
            if p.id not in all_products:
                all_products[p.id] = p

        logger.info(f"  → {len(products)} results ({len(all_products)} unique so far)")

        # Small delay to be nice to the API
        await asyncio.sleep(0.3)

    unique_products = list(all_products.values())
    logger.info(f"\nTotal fetched: {total_fetched} | Unique products: {len(unique_products)}")

    # Upsert into ChromaDB
    upserted = upsert_products(unique_products)
    final_count = get_collection_count()

    stats = {
        "keywords_searched": len(keywords),
        "total_fetched": total_fetched,
        "unique_products": len(unique_products),
        "upserted": upserted,
        "collection_total": final_count,
    }

    logger.info(f"✓ Ingestion complete! ChromaDB now has {final_count} products.")
    return stats


def main():
    parser = argparse.ArgumentParser(description="Ingest Edible products into ChromaDB")
    parser.add_argument(
        "--keywords",
        type=str,
        default=None,
        help="Comma-separated list of search keywords",
    )
    parser.add_argument(
        "--full",
        action="store_true",
        help="Use the full 30+ keyword list for comprehensive crawling",
    )
    args = parser.parse_args()

    if args.keywords:
        keywords = [k.strip() for k in args.keywords.split(",")]
    elif args.full:
        keywords = FULL_KEYWORDS
    else:
        keywords = DEFAULT_KEYWORDS

    stats = asyncio.run(ingest(keywords))
    print(f"\n{'='*50}")
    print("INGESTION SUMMARY")
    print(f"{'='*50}")
    for key, value in stats.items():
        print(f"  {key}: {value}")
    print(f"{'='*50}")


if __name__ == "__main__":
    main()
