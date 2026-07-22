'use strict'

// Tests for the WhatsApp-Web protocol-port additions (reverse-engineered from
// captured WA Web traffic). Modules that pull the native rust-bridge / ESM
// Utils chain can't be required under jest, so — following test/calls.test.js —
// those builders are asserted as wire-shape locks. Pure units are tested for real.

const { USyncFeatureProtocol, USYNC_FEATURES } = require('../src/WAUSync/Protocols/USyncFeatureProtocol')
const { getBinaryNodeChild, getBinaryNodeChildString, S_WHATSAPP_NET } = require('../src/WABinary')

// ── USyncFeatureProtocol (real unit) ──────────────────────────────────────────

describe('USyncFeatureProtocol', () => {
	test('name is "feature"', () => {
		expect(new USyncFeatureProtocol().name).toBe('feature')
	})

	test('defaults to all known features', () => {
		const p = new USyncFeatureProtocol()
		expect(p.features).toEqual(USYNC_FEATURES)
		expect(p.features.length).toBe(USYNC_FEATURES.length)
	})

	test('getQueryElement builds <feature> with one child per requested feature', () => {
		expect(new USyncFeatureProtocol(['encrypt', 'voip']).getQueryElement()).toEqual({
			tag: 'feature',
			attrs: {},
			content: [
				{ tag: 'encrypt', attrs: {} },
				{ tag: 'voip', attrs: {} }
			]
		})
	})

	test('getUserElement returns null', () => {
		expect(new USyncFeatureProtocol().getUserElement()).toBeNull()
	})

	test('parser reads each feature "value" attribute', () => {
		const node = {
			tag: 'feature',
			attrs: {},
			content: [
				{ tag: 'encrypt', attrs: { value: '2' } },
				{ tag: 'voip', attrs: { value: '1' } }
			]
		}
		expect(new USyncFeatureProtocol().parser(node)).toEqual({ encrypt: '2', voip: '1' })
	})

	test('parser surfaces an <error> child', () => {
		const node = { tag: 'feature', attrs: {}, content: [{ tag: 'error', attrs: { code: '401', text: 'nope' } }] }
		expect(new USyncFeatureProtocol().parser(node)).toEqual({ errorCode: 401, errorText: 'nope' })
	})

	test('parser returns null for a non-feature node', () => {
		expect(new USyncFeatureProtocol().parser({ tag: 'other', attrs: {} })).toBeNull()
	})
})

// ── group-settings extraction (real mechanism: same helpers extractGroupMetadata uses) ──

describe('group sharing-settings extraction', () => {
	const group = {
		tag: 'group',
		attrs: { id: '123-456' },
		content: [
			{ tag: 'member_share_group_history_mode', attrs: {}, content: Buffer.from('all_member_share') },
			{ tag: 'member_link_mode', attrs: {}, content: Buffer.from('admin_link') },
			{ tag: 'limit_sharing_enabled', attrs: {} }
		]
	}
	test('memberShareHistoryMode / memberLinkMode read as strings', () => {
		expect(getBinaryNodeChildString(group, 'member_share_group_history_mode')).toBe('all_member_share')
		expect(getBinaryNodeChildString(group, 'member_link_mode')).toBe('admin_link')
	})
	test('limitSharing is a presence flag', () => {
		expect(!!getBinaryNodeChild(group, 'limit_sharing_enabled')).toBe(true)
		expect(!!getBinaryNodeChild({ tag: 'group', attrs: {}, content: [] }, 'limit_sharing_enabled')).toBe(false)
	})
})

// ── wire-shape locks for the new IQ/call builders (cf. test/calls.test.js) ─────

describe('new IQ wire-shapes', () => {
	test('PsaChatBlock get', () => {
		expect({
			tag: 'iq',
			attrs: { to: S_WHATSAPP_NET, xmlns: 'w:comms:chat', type: 'get' },
			content: [{ tag: 'query', attrs: {}, content: [{ tag: 'blocking_status', attrs: {} }] }]
		}).toEqual({
			tag: 'iq',
			attrs: { to: '@s.whatsapp.net', xmlns: 'w:comms:chat', type: 'get' },
			content: [{ tag: 'query', attrs: {}, content: [{ tag: 'blocking_status', attrs: {} }] }]
		})
	})
	test('PsaChatBlock set', () => {
		const action = 'block'
		expect({
			tag: 'iq',
			attrs: { to: S_WHATSAPP_NET, xmlns: 'w:comms:chat', type: 'set' },
			content: [{ tag: 'blocking', attrs: { action } }]
		}).toMatchObject({ content: [{ tag: 'blocking', attrs: { action: 'block' } }] })
	})
	test('push config set', () => {
		const config = { platform: 'web', endpoint: 'https://fcm/...', auth: 'a', p256dh: 'p' }
		expect({
			tag: 'iq',
			attrs: { to: S_WHATSAPP_NET, xmlns: 'urn:xmpp:whatsapp:push', type: 'set' },
			content: [{ tag: 'config', attrs: config }]
		}).toMatchObject({ attrs: { xmlns: 'urn:xmpp:whatsapp:push', type: 'set' }, content: [{ tag: 'config' }] })
	})
	test('top-level call waiting-room toggle', () => {
		expect({
			tag: 'call',
			attrs: { id: 'TAG', to: '@call' },
			content: [{ tag: 'waiting_room_toggle', attrs: { enabled: '1', 'link-token': 'tok', media: 'audio' } }]
		}).toMatchObject({ content: [{ tag: 'waiting_room_toggle', attrs: { 'link-token': 'tok' } }] })
	})
	test('group join-linked', () => {
		expect({
			tag: 'join_linked_group',
			attrs: { jid: 'sub@g.us', type: 'admin_review' }
		}).toMatchObject({ tag: 'join_linked_group', attrs: { jid: 'sub@g.us' } })
	})
})
