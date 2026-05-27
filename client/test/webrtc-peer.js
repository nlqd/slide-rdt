import * as Y from 'yjs'
import { WebrtcProvider } from 'y-webrtc'

let wrtc
try {
  const ndc = await import('node-datachannel/polyfill')
  wrtc = ndc.default ?? ndc
} catch {
  if (process.send) process.send({ type: 'error', msg: 'node-datachannel not installed' })
  process.exit(1)
}

const { ROOM, ROLE, SIGNALING } = process.env
const send = (msg) => process.send ? process.send(msg) : console.log(JSON.stringify(msg))

const doc = new Y.Doc()
const ytext = doc.getText('content')

const provider = new WebrtcProvider(ROOM, doc, {
  signaling: [SIGNALING || 'wss://signaling.yjs.dev'],
  peerOpts: { wrtc },
})

provider.on('peers', (ev) => {
  send({ type: 'log', msg: `${ROLE}: peers=${ev.webrtcPeers?.length}` })
})

if (ROLE === 'writer') {
  ytext.insert(0, 'hello from writer')
}

let resolved = false
const check = () => {
  const text = ytext.toString()
  if (text.includes('hello from writer') && !resolved) {
    resolved = true
    send({ type: 'done', text })
  }
}
doc.on('update', check)
check()

setTimeout(() => {
  if (!resolved) {
    send({ type: 'done', text: ytext.toString() })
  }
}, 10000)

setTimeout(() => {
  provider.destroy()
  doc.destroy()
  process.exit(0)
}, 11000)
