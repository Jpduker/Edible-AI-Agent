"""
ChromaDB vector store for product embeddings.
Uses sentence-transformers for local embeddings (no API key needed).
"""

import os
import logging
from typing import Optional

import chromadb
from chromadb.config import Settings

from app.models.schemas import Product

logger = logging.getLogger(__name__)

CHROMA_PERSIST_DIR = os.getenv("CHROMA_PERSIST_DIR", "./chroma_data")
COLLECTION_NAME = "edible_products"


def get_chroma_client() -> chromadb.ClientAPI:
    """Get a persistent ChromaDB client."""
    return chromadb.PersistentClient(
        path=CHROMA_PERSIST_DIR,
        settings=Settings(anonymized_telemetry=False),
    )


def get_or_create_collection(client: chromadb.ClientAPI) -> chromadb.Collection:
    """Get or create the products collection."""
    return client.get_or_create_collection(
        name=COLLECTION_NAME,
        metadata={"hnsw:space": "cosine"},
    )


def product_to_document(product: Product) -> str:
    """
    Convert a Product into a text document optimized for embedding.
    Includes name, description, category, occasion, price, allergy info, ingredients.
    """
    parts = [
        f"Product: {product.name}",
        f"Price: {product.price_formatted}",
    ]
    if product.description:
        parts.append(f"Description: {product.description}")
    if product.category:
        parts.append(f"Category: {product.category}")
    if product.occasion:
        parts.append(f"Occasion: {product.occasion}")
    if product.allergy_info:
        parts.append(f"Allergy Info: {product.allergy_info}")
    if product.ingredients:
        parts.append(f"Ingredients: {product.ingredients}")
    if product.is_one_hour_delivery:
        parts.append("Delivery: Same-day delivery available")
    if product.product_image_tag:
        parts.append(f"Tag: {product.product_image_tag}")
    if product.size_count and product.size_count > 1:
        parts.append(f"Sizes: {product.size_count} size options available")
    if product.promo:
        parts.append(f"Promo: {product.promo}")

    return " | ".join(parts)


def product_to_metadata(product: Product) -> dict:
    """Convert Product fields to ChromaDB-compatible metadata (flat dict, primitives only)."""
    meta = {
        "name": product.name,
        "price": product.price,
        "price_formatted": product.price_formatted,
        "image_url": product.image_url,
        "thumbnail_url": product.thumbnail_url,
        "product_url": product.product_url,
        "description": product.description or "",
        "is_one_hour_delivery": product.is_one_hour_delivery,
    }
    if product.category:
        meta["category"] = product.category
    if product.occasion:
        meta["occasion"] = product.occasion
    if product.promo:
        meta["promo"] = product.promo
    if product.product_image_tag:
        meta["product_image_tag"] = product.product_image_tag
    if product.allergy_info:
        meta["allergy_info"] = product.allergy_info
    if product.ingredients:
        meta["ingredients"] = product.ingredients
    if product.size_count:
        meta["size_count"] = product.size_count

    return meta


def upsert_products(products: list[Product]) -> int:
    """
    Upsert products into ChromaDB.
    Returns the number of products upserted.
    """
    if not products:
        return 0

    client = get_chroma_client()
    collection = get_or_create_collection(client)

    ids = [p.id for p in products]
    documents = [product_to_document(p) for p in products]
    metadatas = [product_to_metadata(p) for p in products]

    collection.upsert(
        ids=ids,
        documents=documents,
        metadatas=metadatas,
    )

    logger.info(f"Upserted {len(products)} products into ChromaDB")
    return len(products)


def similarity_search(
    query: str,
    n_results: int = 10,
    max_price: Optional[float] = None,
    min_price: Optional[float] = None,
    delivery_filter: Optional[str] = None,
) -> list[Product]:
    """
    Search ChromaDB for products similar to the query text.
    Applies optional price and delivery filters via metadata WHERE clauses.
    """
    client = get_chroma_client()
    collection = get_or_create_collection(client)

    # Build where filter
    where_clauses: list[dict] = []

    if max_price is not None:
        where_clauses.append({"price": {"$lt": max_price}})
    if min_price is not None:
        where_clauses.append({"price": {"$gte": min_price}})

    # Delivery filtering via metadata
    if delivery_filter == "delivery":
        # Exclude pickup-only products
        where_clauses.append({"product_image_tag": {"$ne": "In-Store Pickup Only"}})
    elif delivery_filter == "pickup":
        where_clauses.append({"product_image_tag": {"$eq": "In-Store Pickup Only"}})

    where = None
    if len(where_clauses) == 1:
        where = where_clauses[0]
    elif len(where_clauses) > 1:
        where = {"$and": where_clauses}

    try:
        results = collection.query(
            query_texts=[query],
            n_results=n_results,
            where=where,
        )
    except Exception as e:
        logger.error(f"ChromaDB query failed: {e}")
        # Fallback: query without filters
        results = collection.query(
            query_texts=[query],
            n_results=n_results,
        )

    if not results or not results["metadatas"]:
        return []

    products: list[Product] = []
    for i, meta in enumerate(results["metadatas"][0]):
        product_id = results["ids"][0][i] if results["ids"] else str(i)
        products.append(Product(
            id=product_id,
            name=meta.get("name", "Unknown"),
            price=meta.get("price", 0.0),
            price_formatted=meta.get("price_formatted", "$0.00"),
            image_url=meta.get("image_url", ""),
            thumbnail_url=meta.get("thumbnail_url", ""),
            product_url=meta.get("product_url", ""),
            description=meta.get("description", ""),
            category=meta.get("category"),
            occasion=meta.get("occasion"),
            is_one_hour_delivery=meta.get("is_one_hour_delivery", False),
            promo=meta.get("promo"),
            product_image_tag=meta.get("product_image_tag"),
            allergy_info=meta.get("allergy_info"),
            ingredients=meta.get("ingredients"),
            size_count=meta.get("size_count"),
        ))

    return products


def get_collection_count() -> int:
    """Return the number of products in the ChromaDB collection."""
    try:
        client = get_chroma_client()
        collection = get_or_create_collection(client)
        return collection.count()
    except Exception:
        return 0
