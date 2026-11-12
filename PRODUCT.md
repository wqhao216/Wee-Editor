# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

Videos are authored as React components and rendered to MP4 by Remotion; there is no interactive UI shipped to viewers.

## Users

Two audiences, in this order:

1. **Viewers (the people the videos are for):** flower-shop owners and staff who already use, or are setting up, BloomMate. They watch to learn how to do a specific task in the app (an evening check, a restock, reading a report). International audience; all on-screen text is English.
2. **Author (the person using this repo):** produces those tutorial videos with code, from screen recordings of the app plus overlays, captions and motion.

## Product Purpose

Wee-Editor is a code-based video toolkit used to make **how-to / tutorial videos for the BloomMate app**. A video succeeds when a shop owner can watch it once and then do the task in BloomMate without getting stuck.

## Positioning

Tutorials are built from the real app: actual screen recordings of BloomMate, annotated and paced in code, so every step shown matches what the user will see on their own screen.

## Operating Context

- **BloomMate** is a flower-shop management app (English UI). Screens seen in the current recording: Evening check, Restock, Today with suggested combos, photos and captions, Stock with Smart view, Report.
- Source footage: screen recordings in `source/screen-recordings/` (Git LFS), named `YYYY-MM-DD-topic.mp4`. The first is `2026-11-04-bloommate-demo.mp4`, 3:47, 2458×1330 (landscape desktop capture).
- Output format so far: vertical 1080×1920 at 30 fps (TikTok / Reels / Shorts), defined in `src/Root.tsx`. Whether every tutorial stays vertical, or some ship landscape to match the 2458×1330 footage, is **undecided**.

## Capabilities and Constraints

- Stack in place: Remotion 4 (React 19, TypeScript), plus GSAP, Motion, Anime.js, Lottie, Rive, Three.js/R3F, Howler, Mediabunny, FFmpeg, Satori, SVGO. `npm run studio` previews, `npm run render` exports to `out/`.
- Remotion reads media only from `public/` via `staticFile()`; footage must be copied there from `source/`.
- **The repo is public.** Footage with personal data (ID cards, phone numbers, addresses, emails, account details) must not be committed here; it belongs in the private `wee-editor-footage` repo. Any customer or shop data visible in a recording must be blurred or cropped before it ships.
- Undecided: voiceover vs. text-only captions; video length per tutorial; series structure (one task per video or one long walkthrough).

## Brand Commitments

- Product name as written: **BloomMate**. App UI terms (Evening check, Restock, Stock, Smart view, Report) are used verbatim so captions match what viewers see on screen.
- No BloomMate logo, palette or typeface has been supplied to this repo yet; do not invent one. The `HelloVideo` purple gradient is a placeholder, not a brand.

## Evidence on Hand

- `source/screen-recordings/2026-11-04-bloommate-demo.mp4`: the only real footage so far.
- No testimonials, user counts, shop names, pricing or download figures exist here. Tutorials must not fabricate them.

## Product Principles

1. **One task, followed to the end.** Each video teaches something a shop owner can finish, step by step, in the same order the app requires.
2. **The app is the hero.** Overlays, zooms and captions point at the real interface; they never cover the control the viewer needs to find.
3. **Readable on a phone, at a glance.** Captions short enough to read before the step changes, sized for a vertical phone screen, in plain English for non-native speakers.
4. **Match the screen exactly.** Labels, button names and screen names in captions are copied from the app, not paraphrased.

## Accessibility & Inclusion

- Viewers are international and may not be native English speakers: plain vocabulary, short sentences, no idioms.
- Every spoken or implied instruction appears as on-screen text, so videos work muted (default autoplay on social feeds).
