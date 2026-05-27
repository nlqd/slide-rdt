# slide-rdt

Collaborative HTML slide decks using CRDTs. Edit the raw HTML in any text editor, open in a browser to sync changes with collaborators.

## How it works

The slide deck is a single self-contained HTML file (~200KB). It contains your slides, a bundled CRDT engine (Yjs), and two sync transports: WebRTC (peer-to-peer, zero config) and optionally a WebSocket relay (persistent, works across sessions).

The collaboration flow:

1. Build a deck: `cd client && node build.js`. This outputs `dist/deck.html` with a unique room ID.
2. Edit the HTML in any editor. Slides live between the `<!-- SLIDES START -->` and `<!-- SLIDES END -->` markers. Each `<section class="slide">` is one slide.
3. Open the file in a browser. The embedded script diffs your local edits against the last-synced CRDT state, syncs with any connected peers, and pulls remote changes. A "Save" button downloads the merged file.
4. Share the file with a collaborator (email, Slack, USB, whatever). They edit it, open in browser, same sync happens. Edits to different slides merge automatically.

The key constraint: local file edits only sync when you open the file in a browser. The browser is the sync trigger. Between browser opens, you're editing offline and that's fine, the CRDT merges everything when you reconnect.

## Sync modes

By default, decks sync via WebRTC using the public signaling server at wss://signaling.yjs.dev. No server setup required. Both peers need to have the file open in a browser at the same time for WebRTC to work.

If you want persistence (peers can sync hours or days apart without being online simultaneously), run the relay server and pass its URL when building:

```
node build.js wss://your-server:4444
```

When a server URL is configured, the deck uses both WebRTC and WebSocket. WebRTC handles live sessions, the server handles persistence.

## Server (optional)

The server is a y-websocket relay that stores CRDT state in LevelDB. One process handles all decks, each keyed by its room UUID.

```
cd server
npm install
PORT=4444 node index.js
```

Put it behind nginx with WSS for production.

## Building a deck

```
cd client
npm install
node build.js                          # WebRTC only, zero config
node build.js wss://your-server:4444   # WebRTC + persistent relay
```

This produces `dist/deck.html`. The server URL and room ID are in `<meta>` tags near the top of the file. You can edit them by hand:

```
<meta name="collab-server" content="">                  <!-- empty = WebRTC only -->
<meta name="collab-room" content="some-uuid-here">
```

## Editing slides

The template follows the html-effectiveness pattern: full-viewport scroll-snapping slides with serif headings and clean typography. Add slides by adding `<section class="slide">` elements between the markers. Use `class="slide invert"` for dark slides.

Don't touch the `<script>` blocks at the bottom, that's the sync engine. Everything between the slide markers is yours.

## Tests

```
cd client
node --test --test-force-exit test/*.test.js
```

18 tests covering the diff engine, state serialization, and integration tests that spin up a real server and verify concurrent offline merges between two peers.
