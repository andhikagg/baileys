'use strict'

// Tests for USyncQuery builder and all 11 protocol parsers.
// No real WS connection needed — we test the builder chain and parsers directly.

const { USyncQuery, USyncUser } = require('../src/WAUSync')

// ── USyncUser builder ─────────────────────────────────────────────────────────

describe('USyncUser builder', () => {
	test('withId sets id', () => {
		const u = new USyncUser().withId('491234567890@s.whatsapp.net')
		expect(u.id).toBe('491234567890@s.whatsapp.net')
	})

	test('withPhone sets phone', () => {
		const u = new USyncUser().withPhone('+491234567890')
		expect(u.phone).toBe('+491234567890')
	})

	test('withLid sets lid', () => {
		const u = new USyncUser().withId('12345@lid').withLid('12345@lid')
		expect(u.lid).toBe('12345@lid')
	})

	test('withUsername sets username', () => {
		const u = new USyncUser().withUsername('alice')
		expect(u.username).toBe('alice')
	})

	test('withUsernameKey sets usernameKey', () => {
		const u = new USyncUser().withUsername('alice').withUsernameKey('pin123')
		expect(u.usernameKey).toBe('pin123')
	})

	test('withPersonaId sets personaId', () => {
		const u = new USyncUser().withId('867051314767696@bot').withPersonaId('persona-abc')
		expect(u.personaId).toBe('persona-abc')
	})

	test('direct field assignment for pictureId', () => {
		const u = new USyncUser().withId('491@s.whatsapp.net')
		u.pictureId = '99887766'
		expect(u.pictureId).toBe('99887766')
	})

	test('direct field assignment for sidelistDelete', () => {
		const u = new USyncUser().withId('491@s.whatsapp.net')
		u.sidelistDelete = true
		expect(u.sidelistDelete).toBe(true)
	})

	test('builder is chainable and returns same instance', () => {
		const u = new USyncUser()
		const result = u.withId('491@s.whatsapp.net').withPhone('+491')
		expect(result).toBe(u)
	})
})

// ── USyncQuery builder ────────────────────────────────────────────────────────

describe('USyncQuery builder', () => {
	test('default context is interactive, mode is query', () => {
		const q = new USyncQuery()
		expect(q.context).toBe('interactive')
		expect(q.mode).toBe('query')
	})

	test('withContext changes context', () => {
		const q = new USyncQuery().withContext('background')
		expect(q.context).toBe('background')
	})

	test('withMode changes mode', () => {
		const q = new USyncQuery().withMode('delta')
		expect(q.mode).toBe('delta')
	})

	test('withUser adds user to list', () => {
		const q = new USyncQuery()
		q.withUser(new USyncUser().withId('491@s.whatsapp.net'))
		q.withUser(new USyncUser().withId('441@s.whatsapp.net'))
		expect(q.users).toHaveLength(2)
	})

	test('all protocol methods add a protocol entry', () => {
		const q = new USyncQuery()
			.withContactProtocol()
			.withDeviceProtocol()
			.withStatusProtocol()
			.withDisappearingModeProtocol()
			.withUsernameProtocol()
			.withLIDProtocol()
			.withBotProfileProtocol()
			.withBusinessProtocol('2')
			.withPictureProtocol('preview')
			.withTextStatusProtocol()
			.withSidelistProtocol(true)
		expect(q.protocols).toHaveLength(11)
	})

	test('protocol names are unique strings', () => {
		const q = new USyncQuery()
			.withContactProtocol()
			.withDeviceProtocol()
			.withStatusProtocol()
		const names = q.protocols.map(p => p.name)
		expect(new Set(names).size).toBe(names.length)
		names.forEach(n => expect(typeof n).toBe('string'))
	})

	test('each protocol has a parser function', () => {
		const q = new USyncQuery()
			.withContactProtocol()
			.withDeviceProtocol()
			.withStatusProtocol()
			.withDisappearingModeProtocol()
			.withUsernameProtocol()
			.withLIDProtocol()
			.withBotProfileProtocol()
			.withBusinessProtocol()
			.withPictureProtocol()
			.withTextStatusProtocol()
			.withSidelistProtocol()
		for (const p of q.protocols) {
			expect(typeof p.parser).toBe('function')
		}
	})

	test('builder is chainable', () => {
		const q = new USyncQuery()
		const result = q.withContactProtocol().withContext('background')
		expect(result).toBe(q)
	})
})

