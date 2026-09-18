# Carlos Tech Solutions — Frontend

Stage 1 of the project (see `../docs/old/brief.md`): a React
frontend running entirely on mock data, deployable for free on Vercel.
No backend calls happen yet — Stage 2 adds a FastAPI + MongoDB backend
in a sibling `backend/` folder.

## Stack

- [Vite](https://vite.dev) + React + TypeScript
- [React Router](https://reactrouter.com) for client-side routing
- [Tailwind CSS v4](https://tailwindcss.com) for styling

## Getting started

```bash
npm install
npm run dev
```

## Project structure

```
src/
  components/   Header, Footer, Layout, and shared UI (ProductCard, badges, etc.)
  pages/        One file per site-map page (Home, Shop, Product detail, Sell, About, Contact, Help)
  data/         Mock data (items, locations, articles) — the Stage 2 swap point
  lib/          Small shared constants/helpers
  types.ts      Shapes mirrored from the planned Mongo collections
```

## Swapping in the real backend (Stage 2)

Every page reads mock data through `src/data/*.ts`. When the FastAPI
backend exists, replace those files' contents with `fetch` calls (or a
small API client) that return the same shapes defined in `src/types.ts` —
pages shouldn't need to change, only the data layer.

Things intentionally deferred to Stage 2 (per the brief):
- Real product images (currently gray placeholder boxes)
- Trade-in submissions, contact form, and "Add to cart" don't persist
  anywhere yet — they're local-only mock interactions
- Account icon in the header is decorative (no customer accounts planned)
