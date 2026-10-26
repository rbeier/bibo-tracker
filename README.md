# bibo-tracker

Bun application for scraping book availability and shelf locations from [Bibliothek Halle (Saale)](https://katalog.halle.de/), storing them in a local SQLite database (`bun:sqlite`), and displaying them in the `bibowatch` web UI with `ntfy` push notifications.

Books are pushed to `bibo-tracker` via a Bearer-authenticated `POST /api/books` endpoint (e.g. from a home-network Anytype connector). See [docs/README.md](./docs/README.md) for the full architecture and Anytype connector guide.
