'use strict'
const { proto } = require('../WAProto/index.js')
const { decodeE2eRekeyPayload } = require('../src/Utils/voip-rekey')

describe('decodeE2eRekeyPayload', () => {
	test('maps all three key types from int enum to name', () => {
		const obj = {
			keys: [
				{ type: proto.RekeyKeyType.REKEY_KEY_AUDIO, key: Buffer.from([1, 2]) },
				{ type: proto.RekeyKeyType.REKEY_KEY_VIDEO, key: Buffer.from([3, 4]) },
				{ type: proto.RekeyKeyType.REKEY_KEY_APPDATA, key: Buffer.from([5, 6]) }
			]
		}
		const bytes = proto.E2eRekeyPayload.encode(obj).finish()
		const out = decodeE2eRekeyPayload(bytes)
		expect(out.keys.map(k => k.type)).toEqual(['REKEY_KEY_AUDIO', 'REKEY_KEY_VIDEO', 'REKEY_KEY_APPDATA'])
		expect(Buffer.from(out.keys[0].key)).toEqual(Buffer.from([1, 2]))
	})

	test('empty keys → empty array', () => {
		const bytes = proto.E2eRekeyPayload.encode({ keys: [] }).finish()
		expect(decodeE2eRekeyPayload(bytes).keys).toEqual([])
	})

	test('rejects non-buffer input', () => {
		expect(() => decodeE2eRekeyPayload('nope')).toThrow(TypeError)
	})
})
