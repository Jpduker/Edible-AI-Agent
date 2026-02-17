"""
Pydantic models — ported from edible-gift-concierge/src/lib/types.ts
"""

from pydantic import BaseModel, Field
from typing import Optional
from enum import Enum


class DeliveryFilter(str, Enum):
    DELIVERY = "delivery"
    PICKUP = "pickup"
    ANY = "any"


class Product(BaseModel):
    """Normalized product model used throughout the app."""
    id: str
    name: str
    price: float
    price_formatted: str
    image_url: str
    thumbnail_url: str
    product_url: str
    description: str
    category: Optional[str] = None
    occasion: Optional[str] = None
    is_one_hour_delivery: bool = False
    promo: Optional[str] = None
    product_image_tag: Optional[str] = None
    allergy_info: Optional[str] = None       # e.g. "Contains: Milk, Soy. May contain: Tree Nuts, Peanuts"
    ingredients: Optional[str] = None        # e.g. "Strawberries, Semisweet Chocolate, White Chocolate"
    size_count: Optional[int] = None         # Number of size variants


class SearchResult(BaseModel):
    """Raw result from the Edible Arrangements API."""
    search_score: Optional[float] = Field(None, alias="@search.score")
    id: Optional[str] = None
    name: Optional[str] = None
    description: Optional[str] = None
    minPrice: Optional[float] = None
    maxPrice: Optional[float] = None
    image: Optional[str] = None
    thumbnail: Optional[str] = None
    url: Optional[str] = None
    category: Optional[str] = None
    occasion: Optional[str] = None
    allergyinformation: Optional[str] = None
    ingrediantNames: Optional[str] = None    # Note: typo matches the API
    number: Optional[str] = None
    liveSku: Optional[bool] = None
    isOneHourDelivery: Optional[bool] = None
    productImageTag: Optional[str] = None
    promo: Optional[str] = None
    nonPromo: Optional[str] = None
    sizeCount: Optional[int] = None
    price: Optional[float] = None

    model_config = {"populate_by_name": True}


class Budget(BaseModel):
    min_val: Optional[float] = None
    max_val: Optional[float] = None
    raw: str


class GiftContext(BaseModel):
    """Gift context extracted from conversation — powers the sidebar."""
    recipient: Optional[str] = None
    recipient_name: Optional[str] = None
    occasion: Optional[str] = None
    budget: Optional[Budget] = None
    preferences: list[str] = Field(default_factory=list)
    dietary_needs: list[str] = Field(default_factory=list)
    delivery_zip: Optional[str] = None
    delivery_date: Optional[str] = None
    tone: Optional[str] = None


class ChatMessage(BaseModel):
    """A single chat message from the frontend."""
    role: str  # "user" or "assistant"
    content: str


class ChatRequest(BaseModel):
    """Incoming chat request from the frontend."""
    messages: list[ChatMessage]


class SearchToolInput(BaseModel):
    """Input schema for the search_products tool."""
    keyword: str = Field(description="Search keyword or short phrase")
    max_price: Optional[float] = Field(None, description="Strict maximum price filter")
    min_price: Optional[float] = Field(None, description="Strict minimum price filter")
    zip_code: Optional[str] = Field(None, description="Recipient ZIP code")
    delivery_filter: DeliveryFilter = Field(
        DeliveryFilter.ANY,
        description="Filter by delivery type: 'delivery' excludes pickup-only, 'pickup' for in-store only"
    )


class SimilarToolInput(BaseModel):
    """Input schema for the find_similar_products tool."""
    product_name: str = Field(description="Name of the product the user likes")
    attributes: str = Field(description="Key attributes: category, flavor, price range, occasion")
    max_price: Optional[float] = Field(None, description="Strict maximum price")
    min_price: Optional[float] = Field(None, description="Strict minimum price")
    zip_code: Optional[str] = Field(None, description="Recipient ZIP code")
    delivery_filter: DeliveryFilter = Field(
        DeliveryFilter.ANY,
        description="Filter by delivery type"
    )
