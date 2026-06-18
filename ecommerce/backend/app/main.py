from __future__ import annotations

from pathlib import Path
import logging
import os
from typing import Any
from uuid import uuid4

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

try:
    from supabase import create_client
except Exception:  # pragma: no cover - optional dependency at build time
    create_client = None


LOGGER = logging.getLogger("sunny-shop-api")


def load_env_file(file_path: str) -> None:
    if not os.path.exists(file_path):
        return

    with open(file_path, "r", encoding="utf-8") as env_file:
        for raw_line in env_file:
            line = raw_line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue

            key, value = line.split("=", 1)
            key = key.strip()
            value = value.strip().strip('"').strip("'")
            if key and key not in os.environ:
                os.environ[key] = value


PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
BACKEND_DIR = PROJECT_ROOT / "backend"
load_env_file(str(BACKEND_DIR / ".env"))
load_env_file(str(BACKEND_DIR / ".env.example"))

DEMO_PRODUCTS: list[dict[str, Any]] = [
    {
        "id": 1,
        "name": "Midnight Alloy Wheels",
        "description": "Premium-looking alloy wheels for a sharper stance.",
        "price": 15999,
        "image_url": "https://commons.wikimedia.org/wiki/Special:FilePath/Ferrari_599_HY_KERS_wheel.jpg",
        "category": "exterior",
        "active": True,
    },
    {
        "id": 2,
        "name": "Carbon Grip Steering Cover",
        "description": "Comfortable grip with a sporty cabin feel.",
        "price": 2499,
        "image_url": "https://commons.wikimedia.org/wiki/Special:FilePath/Old_car_steering_wheel_(2662480818).jpg",
        "category": "interior",
        "active": True,
    },
    {
        "id": 3,
        "name": "Amber LED Headlight Kit",
        "description": "Brighter lighting for night drives and road visibility.",
        "price": 6799,
        "image_url": "https://commons.wikimedia.org/wiki/Special:FilePath/2007_GMC_Yukon_XL_Headlights.jpg",
        "category": "lighting",
        "active": True,
    },
    {
        "id": 4,
        "name": "Cruise Comfort Seat Cushions",
        "description": "Soft support for longer drives.",
        "price": 3299,
        "image_url": "https://commons.wikimedia.org/wiki/Special:FilePath/Interior_del_SEAT_Ibiza_IV_Restyling.JPG",
        "category": "interior",
        "active": True,
    },
    {
        "id": 5,
        "name": "RoadGuard Car Vacuum Pro",
        "description": "Compact interior cleaning for everyday use.",
        "price": 4599,
        "image_url": "https://commons.wikimedia.org/wiki/Special:FilePath/Automobile_vacuum,_Walkerville,_Windsor,_Ontario,_2025-09-01.jpg",
        "category": "cleaning",
        "active": True,
    },
    {
        "id": 6,
        "name": "Velocity Dash Organizer",
        "description": "Keeps the cabin tidy and essentials within reach.",
        "price": 1899,
        "image_url": "https://commons.wikimedia.org/wiki/Special:FilePath/Ursulines_Street_French_Quarter_Aug_2009_Jeep_Dashboard.JPG",
        "category": "interior",
        "active": True,
    },
]


class CartItemCreate(BaseModel):
    product_id: int = Field(..., ge=1)
    quantity: int = Field(1, ge=1)


class CartItemUpdate(BaseModel):
    quantity: int = Field(..., ge=1)


class AuthPayload(BaseModel):
    email: str
    password: str
    full_name: str | None = None


class ProfilePayload(BaseModel):
    full_name: str | None = None
    avatar_url: str | None = None


class CheckoutPayload(BaseModel):
    payment_method: str = Field(default="cod")
    address: str | None = None


app = FastAPI(title="Sunny Shop API", version="1.0.0")

