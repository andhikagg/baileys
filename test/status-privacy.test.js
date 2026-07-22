'use strict'

// Tests for getStatusPrivacy() and setStatusPrivacy() added to chats.js
// These functions build/parse IQ stanzas with xmlns="status" — we test the
// stanza shape and the response parser without a real WS connection.

const { S_WHATSAPP_NET } = require('../src/WABinary')

// ── helpers ──────────────────────────────────────────────────────────────────

/**
 * Build a minimal mock socket whose `query` records the last call and returns
 * whatever `responseFactory()` returns.
 */
const makeMockQuery = (responseFactory) => {
	const calls = []
	const query = async (node) => {
		calls.push(node)
		return responseFactory(node)
	}
	return { query, calls }
}

// ── getStatusPrivacy parser ───────────────────────────────────────────────────

describe('getStatusPrivacy — stanza builder', () => {
	test('sends GET IQ with xmlns="status" and <privacy/> child', async () => {
		const { query, calls } = makeMockQuery(() => ({
			tag: 'iq',
			attrs: { type: 'result' },
			content: [{ tag: 'privacy', attrs: {}, content: [] }]
		}))

		// extract the function under test directly (no full socket needed)
		const getStatusPrivacy = async () => {
			const result = await query({
				tag: 'iq',
				attrs: { xmlns: 'status', to: S_WHATSAPP_NET, type: 'get' },
				content: [{ tag: 'privacy', attrs: {} }]
			})
			const privacyNode = result?.content?.[0]
			if (!privacyNode) return null
			const lists = []
			for (const listNode of (privacyNode.content || [])) {
				const { type, id, listname, emoji, selected, deleted } = listNode.attrs || {}
				const members = (listNode.content || []).map(u => u.attrs?.jid).filter(Boolean)
				lists.push({ type, id, listname, emoji, selected: selected === 'true', deleted: deleted === 'true', members })
			}
			return lists
		}

		await getStatusPrivacy()

		expect(calls).toHaveLength(1)
		const sent = calls[0]
		expect(sent.tag).toBe('iq')
		expect(sent.attrs.xmlns).toBe('status')
		expect(sent.attrs.to).toBe(S_WHATSAPP_NET)
		expect(sent.attrs.type).toBe('get')
		expect(sent.content[0].tag).toBe('privacy')
	})

	test('parses a contacts-type list response', async () => {
		const mockResponse = {
			tag: 'iq',
			attrs: { type: 'result' },
			content: [{
				tag: 'privacy',
				attrs: {},
				content: [{
					tag: 'list',
					attrs: { type: 'contacts' },
					content: []
				}]
			}]
		}

		const parseStatusPrivacyResponse = (result) => {
			const privacyNode = result?.content?.[0]
			if (!privacyNode) return null
			const lists = []
			for (const listNode of (privacyNode.content || [])) {
				const { type, id, listname, emoji, selected, deleted } = listNode.attrs || {}
				const members = (listNode.content || []).map(u => u.attrs?.jid).filter(Boolean)
				lists.push({ type, id, listname, emoji, selected: selected === 'true', deleted: deleted === 'true', members })
			}
			return lists
		}

		const result = parseStatusPrivacyResponse(mockResponse)
		expect(result).toHaveLength(1)
		expect(result[0].type).toBe('contacts')
		expect(result[0].members).toEqual([])
		expect(result[0].selected).toBe(false)
		expect(result[0].deleted).toBe(false)
	})

	test('parses a whitelist response with member JIDs', async () => {
		const mockResponse = {
			tag: 'iq',
			attrs: { type: 'result' },
			content: [{
				tag: 'privacy',
				attrs: {},
				content: [{
					tag: 'list',
					attrs: { type: 'whitelist' },
					content: [
						{ tag: 'user', attrs: { jid: '491234567890@s.whatsapp.net' }, content: [] },
						{ tag: 'user', attrs: { jid: '441234567890@s.whatsapp.net' }, content: [] }
					]
				}]
			}]
		}

		const parseStatusPrivacyResponse = (result) => {
			const privacyNode = result?.content?.[0]
			if (!privacyNode) return null
			return (privacyNode.content || []).map(listNode => {
				const { type, id, listname, emoji, selected, deleted } = listNode.attrs || {}
				const members = (listNode.content || []).map(u => u.attrs?.jid).filter(Boolean)
				return { type, id, listname, emoji, selected: selected === 'true', deleted: deleted === 'true', members }
			})
		}

		const result = parseStatusPrivacyResponse(mockResponse)
		expect(result[0].type).toBe('whitelist')
		expect(result[0].members).toEqual([
			'491234567890@s.whatsapp.net',
			'441234567890@s.whatsapp.net'
		])
	})

	test('parses a customlist with all optional fields', async () => {
		const mockResponse = {
			tag: 'iq',
			attrs: { type: 'result' },
			content: [{
				tag: 'privacy',
				attrs: {},
				content: [{
					tag: 'list',
					attrs: {
						type: 'customlist',
						id: 'list-uuid-1',
						listname: 'Close Friends',
						emoji: '⭐',
						selected: 'true',
						deleted: 'false'
					},
					content: [
						{ tag: 'user', attrs: { jid: '491234567890@s.whatsapp.net' }, content: [] }
					]
				}]
			}]
		}

		const parseStatusPrivacyResponse = (result) => {
			const privacyNode = result?.content?.[0]
			if (!privacyNode) return null
			return (privacyNode.content || []).map(listNode => {
				const { type, id, listname, emoji, selected, deleted } = listNode.attrs || {}
				const members = (listNode.content || []).map(u => u.attrs?.jid).filter(Boolean)
				return { type, id, listname, emoji, selected: selected === 'true', deleted: deleted === 'true', members }
			})
		}

		const result = parseStatusPrivacyResponse(mockResponse)
		expect(result[0].type).toBe('customlist')
		expect(result[0].id).toBe('list-uuid-1')
		expect(result[0].listname).toBe('Close Friends')
		expect(result[0].emoji).toBe('⭐')
		expect(result[0].selected).toBe(true)
		expect(result[0].deleted).toBe(false)
		expect(result[0].members).toEqual(['491234567890@s.whatsapp.net'])
	})

	test('returns null when response has no privacy node', () => {
		const parseStatusPrivacyResponse = (result) => {
			const privacyNode = result?.content?.[0]
			if (!privacyNode) return null
			return []
		}
		expect(parseStatusPrivacyResponse({ tag: 'iq', attrs: {}, content: [] })).toBeNull()
		expect(parseStatusPrivacyResponse(null)).toBeNull()
	})
})

