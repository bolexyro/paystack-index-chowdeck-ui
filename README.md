# Chowdeck UI on Paystack Index

Paystack Index makes it possible to order from services like Chowdeck through
ChatGPT and other agent hosts. I wanted to see what I was actually ordering —
not just read a list of items in chat — so I built this focused, composable UI
layer on top of it.

The agent narrows live restaurant data into a small visual shortlist, then
composes the right surface for the next decision: restaurant cards, filtered
menu-item cards, basket, approval, OTP, or tracking.

This is an independent interface powered by Paystack Index and Chowdeck. It is not an official Chowdeck client.

## Safety model

- Browse and menu tools are read-only.
- Previewing an order can fetch required options and totals, but cannot approve payment.
- The confirmation tool accepts only a one-time, server-issued token tied to the exact upstream preview.
- Confirmation tokens expire after ten minutes and are consumed after one attempt.
- Tests never place real orders.

## Local setup

### Prerequisites

- Docker Desktop with Docker Compose v2
- A Paystack Index OAuth client pair from the Index dashboard
- An HTTPS tunnel only if you want to connect the local server to ChatGPT/Codex

1. Copy the example environment file:

   ```sh
   cp .env.example .env
   ```

   In PowerShell, use `Copy-Item .env.example .env` instead.

2. Set `PAYSTACK_INDEX_CLIENT_ID` and `PAYSTACK_INDEX_CLIENT_SECRET` in `.env`.
   The adapter uses the client-credentials flow with the `mcp:transact` scope and
   calls the upstream URLs in `PAYSTACK_INDEX_MCP_URL` and
   `PAYSTACK_INDEX_TOKEN_URL`. Keep `.env` private; it is ignored by Git.

3. Build and start the app:

   ```sh
   docker compose up --build -d
   ```

4. Verify the local server and inspect logs when needed:

   ```sh
   curl http://localhost:8787/health
   docker compose logs -f app
   ```

   The MCP endpoint is `http://localhost:8787/mcp`.

5. Stop the app with `docker compose down` when you are finished.

### Connect the local app to ChatGPT/Codex

The adapter's `/mcp` endpoint does **not** implement OAuth for the ChatGPT
connector. Paystack Index OAuth happens inside the adapter using the values in
`.env`.

1. Expose `http://localhost:8787/mcp` through an HTTPS tunnel. Your public URL
   must end in `/mcp`.
2. In ChatGPT/Codex, create a custom MCP/connector using **Server URL** and
   choose **No authentication**. Do not choose OAuth for this adapter.
3. Paste the HTTPS `/mcp` URL, accept the custom-server warning, and save it.
4. Start a fresh chat and try: “Find nearby Chowdeck restaurants and show the
   options in the UI.”

Only the public tunnel URL is entered in ChatGPT/Codex. Never paste the
Paystack client secret into the connector form or commit it to the repository.

## Commands

```sh
docker compose build
docker build --target build -t index-chowdeck-ui-build .
docker run --rm --entrypoint npm index-chowdeck-ui-build test
```

The build-stage image includes the development test runner; the runtime image intentionally contains only production dependencies. The widget uses sample content when opened directly through Vite, so the visual layout can be developed without touching a real account or order.

The UI test covers the core interaction path: search restaurants, open a restaurant menu, add an item, change quantity, view the basket, and open the order preview. It also verifies that switching restaurants prompts before replacing an existing basket.

## MCP tools

- `chowdeck_browse` (data-only discovery step)
- `chowdeck_render_recommendations` (renders 1–5 agent-selected restaurants)
- `chowdeck_connect` (phone → OTP → connected)
- `chowdeck_menu`
- `chowdeck_render_menu_picks` (renders 1–8 agent-selected menu items, such as items under a budget)
- `chowdeck_preview_order`
- `chowdeck_confirm_order`
- `chowdeck_track_order`

## Explainer page

Open [`paystack-index-tools.html`](./paystack-index-tools.html) for a visual guide to the upstream Paystack Index primitives, the Chowdeck adapter tools, representative payloads, and the point where the composable UI is attached.
