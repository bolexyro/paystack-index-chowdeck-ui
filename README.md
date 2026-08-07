# Chowdeck UI on Paystack Index

A private MCP App that turns Paystack Index’s Chowdeck tools into an agent-led ordering experience: the agent narrows live restaurant data into a small visual shortlist, then composes the right surface for the next decision — restaurant cards, filtered menu-item cards, basket, approval, OTP, or tracking — as the user moves through the task.

This is an independent interface powered by Paystack Index and Chowdeck. It is not an official Chowdeck client.

## Safety model

- Browse and menu tools are read-only.
- Previewing an order can fetch required options and totals, but cannot approve payment.
- The confirmation tool accepts only a one-time, server-issued token tied to the exact upstream preview.
- Confirmation tokens expire after ten minutes and are consumed after one attempt.
- Tests never place real orders.

## Local setup

1. Copy `.env.example` to `.env`.
2. Add a Paystack Index OAuth client ID and secret.
3. Start the container:

   ```sh
   docker compose up --build
   ```

4. Health check: `http://localhost:8787/health`
5. MCP endpoint: `http://localhost:8787/mcp`

For a Codex/ChatGPT developer-mode connection, expose `/mcp` through an HTTPS tunnel and add that URL as the connector endpoint. Treat tunnel URLs and OAuth credentials as secrets.

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
