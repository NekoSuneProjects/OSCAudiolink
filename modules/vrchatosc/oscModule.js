const dgram = require('dgram')
const oscClient = dgram.createSocket('udp4')
let oscPort = 9000
let oscReceiver = null
let oscReceiveEnabled = false
let receiverPort = 9001

const OSC_PATHS = {
  low: '/avatar/parameters/VRCOSC/NekoSuneApps/Audiolink/Low',
  bass: '/avatar/parameters/VRCOSC/NekoSuneApps/Audiolink/Bass',
  mid: '/avatar/parameters/VRCOSC/NekoSuneApps/Audiolink/Mid',
  treble: '/avatar/parameters/VRCOSC/NekoSuneApps/Audiolink/Treble',
  volume: '/avatar/parameters/VRCOSC/NekoSuneApps/Audiolink/Volume',
  peak: '/avatar/parameters/VRCOSC/NekoSuneApps/Audiolink/Peak',
  beat: '/avatar/parameters/VRCOSC/NekoSuneApps/Audiolink/Beat'
}

function setOscPort (port) {
  oscPort = port
}

function sendOsc (levels) {
  const volume = levels.reduce((a, b) => a + b, 0) / levels.length
  const peak = Math.max(...levels)

  const values = [levels[0], levels[1], levels[2], levels[3], volume, peak]
  const paths = [
    OSC_PATHS.low,
    OSC_PATHS.bass,
    OSC_PATHS.mid,
    OSC_PATHS.treble,
    OSC_PATHS.volume,
    OSC_PATHS.peak
  ]

  values.forEach((val, i) => {
    const buffer = createOscMessage(paths[i], val)
    oscClient.send(buffer, oscPort, '127.0.0.1', error => {
      if (error) console.error('OSC Error:', error)
    })
  })
}

function sendBeat (value) {
  const buffer = createOscMessage(OSC_PATHS.beat, value)
  oscClient.send(buffer, oscPort, '127.0.0.1', error => {
    if (error) console.error('OSC Beat Error:', error)
  })
}

function startOscReceiver (port, onIncoming) {
  if (oscReceiver) {
    stopOscReceiver()
  }

  if (typeof port === 'number') {
    receiverPort = port
  }

  oscReceiver = dgram.createSocket('udp4')
  oscReceiver.on('error', err => {
    console.error('OSC Receiver Error:', err)
  })

  oscReceiver.on('message', (msg, rinfo) => {
    try {
      const packet = parseOscMessage(msg)
      if (packet && packet.address && typeof onIncoming === 'function') {
        onIncoming(packet.address, packet.args || [])
      }
    } catch (err) {
      console.warn('Unable to parse incoming OSC packet:', err)
    }
  })

  oscReceiver.bind(receiverPort, '0.0.0.0', () => {
    console.log(`OSC receiver listening on port ${receiverPort}`)
    if (typeof onIncoming === 'function') {
      onIncoming('/_status', [`Receiver listening on ${receiverPort}`])
    }
  })

  oscReceiveEnabled = true
}

function stopOscReceiver () {
  if (!oscReceiver) return
  oscReceiver.close()
  oscReceiver = null
  oscReceiveEnabled = false
}

function align4 (value) {
  return (value + 3) & ~3
}

function readOscString (buffer, offset) {
  let end = offset
  while (end < buffer.length && buffer[end] !== 0) end++
  const str = buffer.toString('utf8', offset, end)
  return { str, next: align4(end + 1) }
}

function parseOscMessage (buffer) {
  const addressData = readOscString(buffer, 0)
  if (!addressData.str) return null

  const typeData = readOscString(buffer, addressData.next)
  if (!typeData.str || !typeData.str.startsWith(',')) return { address: addressData.str, args: [] }

  const args = []
  let offset = typeData.next

  for (let i = 1; i < typeData.str.length; i++) {
    const type = typeData.str[i]
    switch (type) {
      case 'f':
        args.push(buffer.readFloatBE(offset))
        offset += 4
        break
      case 'i':
        args.push(buffer.readInt32BE(offset))
        offset += 4
        break
      case 's': {
        const stringData = readOscString(buffer, offset)
        args.push(stringData.str)
        offset = stringData.next
        break
      }
      default:
        return { address: addressData.str, args }
    }
  }

  return { address: addressData.str, args }
}

function createOscMessage (address, value) {
  const encoder = new TextEncoder()
  const addressBuffer = encoder.encode(address + '\0')
  const typeTag = encoder.encode(',f\0\0')
  const floatBuffer = Buffer.alloc(4)
  floatBuffer.writeFloatBE(value, 0)
  const padding = (4 - (addressBuffer.length % 4)) % 4
  const addressPadded = Buffer.concat([addressBuffer, Buffer.alloc(padding)])
  return Buffer.concat([addressPadded, typeTag, floatBuffer])
}

module.exports = {
  setOscPort,
  sendOsc,
  sendBeat,
  startOscReceiver,
  stopOscReceiver,
  OSC_PATHS
}
