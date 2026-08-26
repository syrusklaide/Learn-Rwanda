# Speak Rwanda — prototype with Supabase backend

A Kinyarwanda language-learning app concept: tourists unlock Rwandan destinations,
flip word/phrase cards, get a pronunciation score, and earn badges.

## What's real vs. simulated

- **Real**: authentication (email/password), destinations & cards stored in
  Supabase, progress/scores/badges persisted per user, row-level security so
  each user only sees their own progress.
- **Simulated**: the pronunciation score itself is a random number for demo
  purposes. Wiring in real speech scoring (e.g. an ASR model + phoneme
  alignment against the Kinyarwanda word) is the next real engineering step —
  see `src/main.js`, function `handleScoreAttempt`.

## Setup

1. Copy every file in this project into a new GitHub repo, keeping the folder
   structure (`src/` stays a folder).
2. `npm install`
3. Copy `.env.example` to `.env` — the values already point at the Supabase
   project set up for this app (schema + seed data are already live there).
4. `npm run dev` to run locally, `npm run build` to produce a deployable build.

## Database

The schema (`destinations`, `cards`, `user_progress`, `pronunciation_scores`,
`user_badges`) and starter content for Greetings, Volcanoes, and Akagera are
already applied to the connected Supabase project. Lake Kivu exists as a
destination row but has no cards yet — add them once you have the real word
list from the voice recording, e.g.:

```sql
insert into cards (destination_id, glyph, kinyarwanda_word, english_word, fact, sort_order)
values ((select id from destinations where slug = 'kivu'), '🐟', 'Ifi', 'Fish', '...', 1);
```

## Next steps worth planning for

- Real pronunciation scoring (this is the hard, valuable part of the product)
- Image assets instead of emoji placeholders for each card
- Password reset / magic-link sign-in as an alternative to password auth
- Admin view for adding destinations/cards without writing SQL by hand
