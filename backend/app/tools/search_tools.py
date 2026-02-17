"""
LangChain tools for the Edible Gift Concierge.
Ported from route.ts tool definitions — now with vector DB similarity search.
"""

import logging
from typing import Optional

from langchain_core.tools import tool

from app.tools.edible_api import search_products
from app.db.embeddings import similarity_search
from app.models.schemas import Product, DeliveryFilter

logger = logging.getLogger(__name__)

# ─── Constants ───
MAX_PRODUCTS_PER_SEARCH = 15
MAX_PRODUCTS_PER_SIMILARITY = 10


def _apply_delivery_filter(products: list[Product], delivery_filter: str) -> list[Product]:
    """Server-side delivery type filtering."""
    if delivery_filter == "delivery":
        return [
            p for p in products
            if not (p.product_image_tag or "").lower().__contains__("in-store")
            and not (p.product_image_tag or "").lower().__contains__("pickup only")
        ]
    elif delivery_filter == "pickup":
        return [
            p for p in products
            if "in-store" in (p.product_image_tag or "").lower()
            or "pickup" in (p.product_image_tag or "").lower()
        ]
    return products


def _product_to_dict(p: Product) -> dict:
    """Convert Product to a dict for the LLM tool response."""
    return {
        "id": p.id,
        "name": p.name,
        "price": p.price,
        "priceFormatted": p.price_formatted,
        "description": p.description,
        "productUrl": p.product_url,
        "imageUrl": p.image_url,
        "category": p.category,
        "occasion": p.occasion,
        "isOneHourDelivery": p.is_one_hour_delivery,
        "promo": p.promo,
        "productImageTag": p.product_image_tag,
        "allergyInfo": p.allergy_info,
        "ingredients": p.ingredients,
        "sizeCount": p.size_count,
    }


@tool
async def search_products_tool(
    keyword: str,
    max_price: Optional[float] = None,
    min_price: Optional[float] = None,
    zip_code: Optional[str] = None,
    delivery_filter: str = "any",
) -> dict:
    """Search the Edible Arrangements product catalog by keyword. Returns products with names, prices, descriptions, images, and direct product page URLs. Use this tool whenever you need to find or recommend products. You can call this tool multiple times with different keywords to get diverse results. NEVER recommend products without first searching for them using this tool. IMPORTANT: When the user specifies a budget, you MUST set max_price. When the user asks for premium/upscale options, you MUST set min_price. DELIVERY: When the user asks for delivery/shipping/same-day options, you MUST set delivery_filter to 'delivery' to exclude in-store pickup only items. MULTI-CATEGORY: When the user requests multiple distinct product types (e.g., 'cakes and flowers'), make SEPARATE tool calls for each category — never combine them into a single keyword."""

    logger.info(f"search_products_tool: keyword='{keyword}', max_price={max_price}, min_price={min_price}, delivery_filter={delivery_filter}")

    try:
        products = await search_products(keyword, zip_code)

        # STRICT server-side price filtering
        if max_price is not None:
            products = [p for p in products if p.price < max_price]
        if min_price is not None:
            products = [p for p in products if p.price >= min_price]

        # Delivery filtering
        products = _apply_delivery_filter(products, delivery_filter)

        if not products:
            price_info = f" under ${max_price}" if max_price else (f" above ${min_price}" if min_price else "")
            delivery_info = " with delivery available" if delivery_filter == "delivery" else (" for in-store pickup" if delivery_filter == "pickup" else "")
            return {
                "success": False,
                "message": f'No products found for "{keyword}"{price_info}{delivery_info}. Try a different search term or adjust the filters.',
                "products": [],
                "appliedFilters": {"maxPrice": max_price, "minPrice": min_price, "deliveryFilter": delivery_filter},
            }

        top_products = [_product_to_dict(p) for p in products[:MAX_PRODUCTS_PER_SEARCH]]

        logger.info(f"search_products_tool: '{keyword}' returned {len(top_products)} results")

        return {
            "success": True,
            "keyword": keyword,
            "resultCount": len(products),
            "products": top_products,
            "appliedFilters": {"maxPrice": max_price, "minPrice": min_price, "deliveryFilter": delivery_filter},
        }

    except Exception as e:
        logger.error(f"search_products_tool error: {e}")
        return {
            "success": False,
            "message": f'I had trouble searching for "{keyword}". The product catalog might be temporarily unavailable.',
            "products": [],
        }


