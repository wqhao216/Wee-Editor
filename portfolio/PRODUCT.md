# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Static HTML, CSS and vanilla JavaScript. No framework, no build step; opening `index.html` directly must work. Hosted on GitHub Pages as the user site `wqhao216.github.io`. The separate `bloommate` repo keeps serving `/bloommate/`, so this repo must never contain a `bloommate/` folder.

## Users

Recruiters and design leads hiring UI/UX and Product interns (for example the UI/UX Designer Intern role at Golden Owl). They skim first: within 30 seconds they need to know who Hao is, how he works through UX, and what evidence backs it (screens and test numbers). Some then read one case study in depth.

## Product Purpose

The personal portfolio of Hoàng Quân Hạo (Hoang Quan Hao), third-year IT student at UEH, used to apply for UI/UX and Product internships. Success: a recruiter reaches a case study, understands the process and the numbers, and contacts him or downloads the CV.

## Positioning

Every project starts from something observed in real people (readers giving a book 1 to 4 minutes; 5 of 5 flower shops throwing flowers away) and ends with a test or a measurable plan. The site tells that path: observe, decide, test.

## Capabilities and Constraints

- Bilingual: English default, Vietnamese via an EN/VI toggle top right, choice stored in localStorage.
- All copy lives in `i18n/en.js` and `i18n/vi.js` (changed from `.json` by the user so `file://` works). No hard-coded copy in HTML, except Open Graph/meta tags that crawlers read without JavaScript.
- Pages: `/`, `/work/the-hook/`, `/work/bloommate/`, `/work/lume/`, `/about/`.
- Images in `assets/img/`; the user supplies them. Missing images show a labelled placeholder naming the exact file.
- CV at `assets/cv/Hoang-Quan-Hao-CV.pdf` (user supplies).
- Responsive from 375px, lazy images, alt text, visible keyboard focus, prefers-reduced-motion respected, Lighthouse 90+ in all four categories, Open Graph tags.
- Interactions: The Hook mini simulation (illustrative questions, labelled as such), BloomMate "a day in the shop" slider, numbers counting up on scroll. All keyboard-usable with a static fallback under reduced motion.

## Brand Commitments

- Pinned by the user: Apple-like minimalism. Lots of white space, large type, slow reading rhythm, product screenshots as the hero. One modern sans (chosen: Be Vietnam Pro). One restrained accent (chosen: red-orange, concept A). White or very light grey ground, dark mode following the system. Light motion only. No purple-blue gradients, no emoji, no rounded shadowed cards everywhere.
- Case study structure: Context, Problem, My role, Process, Screens, Results, What I'd do differently.
- Copy: short, clear, natural. No em dashes. No clichés such as "passionate", "leveraged", "spearheaded".
- Phone number is never shown on the site (email and LinkedIn only; phone stays in the CV).

## Evidence on Hand

Only the facts the user supplied in the brief (kept in the conversation and mirrored in `i18n/*.js`). Screenshots: `hook-match.jpg`, `hook-book.jpg`, `bloom-today.jpg`, `bloom-report.jpg`, `bloom-stock.jpg`; character crops `hook-char-*.jpg` taken from `hook-match.jpg`. BloomMate has pilot criteria only, no pilot results: present them as a plan. Lumé has no goals, users, design decisions or screenshots yet. Never invent numbers, titles, features or user praise; mark gaps `[TODO: ...]`.

## Product Principles

1. Evidence within 30 seconds: the first two screens of the home page show a real observation and real test numbers.
2. Observe, decide, test: every project is told in that order, and gaps in that chain are shown, not filled.
3. The product screenshots carry the colour; the site stays quiet around them.
4. Honest labels: illustrative content, sample data and plans are named as such.

## Accessibility & Inclusion

WCAG AA contrast in both themes, full keyboard use of every interaction, reduced-motion fallbacks, Vietnamese diacritics rendered by a face designed for them.
