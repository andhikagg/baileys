'use strict'
const zlib = require('zlib')
const { proto } = require('../WAProto/index.js')
const { decodeGroupHistory, processGroupHistory } = require('../src/Utils/group-history')

const sampleGroupHistory = {
	messages: [{ key: { id: 'M1', remoteJid: 'g@g.us' } }],
	commentMessages: [{ key: { id: 'C1' } }],
	outOfWindowPinnedMessages: [{ key: { id: 'P1' } }],
	uncountedAssociatedMessageLists: [{ messages: [{ key: { id: 'A1' } }] }]
}

describe('decodeGroupHistory', () => {
	test('decodes a raw (uncompressed) GroupHistory buffer', () => {
		const bytes = proto.GroupHistory.encode(sampleGroupHistory).finish()
		const out = decodeGroupHistory(Buffer.from(bytes), { inflate: false })
		expect(out.messages[0].key.id).toBe('M1')
	})

	test('inflate:true falls back to raw bytes when not zlib-compressed', () => {
		const bytes = proto.GroupHistory.encode(sampleGroupHistory).finish()
		const out = decodeGroupHistory(Buffer.from(bytes), { inflate: true })
		expect(out.messages[0].key.id).toBe('M1')
	})

	test('decodes a zlib-compressed GroupHistory buffer', () => {
		const bytes = proto.GroupHistory.encode(sampleGroupHistory).finish()
		const compressed = zlib.deflateSync(Buffer.from(bytes))
		const out = decodeGroupHistory(compressed, { inflate: true })
		expect(out.messages[0].key.id).toBe('M1')
	})

	test('withMessageBytes variant decodes each entry messageBytes into WebMessageInfo', () => {
		const inner = proto.WebMessageInfo.encode({ key: { id: 'WB1' }, messageTimestamp: 5 }).finish()
		const wmb = {
			messages: [{ key: { id: 'WB1' }, messageBytes: inner }],
			commentMessages: [],
			outOfWindowPinnedMessages: [],
			uncountedAssociatedMessageLists: []
		}
		const bytes = proto.GroupHistoryWithMessageBytes.encode(wmb).finish()
		const out = decodeGroupHistory(Buffer.from(bytes), { inflate: false, withMessageBytes: true })
		expect(out.messages[0].key.id).toBe('WB1')
		expect(Number(out.messages[0].messageTimestamp)).toBe(5)
	})

	test('rejects non-buffer input', () => {
		expect(() => decodeGroupHistory(42)).toThrow(TypeError)
	})
})

describe('processGroupHistory', () => {
	test('returns normalized arrays for each message bucket', () => {
		const gh = proto.GroupHistory.create(sampleGroupHistory)
		const out = processGroupHistory(gh)
		expect(out.messages).toHaveLength(1)
		expect(out.commentMessages).toHaveLength(1)
		expect(out.outOfWindowPinnedMessages).toHaveLength(1)
		expect(out.uncountedAssociatedMessageLists).toHaveLength(1)
	})

	test('missing buckets default to empty arrays', () => {
		const out = processGroupHistory({})
		expect(out).toEqual({
			messages: [],
			commentMessages: [],
			outOfWindowPinnedMessages: [],
			uncountedAssociatedMessageLists: []
		})
	})
})
