# Personal finance app

Vanilla HTML, CSS, and JavaScript implementation of the [Frontend Mentor Personal finance app](https://www.frontendmentor.io) premium challenge — a multi-page dashboard for overview, transactions, budgets, savings pots, recurring bills, **plus** extended **credit cards**, **settings**, and other features described under **Additional pages & features** below.

**Live site:** [https://dextervorbe.github.io/personal-finance-app/](https://dextervorbe.github.io/personal-finance-app/)

## Run locally (fork / clone)

You need **Node.js** (includes `npm`) so the static server can serve `data.json` — browsers block `fetch()` from `file://`, so open the app over HTTP.

1. Clone the repository and enter the project folder:

   ```bash
   git clone <your-fork-or-repo-url>.git
   cd personal-finance-app
   ```

2. Install is optional — `npm start` uses `npx` to run [`serve`](https://github.com/vercel/serve) on demand. Start the dev server from the **repository root** (where `index.html` lives):

   ```bash
   npm start
   ```

3. Open the URL shown in the terminal (default **[http://localhost:3000](http://localhost:3000)**).

**Equivalent:** `npx serve .` from the same directory.

**Avoid:** serving a non-existent subfolder (for example an old `starter-code` path) — `GET /` will 404. Always serve the folder that contains `index.html`, `assets/`, `css/`, `js/`, and `data.json`.

## What’s in this repo (vs. original FM layout)

- **Flat layout:** App files live at the repo root (`*.html`, `assets/`, `css/`, `js/`, `data.json`) instead of inside a `starter-code/` subdirectory.
- **`package.json`** with a **`start`** script that runs `npx --yes serve .` so there is one consistent command to run the site.
- **`AGENTS.md`** / **`CLAUDE.md`** — Frontend Mentor’s guidance for AI-assisted workflows (unchanged intent).

## Challenge summary

Full brief, designs, and submission guidance live on **Frontend Mentor**. The published user stories focus on **overview**, **transactions**, **budgets**, **pots**, and **recurring bills** (plus accessibility and responsive behavior). FM also lists optional bonuses (e.g. full-stack persistence, authentication). This implementation meets the core expectations and adds the extras below.

Design assets belong to the challenge purchase — **do not commit or publish** Figma/Sketch/XD files; keep using the provided **`.gitignore`** rules.

## Additional pages & features

These are not spelled out in the main Frontend Mentor “users should be able to…” list for this challenge; they were added in this repo.

**Pages**

- **Credit cards** (`credit-cards.html`) — multi-card accounts, per-card activity (search, sort, filter, month grouping), add/edit/delete cards, and card-scoped transaction handling with **client-side persistence** (e.g. `localStorage`) layered on `data.json`.
- **Settings** (`settings.html`) — manage **custom transaction categories** (name + color), stored in the browser; they appear alongside the default categories anywhere you pick a category.

**App-wide UX**

- **Light / dark theme** — toggle in the sidebar, choice persisted (`localStorage`) and applied on load via `theme-init.js` / `theme.js`.
- **Collapsible sidebar** — “minimize menu” for a compact nav strip.

**Data & presentation helpers**

- **Budget year navigation** — year picker / extended calendar range on budgets (`budget-year-picker.js`), not only a single fixed month.
- **Category accents** — consistent colors for default categories and user-defined ones (`category-accent.js`, `user-categories.js`).
- **Ledger balance** — shared helper for net balance from transactions + opening balance (`ledger-balance.js`) on overview.

## Links

- [Live demo (GitHub Pages)](https://dextervorbe.github.io/personal-finance-app/)
- [Frontend Mentor — submit solutions](https://www.frontendmentor.io/guides/how-to-submit-solutions)
- [Suggested hosts](https://www.frontendmentor.io/guides/hosting-your-solution) (GitHub Pages, Vercel, Netlify, etc.)

---

Challenge copyright © Frontend Mentor. This implementation is personal portfolio / learning work.