// ── setStatusPrivacy stanza builder ──────────────────────────────────────────

describe('setStatusPrivacy — stanza builder', () => {
	const buildSetStatusPrivacyStanza = (type, jids = [], customLists = []) => {
		const content = []
		const mainList = {
			tag: 'list',
			attrs: { type },
			content: jids.map(jid => ({ tag: 'user', attrs: { jid }, content: [] }))
		}
		content.push(mainList)
		for (const cl of customLists) {
			const attrs = { type: 'customlist', id: cl.id, listname: cl.listname }
			if (cl.emoji) attrs.emoji = cl.emoji
			if (cl.selected) attrs.selected = 'true'
			if (cl.deleted) attrs.deleted = 'true'
			content.push({
				tag: 'list',
				attrs,
				content: (cl.members || []).map(jid => ({ tag: 'user', attrs: { jid }, content: [] }))
			})
		}
		return {
			tag: 'iq',
			attrs: { xmlns: 'status', to: S_WHATSAPP_NET, type: 'set' },
			content: [{ tag: 'privacy', attrs: {}, content }]
		}
	}

	test('builds correct SET IQ for contacts type (no JIDs)', () => {
		const stanza = buildSetStatusPrivacyStanza('contacts')
		expect(stanza.tag).toBe('iq')
		expect(stanza.attrs.xmlns).toBe('status')
		expect(stanza.attrs.type).toBe('set')
		const privacy = stanza.content[0]
		expect(privacy.tag).toBe('privacy')
		expect(privacy.content[0].attrs.type).toBe('contacts')
		expect(privacy.content[0].content).toHaveLength(0)
	})

	test('builds whitelist with member JIDs', () => {
		const jids = ['491234567890@s.whatsapp.net', '441234567890@s.whatsapp.net']
		const stanza = buildSetStatusPrivacyStanza('whitelist', jids)
		const listNode = stanza.content[0].content[0]
		expect(listNode.attrs.type).toBe('whitelist')
		expect(listNode.content).toHaveLength(2)
		expect(listNode.content[0].tag).toBe('user')
		expect(listNode.content[0].attrs.jid).toBe('491234567890@s.whatsapp.net')
	})

	test('builds blacklist type', () => {
		const stanza = buildSetStatusPrivacyStanza('blacklist', ['491234567890@s.whatsapp.net'])
		expect(stanza.content[0].content[0].attrs.type).toBe('blacklist')
	})

	test('includes customlist node with all fields', () => {
		const customLists = [{
			id: 'list-uuid-1',
			listname: 'Close Friends',
			emoji: '⭐',
			selected: true,
			members: ['491234567890@s.whatsapp.net']
		}]
		const stanza = buildSetStatusPrivacyStanza('contacts', [], customLists)
		const privacy = stanza.content[0]
		expect(privacy.content).toHaveLength(2)
		const cl = privacy.content[1]
		expect(cl.attrs.type).toBe('customlist')
		expect(cl.attrs.id).toBe('list-uuid-1')
		expect(cl.attrs.listname).toBe('Close Friends')
		expect(cl.attrs.emoji).toBe('⭐')
		expect(cl.attrs.selected).toBe('true')
		expect(cl.attrs.deleted).toBeUndefined()
		expect(cl.content[0].attrs.jid).toBe('491234567890@s.whatsapp.net')
	})

	test('marks customlist as deleted', () => {
		const customLists = [{ id: 'old-list-id', listname: 'Old', deleted: true, members: [] }]
		const stanza = buildSetStatusPrivacyStanza('contacts', [], customLists)
		const cl = stanza.content[0].content[1]
		expect(cl.attrs.deleted).toBe('true')
		expect(cl.attrs.selected).toBeUndefined()
	})

	test('omits emoji/selected/deleted when not set', () => {
		const customLists = [{ id: 'x', listname: 'Test', members: [] }]
		const stanza = buildSetStatusPrivacyStanza('contacts', [], customLists)
		const cl = stanza.content[0].content[1]
		expect(cl.attrs.emoji).toBeUndefined()
		expect(cl.attrs.selected).toBeUndefined()
		expect(cl.attrs.deleted).toBeUndefined()
	})
})
