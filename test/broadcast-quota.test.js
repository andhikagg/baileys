'use strict'

// Tests for fetchBroadcastListQuota added to chats.js
// Source: BroadcastListQuotaProtocol.java — IQ xmlns="w:biz", <broadcast_list_quota/>
// We test stanza builder and response parser independently.

const { S_WHATSAPP_NET, getBinaryNodeChild } = require('../src/WABinary')

// ── stanza builder ────────────────────────────────────────────────────────────

const buildBroadcastQuotaStanza = () => ({
	tag: 'iq',
	attrs: { xmlns: 'w:biz', to: S_WHATSAPP_NET, type: 'get' },
	content: [{ tag: 'broadcast_list_quota', attrs: {}, content: [] }]
})

describe('fetchBroadcastListQuota — stanza builder', () => {
	test('sends GET IQ with xmlns="w:biz"', () => {
		const s = buildBroadcastQuotaStanza()
		expect(s.tag).toBe('iq')
		expect(s.attrs.xmlns).toBe('w:biz')
		expect(s.attrs.type).toBe('get')
		expect(s.attrs.to).toBe(S_WHATSAPP_NET)
	})

	test('has broadcast_list_quota child node', () => {
		const s = buildBroadcastQuotaStanza()
		expect(s.content[0].tag).toBe('broadcast_list_quota')
	})
})

// ── response parser ───────────────────────────────────────────────────────────

// Parser extracted from implementation in chats.js
const parseBroadcastQuotaResponse = (result) => {
	const limitsNode = getBinaryNodeChild(result, 'limits')
	const timeframeNode = getBinaryNodeChild(result, 'timeframe')
	if (!limitsNode) return null

	const getVal = (node, childTag) =>
		node?.attrs?.[childTag] ?? getBinaryNodeChild(node, childTag)?.content ?? '0'

	return {
		messagesLeft: parseInt(getVal(limitsNode, 'messages_left')),
		totalLimit: parseInt(getVal(limitsNode, 'total_limit')),
		isHeavySender: getVal(limitsNode, 'is_heavy_sender') === 'true',
		startTs: parseInt(getVal(timeframeNode, 'start_ts_s')),
		endTs: parseInt(getVal(timeframeNode, 'end_ts_s')),
		resetTs: parseInt(getVal(timeframeNode, 'reset_ts_s'))
	}
}

// Build a response with child-node style (matching APK XML structure)
const makeQuotaResponse = ({ messagesLeft, totalLimit, isHeavySender, startTs, endTs, resetTs }) => ({
	tag: 'iq',
	attrs: { type: 'result' },
	content: [
		{
			tag: 'limits',
			attrs: {},
			content: [
				{ tag: 'messages_left', attrs: {}, content: String(messagesLeft) },
				{ tag: 'total_limit', attrs: {}, content: String(totalLimit) },
				{ tag: 'is_heavy_sender', attrs: {}, content: String(isHeavySender) }
			]
		},
		{
			tag: 'timeframe',
			attrs: {},
			content: [
				{ tag: 'start_ts_s', attrs: {}, content: String(startTs) },
				{ tag: 'end_ts_s', attrs: {}, content: String(endTs) },
				{ tag: 'reset_ts_s', attrs: {}, content: String(resetTs) }
			]
		}
	]
})

// Build a response with attr style (alternative server format)
const makeQuotaResponseAttrs = ({ messagesLeft, totalLimit, isHeavySender, startTs, endTs, resetTs }) => ({
	tag: 'iq',
	attrs: { type: 'result' },
	content: [
		{
			tag: 'limits',
			attrs: {
				messages_left: String(messagesLeft),
				total_limit: String(totalLimit),
				is_heavy_sender: String(isHeavySender)
			},
			content: []
		},
		{
			tag: 'timeframe',
			attrs: {
				start_ts_s: String(startTs),
				end_ts_s: String(endTs),
				reset_ts_s: String(resetTs)
			},
			content: []
		}
	]
})

describe('fetchBroadcastListQuota — response parser (child-node format)', () => {
	const fixture = {
		messagesLeft: 47,
		totalLimit: 256,
		isHeavySender: false,
		startTs: 1716825600,
		endTs: 1716912000,
		resetTs: 1716912000
	}

	test('parses messagesLeft and totalLimit', () => {
		const result = parseBroadcastQuotaResponse(makeQuotaResponse(fixture))
		expect(result.messagesLeft).toBe(47)
		expect(result.totalLimit).toBe(256)
	})

	test('parses isHeavySender=false', () => {
		const result = parseBroadcastQuotaResponse(makeQuotaResponse(fixture))
		expect(result.isHeavySender).toBe(false)
	})

	test('parses isHeavySender=true', () => {
		const result = parseBroadcastQuotaResponse(makeQuotaResponse({ ...fixture, isHeavySender: true }))
		expect(result.isHeavySender).toBe(true)
	})

	test('parses timeframe timestamps', () => {
		const result = parseBroadcastQuotaResponse(makeQuotaResponse(fixture))
		expect(result.startTs).toBe(1716825600)
		expect(result.endTs).toBe(1716912000)
		expect(result.resetTs).toBe(1716912000)
	})

	test('returns null when no limits node present', () => {
		const result = parseBroadcastQuotaResponse({
			tag: 'iq', attrs: { type: 'result' }, content: []
		})
		expect(result).toBeNull()
	})
})

describe('fetchBroadcastListQuota — response parser (attr format)', () => {
	const fixture = {
		messagesLeft: 10,
		totalLimit: 100,
		isHeavySender: true,
		startTs: 1700000000,
		endTs: 1700086400,
		resetTs: 1700086400
	}

	test('parses from attrs when child nodes absent', () => {
		const result = parseBroadcastQuotaResponse(makeQuotaResponseAttrs(fixture))
		expect(result.messagesLeft).toBe(10)
		expect(result.totalLimit).toBe(100)
		expect(result.isHeavySender).toBe(true)
		expect(result.startTs).toBe(1700000000)
	})
})
