# BuyHacks

Curated product showcase with community votes and life-hack tips.

**Live:** [buyhacks.neorgon.com](https://buyhacks.neorgon.com/)

## Features

- 24 curated products across 7 categories
- Vote love / own / want on any product (anonymous, visitor-ID dedup)
- Submit life-hack tips (login required, 280 char limit, max 3 per product)
- Search, category filter chips, sort by most loved/owned/wanted
- User auth (register/login) for hack submissions

## Stack

- Static HTML + ES modules (no build step)
- CSS glassmorphism cards with amber `#f59e0b` accent
- [Convex](https://convex.dev/) serverless backend (votes, hacks, auth)
- Images hosted at `minibooks.lucianoadonis.com`

## Run locally

```bash
npm install                # install Convex SDK
npx convex dev             # start Convex backend
python3 -m http.server 8777  # serve frontend
```

Open `http://localhost:8777`.

## Project structure

```
buyhacks-site/
  index.html              # HTML shell
  css/style.css           # All styles
  js/
    app.js                # Entry point
    state.js              # Convex client, auth, mutable state
    data.js               # 24 products, categories, verdict labels
    render.js             # DOM rendering (grid, chips, cards, auth)
    events.js             # Event handlers (votes, hacks, auth, search)
    utils.js              # escHtml, toast, debounce, timeAgo
  convex/
    schema.ts             # users, votes, hacks tables
    auth.ts               # register / login mutations
    votes.ts              # getVotes query, toggleVote mutation
    hacks.ts              # getHacks query, submitHack mutation
```
