# Project agent notes

- Use the container workflow; do not install project dependencies globally.
- Build: `docker compose build`
- Test: `docker compose run --rm app npm test`
- Local server: copy `.env.example` to `.env`, add credentials, then run `docker compose up --build`.
- Never commit `.env`, Paystack Index credentials, access tokens, cart confirmation tokens, or customer data.
- Never confirm a live order in an automated test. Order confirmation requires a fresh preview token and an explicit human action.

