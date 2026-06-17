Sunny Shop — Simple Frontend Demo

This is a small static frontend demo (HTML/CSS/JS) with product listing, cart, register and login pages. It's frontend-only and uses localStorage for demo data (not secure).

Backend:

- A FastAPI backend is now available in `backend/`.
- It can run with demo in-memory data or with Supabase by setting environment variables.
- See `backend/README.md` and `backend/supabase.sql` for setup.

How to run:

- Open `index.html` in your browser.
- Or serve the folder with a static server, e.g. `python -m http.server` from the `ecommerce` folder.

Notes:
- Users and cart are saved in `localStorage` keys: `ss_users`, `ss_cart`, `ss_current`.
- This is intended as a demo; do not use client-side auth in production.