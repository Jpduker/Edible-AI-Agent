"""
Edible Arrangements API client — ported from edible-api.ts
Async HTTP client with in-memory TTL cache.
"""

import asyncio
import time
import logging
from typing import Optional

import httpx

from app.models.schemas import Product, SearchResult

logger = logging.getLogger(__name__)

EDIBLE_BASE_URL = "https://www.ediblearrangements.com"
EDIBLE_API_URL = f"{EDIBLE_BASE_URL}/api/search/"

# ─── In-Memory Search Cache (TTL: 2 minutes) ───
CACHE_TTL_SECONDS = 120
MAX_CACHE_SIZE = 100

_search_cache: dict[str, tuple[list[Product], float]] = {}


def _cache_key(keyword: str, zip_code: Optional[str] = None) -> str:
    return f"{keyword.lower().strip()}|{zip_code or ''}"


def _get_cached(keyword: str, zip_code: Optional[str] = None) -> Optional[list[Product]]:
    key = _cache_key(keyword, zip_code)
    entry = _search_cache.get(key)
    if entry is None:
        return None
    products, timestamp = entry
    if time.time() - timestamp > CACHE_TTL_SECONDS:
        del _search_cache[key]
        return None
    logger.info(f'Cache HIT for "{keyword}" ({len(products)} products)')
    return products


def _set_cached(keyword: str, zip_code: Optional[str], products: list[Product]) -> None:
    key = _cache_key(keyword, zip_code)
    _search_cache[key] = (products, time.time())

    # Evict oldest if cache too large
    if len(_search_cache) > MAX_CACHE_SIZE:
        oldest_key = next(iter(_search_cache))
        del _search_cache[oldest_key]


def normalize_product(raw: SearchResult) -> Product:
    """Convert a raw Edible API result into our normalized Product model."""
    product_url = (
        f"{EDIBLE_BASE_URL}/fruit-gifts/{raw.url}"
        if raw.url
        else EDIBLE_BASE_URL
    )

    image_url = raw.image or raw.thumbnail or ""
    product_id = str(raw.id or raw.number or id(raw))
    price = raw.minPrice or raw.maxPrice or raw.price or 0.0

    return Product(
        id=product_id,
        name=raw.name or "Edible Arrangement",
        price=round(price, 2),
        price_formatted=f"${price:.2f}",
        image_url=image_url,
        thumbnail_url=raw.thumbnail or image_url,
        product_url=product_url,
        description=raw.description or "",
        category=raw.category or None,
        occasion=raw.occasion or None,
        is_one_hour_delivery=raw.isOneHourDelivery or False,
        promo=raw.promo or None,
        product_image_tag=raw.productImageTag or None,
        allergy_info=raw.allergyinformation or None,
        ingredients=raw.ingrediantNames or None,
        size_count=raw.sizeCount or None,
    )


async def search_products(keyword: str, zip_code: Optional[str] = None) -> list[Product]:
    """
    Search the Edible Arrangements API.
    Returns normalized Product list with caching.
    """
    # Check cache
    cached = _get_cached(keyword, zip_code)
    if cached is not None:
        return cached

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                EDIBLE_API_URL,
                json={"keyword": keyword, "zipCode": zip_code},
                headers={
                    "Content-Type": "application/json",
                    "Accept": "application/json",
                    "User-Agent": "EdibleGiftConcierge/2.0",
                },
            )

            if response.status_code >= 400:
                logger.error(f"Edible API returned status {response.status_code}")
                return []

            data = response.json()

            if not isinstance(data, list):
                logger.error(f"Unexpected response format: {type(data)}")
                return []

            products = [
                normalize_product(SearchResult(**item))
                for item in data
                if item.get("liveSku") is not False
            ]

            _set_cached(keyword, zip_code, products)

            logger.info(f'Search "{keyword}" returned {len(products)} products')
            return products

    except httpx.TimeoutException:
        logger.error(f"Timeout searching for '{keyword}'")
        return []
    except Exception as e:
        logger.error(f"Error searching products: {e}")
        return []


async def search_products_parallel(keywords: list[str], zip_code: Optional[str] = None) -> dict[str, list[Product]]:
    """Search multiple keywords in parallel. Returns {keyword: [products]}."""
    tasks = {kw: search_products(kw, zip_code) for kw in keywords}
    results = await asyncio.gather(*tasks.values())
    return dict(zip(tasks.keys(), results))