frontend_origins = [
    origin.strip()
    for origin in os.getenv(
        "FRONTEND_ORIGINS",
        "http://127.0.0.1:8000,http://localhost:8000,http://localhost:5500,http://127.0.0.1:5500",
    ).split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

SUPABASE_URL = os.getenv("SUPABASE_URL", "").strip()
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", os.getenv("SUPABASE_KEY", "")).strip()
SUPABASE_ENABLED = bool(SUPABASE_URL and SUPABASE_KEY and create_client)
SUPABASE = create_client(SUPABASE_URL, SUPABASE_KEY) if SUPABASE_ENABLED else None

MEMORY_USERS: dict[str, dict[str, Any]] = {}
MEMORY_CARTS: dict[str, list[dict[str, Any]]] = {}
MEMORY_PROFILES: dict[str, dict[str, Any]] = {}
MEMORY_ORDERS: dict[str, list[dict[str, Any]]] = {}


def normalize_product(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": int(row["id"]),
        "name": row["name"],
        "description": row.get("description", ""),
        "price": float(row["price"]),
        "image_url": row.get("image_url"),
        "category": row.get("category", "car"),
        "active": bool(row.get("active", True)),
    }


def list_products() -> list[dict[str, Any]]:
    if SUPABASE is not None:
        try:
            response = SUPABASE.table("products").select("*").eq("active", True).order("id").execute()
            rows = response.data or []
            if rows:
                return [normalize_product(row) for row in rows]
        except Exception as exc:  # pragma: no cover - runtime/network dependent
            LOGGER.warning("Falling back to demo products: %s", exc)
    return [product.copy() for product in DEMO_PRODUCTS]


def find_product(product_id: int) -> dict[str, Any] | None:
    for product in list_products():
        if int(product["id"]) == int(product_id):
            return product
    return None


def cart_storage(user_id: str) -> list[dict[str, Any]]:
    return MEMORY_CARTS.setdefault(user_id, [])


def build_cart_response(user_id: str) -> dict[str, Any]:
    products_by_id = {int(product["id"]): product for product in list_products()}

    if SUPABASE is not None:
        try:
            response = SUPABASE.table("cart_items").select("*").eq("user_id", user_id).order("created_at").execute()
            rows = response.data or cart_storage(user_id)
        except Exception as exc:  # pragma: no cover - runtime/network dependent
            LOGGER.warning("Using in-memory cart fallback: %s", exc)
            rows = cart_storage(user_id)
    else:
        rows = cart_storage(user_id)

    items: list[dict[str, Any]] = []
    total = 0.0

    for row in rows:
        product_id = int(row["product_id"])
        product = products_by_id.get(product_id)
        if not product:
            continue

        quantity = int(row["quantity"])
        price = float(product["price"])
        subtotal = round(price * quantity, 2)
        total += subtotal

        items.append(
            {
                "id": row["id"],
                "user_id": user_id,
                "product_id": product_id,
                "name": product["name"],
                "image_url": product.get("image_url"),
                "price": price,
                "quantity": quantity,
                "subtotal": subtotal,
            }
        )

    return {"user_id": user_id, "items": items, "total": round(total, 2)}


def get_profile(user_id: str) -> dict[str, Any] | None:
    if SUPABASE is not None:
        try:
            response = SUPABASE.table("profiles").select("*").eq("id", user_id).limit(1).execute()
            rows = response.data or []
            if rows:
                return rows[0]
        except Exception as exc:
            LOGGER.warning("Using in-memory profiles fallback: %s", exc)

    return MEMORY_PROFILES.get(user_id)


def upsert_profile(user_id: str, payload: ProfilePayload) -> dict[str, Any]:
    if SUPABASE is not None:
        try:
            existing = SUPABASE.table("profiles").select("*").eq("id", user_id).limit(1).execute().data or []
            if existing:
                updated = SUPABASE.table("profiles").update({"full_name": payload.full_name, "avatar_url": payload.avatar_url}).eq("id", user_id).execute()
                return (updated.data or [existing[0]])[0]
            else:
                insert_payload = {"id": user_id, "full_name": payload.full_name, "avatar_url": payload.avatar_url}
                inserted = SUPABASE.table("profiles").insert(insert_payload).execute()
                return (inserted.data or [insert_payload])[0]
        except Exception as exc:
            LOGGER.warning("Using in-memory profiles write fallback: %s", exc)

    # in-memory fallback
    MEMORY_PROFILES.setdefault(user_id, {})
    if payload.full_name is not None:
        MEMORY_PROFILES[user_id]["full_name"] = payload.full_name
    if payload.avatar_url is not None:
        MEMORY_PROFILES[user_id]["avatar_url"] = payload.avatar_url
    return MEMORY_PROFILES[user_id]


def order_storage(user_id: str) -> list[dict[str, Any]]:
    return MEMORY_ORDERS.setdefault(user_id, [])


def list_orders(user_id: str) -> list[dict[str, Any]]:
    if SUPABASE is not None:
        try:
            response = SUPABASE.table("orders").select("*").eq("user_id", user_id).order("created_at", desc=True).execute()
            return response.data or order_storage(user_id)
        except Exception as exc:
            LOGGER.warning("Using in-memory orders fallback: %s", exc)
    return order_storage(user_id)


def create_order(user_id: str, payload: CheckoutPayload) -> dict[str, Any]:
    cart = build_cart_response(user_id)
    if not cart["items"]:
        raise HTTPException(status_code=400, detail="Cart is empty")

    order = {
        "id": str(uuid4()),
        "user_id": user_id,
        "items": cart["items"],
        "total": cart["total"],
        "payment_method": payload.payment_method,
        "address": payload.address,
        "status": "paid" if payload.payment_method != "cod" else "pending",
    }

    if SUPABASE is not None:
        try:
            inserted = SUPABASE.table("orders").insert(order).execute()
            order = (inserted.data or [order])[0]
        except Exception as exc:
            LOGGER.warning("Using in-memory order write fallback: %s", exc)
            order_storage(user_id).append(order)
    else:
        order_storage(user_id).append(order)

    # clear cart after checkout
    if SUPABASE is not None:
        try:
            SUPABASE.table("cart_items").delete().eq("user_id", user_id).execute()
        except Exception as exc:
            LOGGER.warning("Could not clear cart in Supabase: %s", exc)
    MEMORY_CARTS.pop(user_id, None)

    return order


def upsert_cart_item(user_id: str, payload: CartItemCreate) -> dict[str, Any]:
    product = find_product(payload.product_id)
    if product is None:
        raise HTTPException(status_code=404, detail="Product not found")

    if SUPABASE is not None:
        try:
            response = (
                SUPABASE.table("cart_items")
                .select("*")
                .eq("user_id", user_id)
                .eq("product_id", payload.product_id)
                .limit(1)
                .execute()
            )
            existing = (response.data or [None])[0]

            if existing:
                new_quantity = int(existing["quantity"]) + int(payload.quantity)
                updated = (
                    SUPABASE.table("cart_items")
                    .update({"quantity": new_quantity})
                    .eq("id", existing["id"])
                    .execute()
                )
                row = (updated.data or [existing])[0]
            else:
                insert_payload = {
                    "id": str(uuid4()),
                    "user_id": user_id,
                    "product_id": payload.product_id,
                    "quantity": payload.quantity,
                }
                inserted = SUPABASE.table("cart_items").insert(insert_payload).execute()
                row = (inserted.data or [insert_payload])[0]
        except Exception as exc:  # pragma: no cover - runtime/network dependent
            LOGGER.warning("Using in-memory cart write fallback: %s", exc)
            row = None
    else:
        row = None

    if row is None:
        cart = cart_storage(user_id)
        existing = next((item for item in cart if int(item["product_id"]) == payload.product_id), None)
        if existing:
            existing["quantity"] += payload.quantity
            row = existing
        else:
            row = {
                "id": str(uuid4()),
                "user_id": user_id,
                "product_id": payload.product_id,
                "quantity": payload.quantity,
            }
            cart.append(row)

    return {
        "id": row["id"],
        "user_id": user_id,
        "product_id": int(row["product_id"]),
        "name": product["name"],
        "price": float(product["price"]),
        "quantity": int(row["quantity"]),
        "subtotal": round(float(product["price"]) * int(row["quantity"]), 2),
    }


def update_cart_item(user_id: str, item_id: str, payload: CartItemUpdate) -> dict[str, Any]:
    if SUPABASE is not None:
        try:
            response = SUPABASE.table("cart_items").select("*").eq("id", item_id).eq("user_id", user_id).limit(1).execute()
            existing = (response.data or [None])[0]
            if existing is None:
                raise HTTPException(status_code=404, detail="Cart item not found")

            updated = (
                SUPABASE.table("cart_items")
                .update({"quantity": payload.quantity})
                .eq("id", item_id)
                .execute()
            )
            row = (updated.data or [existing])[0]
        except HTTPException:
            raise
        except Exception as exc:  # pragma: no cover - runtime/network dependent
            LOGGER.warning("Using in-memory cart update fallback: %s", exc)
            row = None
    else:
        row = None

    if row is None:
        cart = cart_storage(user_id)
        existing = next((item for item in cart if str(item["id"]) == item_id), None)
        if existing is None:
            raise HTTPException(status_code=404, detail="Cart item not found")
        existing["quantity"] = payload.quantity
        row = existing

    product = find_product(int(row["product_id"]))
    if product is None:
        raise HTTPException(status_code=404, detail="Product not found")

    return {
        "id": row["id"],
        "user_id": user_id,
        "product_id": int(row["product_id"]),
        "name": product["name"],
        "price": float(product["price"]),
        "quantity": int(row["quantity"]),
        "subtotal": round(float(product["price"]) * int(row["quantity"]), 2),
    }


def delete_cart_item(user_id: str, item_id: str) -> dict[str, Any]:
    if SUPABASE is not None:
        try:
            response = SUPABASE.table("cart_items").select("*").eq("id", item_id).eq("user_id", user_id).limit(1).execute()
            existing = (response.data or [None])[0]
            if existing is None:
                raise HTTPException(status_code=404, detail="Cart item not found")
            SUPABASE.table("cart_items").delete().eq("id", item_id).execute()
            return {"deleted": True, "id": item_id}
        except HTTPException:
            raise
        except Exception as exc:  # pragma: no cover - runtime/network dependent
            LOGGER.warning("Using in-memory cart delete fallback: %s", exc)

    cart = cart_storage(user_id)
    original_length = len(cart)
    cart[:] = [item for item in cart if str(item["id"]) != item_id]
    if len(cart) == original_length:
        raise HTTPException(status_code=404, detail="Cart item not found")
    return {"deleted": True, "id": item_id}


@app.get("/health")
def health() -> dict[str, Any]:
    return {"status": "ok", "supabase_enabled": SUPABASE_ENABLED}


@app.get("/products")
def get_products() -> list[dict[str, Any]]:
    return list_products()


@app.get("/cart/{user_id}")
def get_cart(user_id: str) -> dict[str, Any]:
    return build_cart_response(user_id)


@app.post("/cart/{user_id}/items")
def add_cart_item(user_id: str, payload: CartItemCreate) -> dict[str, Any]:
    return upsert_cart_item(user_id, payload)


@app.patch("/cart/{user_id}/items/{item_id}")
def patch_cart_item(user_id: str, item_id: str, payload: CartItemUpdate) -> dict[str, Any]:
    return update_cart_item(user_id, item_id, payload)


@app.delete("/cart/{user_id}/items/{item_id}")
def remove_cart_item(user_id: str, item_id: str) -> dict[str, Any]:
    return delete_cart_item(user_id, item_id)


@app.post("/auth/register")
def register(payload: AuthPayload) -> dict[str, Any]:
    if SUPABASE is not None:
        try:
            result = SUPABASE.auth.sign_up({"email": payload.email, "password": payload.password})
            user = getattr(result, "user", None)
            return {
                "registered": True,
                "user_id": getattr(user, "id", None),
                "email": getattr(user, "email", payload.email),
                "mode": "auth_signup",
            }
        except Exception as exc:  # pragma: no cover - runtime/network dependent
            LOGGER.warning("Falling back to admin create_user for register: %s", exc)
            admin_result = SUPABASE.auth.admin.create_user(
                {
                    "email": payload.email,
                    "password": payload.password,
                    "email_confirm": True,
                    "user_metadata": {"full_name": payload.full_name} if payload.full_name else {},
                }
            )
            user = getattr(admin_result, "user", None)
            return {
                "registered": True,
                "user_id": getattr(user, "id", None),
                "email": getattr(user, "email", payload.email),
                "mode": "admin_create_user",
            }

    if payload.email in MEMORY_USERS:
        raise HTTPException(status_code=400, detail="Email already registered")

    MEMORY_USERS[payload.email] = {
        "email": payload.email,
        "password": payload.password,
        "full_name": payload.full_name,
    }
    return {"registered": True, "email": payload.email, "mode": "memory"}


@app.post("/auth/login")
def login(payload: AuthPayload) -> dict[str, Any]:
    if SUPABASE is not None:
        result = SUPABASE.auth.sign_in_with_password({"email": payload.email, "password": payload.password})
        user = getattr(result, "user", None)
        session = getattr(result, "session", None)
        return {
            "authenticated": True,
            "user_id": getattr(user, "id", None),
            "email": getattr(user, "email", payload.email),
            "access_token": getattr(session, "access_token", None),
            "refresh_token": getattr(session, "refresh_token", None),
        }

    user = MEMORY_USERS.get(payload.email)
    if not user or user["password"] != payload.password:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    return {
        "authenticated": True,
        "email": payload.email,
        "mode": "memory",
    }


@app.get("/profiles/{user_id}")
def http_get_profile(user_id: str) -> dict[str, Any]:
    profile = get_profile(user_id)
    if profile is None:
        raise HTTPException(status_code=404, detail="Profile not found")
    return profile


@app.put("/profiles/{user_id}")
def http_upsert_profile(user_id: str, payload: ProfilePayload) -> dict[str, Any]:
    return upsert_profile(user_id, payload)


@app.get("/orders/{user_id}")
def http_get_orders(user_id: str) -> list[dict[str, Any]]:
    return list_orders(user_id)


@app.post("/checkout/{user_id}")
def http_checkout(user_id: str, payload: CheckoutPayload) -> dict[str, Any]:
    return create_order(user_id, payload)

# --- Static File Serving ---

# Mount CSS and JS directories
app.mount("/css", StaticFiles(directory=PROJECT_ROOT / "css"), name="css")
app.mount("/js", StaticFiles(directory=PROJECT_ROOT / "js"), name="js")

@app.get("/")
async def serve_index():
    return FileResponse(PROJECT_ROOT / "index.html")

@app.get("/{page_name}.html")
async def serve_html_pages(page_name: str):
    file_path = PROJECT_ROOT / f"{page_name}.html"
    if file_path.exists():
        return FileResponse(file_path)
    raise HTTPException(status_code=404, detail="Page not found")

# Catch-all for sub-assets if necessary (optional)
@app.get("/{filename}")
async def serve_root_files(filename: str):
    file_path = PROJECT_ROOT / filename
    if file_path.exists() and file_path.is_file():
        return FileResponse(file_path)
    # Do not raise 404 here to let API routes work
