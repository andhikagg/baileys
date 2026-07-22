'use strict'
Object.defineProperty(exports, '__esModule', { value: true })
exports.decodeE2eRekeyPayload = void 0
const index_js_1 = require('../../WAProto/index.js')
const REKEY_TYPE_NAMES = {
	[index_js_1.proto.RekeyKeyType.REKEY_KEY_AUDIO]: 'REKEY_KEY_AUDIO',
	[index_js_1.proto.RekeyKeyType.REKEY_KEY_VIDEO]: 'REKEY_KEY_VIDEO',
	[index_js_1.proto.RekeyKeyType.REKEY_KEY_APPDATA]: 'REKEY_KEY_APPDATA'
}
const decodeE2eRekeyPayload = buffer => {
	if (!Buffer.isBuffer(buffer) && !(buffer instanceof Uint8Array)) {
		throw new TypeError('decodeE2eRekeyPayload: buffer must be Buffer or Uint8Array')
	}
	const decoded = index_js_1.proto.E2eRekeyPayload.decode(buffer)
	return {
		keys: (decoded.keys || []).map(entry => ({
			type: REKEY_TYPE_NAMES[entry.type] ?? entry.type,
			key: entry.key ? Buffer.from(entry.key) : Buffer.alloc(0)
		}))
	}
}
exports.decodeE2eRekeyPayload = decodeE2eRekeyPayload