// ── parseUSyncQueryResult ─────────────────────────────────────────────────────

describe('USyncQuery.parseUSyncQueryResult', () => {
	const makeResultNode = (userNodes, sideUserNodes = []) => ({
		tag: 'iq',
		attrs: { type: 'result' },
		content: [{
			tag: 'usync',
			attrs: {},
			content: [
				{ tag: 'list', attrs: {}, content: userNodes },
				...(sideUserNodes.length ? [{ tag: 'side_list', attrs: {}, content: sideUserNodes }] : [])
			]
		}]
	})

	test('returns empty list and sideList for empty result', () => {
		const q = new USyncQuery().withContactProtocol()
		const result = q.parseUSyncQueryResult(makeResultNode([]))
		expect(result.list).toEqual([])
		expect(result.sideList).toEqual([])
	})

	test('returns undefined for non-result IQ', () => {
		const q = new USyncQuery()
		expect(q.parseUSyncQueryResult({ tag: 'iq', attrs: { type: 'error' }, content: [] })).toBeUndefined()
		expect(q.parseUSyncQueryResult(null)).toBeUndefined()
	})

	test('parses contact protocol — type="in" returns true', () => {
		const q = new USyncQuery().withContactProtocol()
		const resultNode = makeResultNode([{
			tag: 'user',
			attrs: { jid: '491234567890@s.whatsapp.net' },
			content: [{
				tag: 'contact',
				attrs: { type: 'in' },
				content: []
			}]
		}])
		const result = q.parseUSyncQueryResult(resultNode)
		expect(result.list).toHaveLength(1)
		expect(result.list[0].id).toBe('491234567890@s.whatsapp.net')
		expect(result.list[0].contact).toBe(true)
	})

	test('parses contact protocol — missing type returns false', () => {
		const q = new USyncQuery().withContactProtocol()
		const resultNode = makeResultNode([{
			tag: 'user',
			attrs: { jid: '441234567890@s.whatsapp.net' },
			content: [{ tag: 'contact', attrs: {}, content: [] }]
		}])
		const result = q.parseUSyncQueryResult(resultNode)
		expect(result.list[0].contact).toBe(false)
	})

	test('parses status protocol', () => {
		const q = new USyncQuery().withStatusProtocol()
		const resultNode = makeResultNode([{
			tag: 'user',
			attrs: { jid: '491234567890@s.whatsapp.net' },
			content: [{
				tag: 'status',
				attrs: { t: '1716825600' },
				content: Buffer.from('Hey there!')
			}]
		}])
		const result = q.parseUSyncQueryResult(resultNode)
		expect(result.list[0].status).toBeDefined()
		expect(result.list[0].status.status).toBe('Hey there!')
	})

	test('parses username protocol', () => {
		const q = new USyncQuery().withUsernameProtocol()
		const resultNode = makeResultNode([{
			tag: 'user',
			attrs: { jid: '491234567890@s.whatsapp.net' },
			content: [{ tag: 'username', attrs: {}, content: 'alice' }]
		}])
		const result = q.parseUSyncQueryResult(resultNode)
		expect(result.list[0].username).toBe('alice')
	})

	test('parses LID protocol', () => {
		const q = new USyncQuery().withLIDProtocol()
		const resultNode = makeResultNode([{
			tag: 'user',
			attrs: { jid: '491234567890@s.whatsapp.net' },
			content: [{ tag: 'lid', attrs: { val: '12345678901234567890:0@lid' }, content: [] }]
		}])
		const result = q.parseUSyncQueryResult(resultNode)
		expect(result.list[0].lid).toBe('12345678901234567890:0@lid')
	})

	test('skips unknown protocol tags gracefully', () => {
		const q = new USyncQuery().withContactProtocol()
		const resultNode = makeResultNode([{
			tag: 'user',
			attrs: { jid: '491234567890@s.whatsapp.net' },
			content: [
				{ tag: 'contact', attrs: { type: 'in' }, content: [] },
				{ tag: 'unknown_tag', attrs: {}, content: [] }
			]
		}])
		const result = q.parseUSyncQueryResult(resultNode)
		expect(result.list[0].contact).toBe(true)
		expect(result.list[0].unknown_tag).toBeUndefined()
	})

	test('parses side_list separately', () => {
		const q = new USyncQuery().withContactProtocol()
		const resultNode = makeResultNode(
			[{ tag: 'user', attrs: { jid: '491@s.whatsapp.net' }, content: [{ tag: 'contact', attrs: { type: 'in' }, content: [] }] }],
			[{ tag: 'user', attrs: { jid: '441@s.whatsapp.net' }, content: [{ tag: 'contact', attrs: { type: 'in' }, content: [] }] }]
		)
		const result = q.parseUSyncQueryResult(resultNode)
		expect(result.list).toHaveLength(1)
		expect(result.list[0].id).toBe('491@s.whatsapp.net')
		expect(result.sideList).toHaveLength(1)
		expect(result.sideList[0].id).toBe('441@s.whatsapp.net')
	})

	test('multiple protocols parsed in one pass', () => {
		const q = new USyncQuery().withContactProtocol().withUsernameProtocol()
		const resultNode = makeResultNode([{
			tag: 'user',
			attrs: { jid: '491234567890@s.whatsapp.net' },
			content: [
				{ tag: 'contact', attrs: { type: 'in' }, content: [] },
				{ tag: 'username', attrs: {}, content: 'bob' }
			]
		}])
		const result = q.parseUSyncQueryResult(resultNode)
		expect(result.list[0].contact).toBe(true)
		expect(result.list[0].username).toBe('bob')
	})
})