@tool
async def find_similar_products_tool(
    product_name: str,
    attributes: str,
    max_price: Optional[float] = None,
    min_price: Optional[float] = None,
    zip_code: Optional[str] = None,
    delivery_filter: str = "any",
) -> dict:
    """Find products similar to one the user already likes using vector similarity search. Use this when a user says they like a specific product but want alternatives, or asks for 'something similar' or 'more like this.' IMPORTANT: When the user asks for 'premium' or 'more upscale' versions, set min_price to the original product's price. When the user says 'under $X' or specifies a budget, set max_price to X."""

    logger.info(f"find_similar_products_tool: product='{product_name}', attrs='{attributes}'")

    try:
        # Build a rich query for vector search
        query = f"{product_name} {attributes}"

        # ── PRIMARY: Vector similarity search via ChromaDB ──
        vector_results = similarity_search(
            query=query,
            n_results=MAX_PRODUCTS_PER_SIMILARITY + 5,  # fetch extra to allow filtering
            max_price=max_price,
            min_price=min_price,
            delivery_filter=delivery_filter if delivery_filter != "any" else None,
        )

        # ── FALLBACK: Also search the live API for fresh results ──
        attr_keywords = " ".join(
            a.strip() for a in attributes.split(",")
            if not a.strip().startswith("$")
        )[:3]
        api_results = await search_products(attr_keywords, zip_code)

        # Merge: vector results first (higher relevance), then API results
        seen = set()
        original_lower = product_name.lower()
        merged: list[Product] = []

        for p in vector_results + api_results:
            name_lower = p.name.lower()
            if name_lower in seen or name_lower == original_lower:
                continue
            seen.add(name_lower)
            merged.append(p)

        # Price filtering (API results may not have been filtered)
        if max_price is not None:
            merged = [p for p in merged if p.price <= max_price]
        if min_price is not None:
            merged = [p for p in merged if p.price >= min_price]

        # Delivery filtering
        merged = _apply_delivery_filter(merged, delivery_filter)

        if not merged:
            price_info = f" under ${max_price}" if max_price else (f" above ${min_price}" if min_price else "")
            delivery_info = " with delivery available" if delivery_filter == "delivery" else ""
            return {
                "success": False,
                "message": f'I couldn\'t find similar products to "{product_name}"{price_info}{delivery_info}. Let me try a different search approach.',
                "originalProduct": product_name,
                "products": [],
                "appliedFilters": {"maxPrice": max_price, "minPrice": min_price, "deliveryFilter": delivery_filter},
            }

        top_products = [_product_to_dict(p) for p in merged[:MAX_PRODUCTS_PER_SIMILARITY]]

        logger.info(f"find_similar_products_tool: '{product_name}' → {len(top_products)} results (vector: {len(vector_results)}, api: {len(api_results)})")

        return {
            "success": True,
            "originalProduct": product_name,
            "searchedAttributes": attributes,
            "resultCount": len(merged),
            "products": top_products,
            "appliedFilters": {"maxPrice": max_price, "minPrice": min_price, "deliveryFilter": delivery_filter},
            "searchStrategy": {
                "vectorResults": len(vector_results),
                "apiResults": len(api_results),
                "merged": len(merged),
            },
        }

    except Exception as e:
        logger.error(f"find_similar_products_tool error: {e}")
        return {
            "success": False,
            "message": "I had trouble finding similar products. Let me try a regular search instead.",
            "originalProduct": product_name,
            "products": [],
        }


def get_tools():
    """Return the list of LangChain tools for the agent."""
    return [search_products_tool, find_similar_products_tool]
