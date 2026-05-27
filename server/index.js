import { WebSocketServer } from 'ws'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const { setupWSConnection } = require('y-websocket/bin/utils')

const host = process.env.HOST || '0.0.0.0'
const port = parseInt(process.env.PORT || '4444')

const wss = new WebSocketServer({ host, port })

wss.on('connection', (ws, req) => {
  setupWSConnection(ws, req, {
    docName: req.url.slice(1).split('?')[0],
    gc: true
  })
})

console.log(`collab-slides relay listening on ws://${host}:${port}`)