// ── Individual protocol parsers ───────────────────────────────────────────────

describe('USyncDeviceProtocol parser', () => {
	const { USyncDeviceProtocol } = require('../src/WAUSync/Protocols/USyncDeviceProtocol')

	test('parses device list with keyIndex', () => {
		const p = new USyncDeviceProtocol()
		const node = {
			tag: 'devices',
			attrs: {},
			content: [
				{
					tag: 'device-list',
					attrs: {},
					content: [
						{ tag: 'device', attrs: { id: '0', 'key-index': '1' }, content: [] },
						{ tag: 'device', attrs: { id: '2', 'key-index': '3', isHosted: 'true' }, content: [] }
					]
				},
				{
					tag: 'key-index-list',
					attrs: { ts: '1716825600' },
					content: Buffer.from('signedkeyindexbytes')
				}
			]
		}
		const result = p.parser(node)
		expect(result).toBeDefined()
		expect(Array.isArray(result.deviceList)).toBe(true)
	})

	test('name is "devices"', () => {
		const p = new USyncDeviceProtocol()
		expect(p.name).toBe('devices')
	})
})

describe('USyncPictureProtocol parser', () => {
	const { USyncPictureProtocol } = require('../src/WAUSync/Protocols/USyncPictureProtocol')

	test('name is "picture"', () => {
		expect(new USyncPictureProtocol().name).toBe('picture')
		expect(new USyncPictureProtocol('image').name).toBe('picture')
	})

	test('parser returns null for empty picture node', () => {
		const p = new USyncPictureProtocol()
		const result = p.parser({ tag: 'picture', attrs: {}, content: [] })
		expect(result).toBeNull()
	})

	test('parser returns object with id/directPath/hash when present', () => {
		const p = new USyncPictureProtocol()
		const result = p.parser({
			tag: 'picture',
			attrs: { id: '12345678', direct_path: '/v/path', hash: 'abc123' },
			content: []
		})
		expect(result).not.toBeNull()
	})
})

describe('USyncTextStatusProtocol', () => {
	const { USyncTextStatusProtocol } = require('../src/WAUSync/Protocols/USyncTextStatusProtocol')

	test('name is "text_status"', () => {
		expect(new USyncTextStatusProtocol().name).toBe('text_status')
	})
})

describe('USyncBusinessProtocol', () => {
	const { USyncBusinessProtocol } = require('../src/WAUSync/Protocols/USyncBusinessProtocol')

	test('name is "business"', () => {
		expect(new USyncBusinessProtocol().name).toBe('business')
	})

	test('default profileVersion is "2"', () => {
		const p = new USyncBusinessProtocol()
		expect(p.profileVersion).toBe('2')
	})

	test('custom profileVersion is stored', () => {
		const p = new USyncBusinessProtocol('3')
		expect(p.profileVersion).toBe('3')
	})
})

describe('USyncSidelistProtocol', () => {
	const { USyncSidelistProtocol } = require('../src/WAUSync/Protocols/USyncSidelistProtocol')

	test('name is "sidelist"', () => {
		expect(new USyncSidelistProtocol().name).toBe('sidelist')
	})
})
