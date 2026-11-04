# Step 15 — changes

1. **Logo system** — Settings → General: upload logo + "Show site name next to logo" switch. One `BrandLogo` component feeds the public header, footer, loading screen, admin sidebar, admin login and the favicon. Logo-only mode keeps the name as sr-only text (SEO). Built-in default: `public/brand/logo.png` (your E mark, transparent).
2. **Sticky editor toolbar** — blog editor + rich text editor toolbars stay under the top bar while scrolling (`<main>` no longer has overflow, which was what broke `position: sticky`).
3. **Profile photo in the top bar** — session now carries `profile_photo`; shown in the avatar, with a profile menu (My profile, View website, Sign out).
4. **Image crop / adjust / preview** — `ImageCropModal` (drag, zoom, rotate, ratio presets, live preview, round mode) runs before EVERY image upload: ImageUploader (all forms), Media Library (multi-file queue), media picker, rich text editor. "Adjust" re-crops an already saved image.
5. **Reviews `featured` bug** — column is added automatically when missing (migration `database/migration/010_reviews_featured.sql` is the manual alternative); quick edit now sends only changed fields.
6. **Dashboard redesign** — new sidebar, top bar, dashboard page ported from `elemeentra-dashboard.html`; all other admin pages are re-themed (white cards, crimson gradient buttons, radius, shadows) through the `.admin-shell` tokens in `globals.css`.
7. **Speed** — see the list in the chat reply (idle-socket timeout, prepared statements, 16→1 dashboard queries, settings cache, double list-load, client SWR cache + hover warm-up, lazy editors, lucide barrel).

To measure real speed use `npm run start:prod` (production build). `next dev` compiles every route on first visit, which is always slower.
Set `SLOW_QUERY_MS=300` in `.env.local` to log any SQL slower than that in the terminal.

## Fix round (v2)
- Crop dialog no longer closes by itself (React dev-mode double effect revoked the image URL → stale `error` closed it). Modal now renders in a portal.
- "Adjust" works again (same bug; also forces an image MIME type on the re-fetched file).
- Blog editor page is now normal page flow (the old `h-screen` + inner scroll panes were why the toolbar offset looked wrong). Toolbar sticks right under the top bar; right sidebar sticks too.
- SEO panel + FAQ schema moved from the right sidebar to below the editor (two-column, full width).
- "Security by Sigintrecon" (linked to https://sigintrecon.com/) at the bottom of the admin sidebar and in the site footer copyright line.
