# Sunny Shop Backend

FastAPI backend for the Sunny Shop ecommerce demo, with optional Supabase support for products, carts, and auth.

## Run locally

1. Create a virtual environment and install dependencies from `requirements.txt`.
2. Set `SUPABASE_URL` and either `SUPABASE_SERVICE_ROLE_KEY` or `SUPABASE_KEY` if you want real Supabase storage.
3. From the `backend` folder, run:

```bash
uvicorn app.main:app --reload --host 127.0.0.1 --port 8001
```

## API

- `GET /health`
- `GET /products`
- `GET /cart/{user_id}`
- `POST /cart/{user_id}/items`
- `PATCH /cart/{user_id}/items/{item_id}`
- `DELETE /cart/{user_id}/items/{item_id}`
- `POST /auth/register`
- `POST /auth/login`

## Supabase

Apply `supabase.sql` to your database to create the tables and seed the car products.
