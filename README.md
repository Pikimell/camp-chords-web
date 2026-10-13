# CampChords Web

> A local-first songbook for guitarists: search chords online, build your own library and collections, transpose on the fly, and tune your guitar in the browser.

![Next.js](https://img.shields.io/badge/Next.js-000000?logo=nextdotjs&logoColor=white)
![React](https://img.shields.io/badge/React-20232A?logo=react&logoColor=61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![Zustand](https://img.shields.io/badge/Zustand-443E38)
![Web Audio](https://img.shields.io/badge/Web_Audio_API-FF6F00)

The web version of the CampChords mobile app. Your library lives in the browser, with no account required, and is fully compatible with the mobile app's JSON export.

## Features

- **Online chord search** via a server-side proxy (Next.js route handlers avoid CORS issues), with query history, pagination, preview, and duplicate protection.
- **Personal library:** create and edit songs (author, tags, notes, source, YouTube link), favourites, search, tag filters, and 7 sort modes.
- **Collections** with custom ordering.
- **Transposition** that handles slash chords and flats, plus adjustable font size and a performer mode with keyboard shortcuts (`←/→` next song, `Shift+↑/↓` change key).
- **Chromatic tuner** built on the Web Audio API and microphone input (A4 = 440 Hz).
- **YouTube integration:** attach videos manually or by search, including bulk matching for songs without a video.
- **Import/export** of JSON compatible with the mobile app, validated before anything is written.
- **Safe rendering:** chord HTML from external sources is sanitized with `sanitize-html`.
- Print view, responsive layout, and automatic light/dark theme.

## Engineering notes

- **Data integrity:** import validates the whole file first, rejects files with duplicate IDs instead of partially importing them, and never overwrites existing records. Generated IDs are 24-hex `ObjectId`-compatible.
- **Storage resilience:** if `localStorage` is corrupted, the app never overwrites it and offers a raw backup download instead. If the quota is exceeded, the current in-memory data can still be exported.
- **Tests:** 10 tests cover JSON compatibility against a real mobile export fixture, duplicate handling, validation, store persistence, HTML sanitizing, transposition, and tuner pitch detection on synthetic guitar frequencies.

## Getting started

Requires Node.js 20.9+.

```bash
npm install
npm run dev        # http://127.0.0.1:3010
npm test
npm run typecheck
```

Optional video search configuration:

```bash
cp .env.example .env.local
```

| Variable | Description |
| :-- | :-- |
| `CHORDS_API_URL` | Override the default chords API |
| `YOUTUBE_SEARCH_URL`, `YOUTUBE_SEARCH_KEY` | Video search function and its publishable key |

## Project structure

```
src/
├── app/            # App Router pages and /api/chords, /api/youtube proxies
├── components/     # songbook, song detail, editor, tuner, modal
└── lib/            # chords (transpose), library (import/export), store, api
tests/              # store and library tests + mobile export fixture
```

Detailed documentation in Ukrainian: [README-uk.md](README-uk.md).

## Author

**Volodymyr Pashchenko**, Full-stack Developer · [GitHub](https://github.com/Pikimell) · [LinkedIn](https://www.linkedin.com/in/pashchenko-v-r)
