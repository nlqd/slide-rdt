# slide-rdt

Collaborative HTML slide decks using CRDTs. Edit the raw HTML in any text editor, open in a browser to sync changes with collaborators.

## How it works

The slide deck is a single self-contained HTML file (~100KB). It contains your slides, a bundled CRDT engine (Yjs), and a WebSocket sync client. No external dependencies at runtime.

The collaboration flow:

1. Build a deck: `cd client && node build.js wss://your-server:4444`. This outputs `dist/deck.html` with a unique room ID.
2. Edit the HTML in any editor. Slides live between the `<!-- SLIDES START -->` and `<!-- SLIDES END -->` markers. Each `<section class="slide">` is one slide.
3. Open the file in a browser. The embedded script diffs your local edits against the last-synced CRDT state, pushes them to the server, and pulls any remote changes. A "Save" button downloads the merged file.
4. Share the file with a collaborator (email, Slack, USB, whatever). They edit it, open in browser, same sync happens. Edits to different slides merge automatically.

The key constraint: local file edits only sync when you open the file in a browser. The browser is the sync trigger. Between browser opens, you're editing offline and that's fine — the CRDT merges everything when you reconnect.

## Server

The server is a y-websocket relay that stores CRDT state in LevelDB. One process handles all decks (each deck is a separate room keyed by its UUID). Peers can sync days apart because the server persists state.

```
cd server
npm install
PORT=4444 node index.js
```

Put it behind nginx with WSS for production. A systemd unit and nginx config are in the plan doc if you need them.

## Building a deck

```
cd client
npm install
node build.js wss://your-server:4444
```

This produces `dist/deck.html`. The server URL and a fresh room ID are baked into the file's `<meta>` tags. You can also edit them by hand after the fact.

To point a deck at a different server or generate a new room ID, just edit these two lines near the top of the HTML:

```
<meta name="collab-server" content="wss://your-server:4444">
<meta name="collab-room" content="some-uuid-here">
```

## Editing slides

The template follows the html-effectiveness pattern: full-viewport scroll-snapping slides with serif headings and clean typography. Add slides by adding `<section class="slide">` elements between the markers. Use `class="slide invert"` for dark slides.

Don't touch the `<script>` blocks at the bottom — that's the sync engine. Everything between the slide markers is yours.

## Tests

```
cd client
node --test --test-force-exit test/*.test.js
```

18 tests covering the diff engine, state serialization, and integration tests that spin up a real server and verify concurrent offline merges between two peers.
