'use strict'

const { USyncBotProfileProtocol } = require('../src/WAUSync/Protocols/USyncBotProfileProtocol')
const { USyncBusinessProtocol } = require('../src/WAUSync/Protocols/USyncBusinessProtocol')
const { USyncContactProtocol } = require('../src/WAUSync/Protocols/USyncContactProtocol')
const { USyncDisappearingModeProtocol } = require('../src/WAUSync/Protocols/USyncDisappearingModeProtocol')
const { USyncSidelistProtocol } = require('../src/WAUSync/Protocols/USyncSidelistProtocol')
const { USyncTextStatusProtocol } = require('../src/WAUSync/Protocols/USyncTextStatusProtocol')

// helper: build a minimal binary node
const node = (tag, attrs = {}, content = undefined) => ({ tag, attrs, content })
// assertNodeErrorFree throws when the node has an <error> child node
const errNode = tag => node(tag, {}, [node('error', { text: 'test error', code: '404' })])

// ── USyncBotProfileProtocol ───────────────────────────────────────────────────
describe('USyncBotProfileProtocol', () => {
	const proto = new USyncBotProfileProtocol()

	test('name is "bot"', () => {
		expect(proto.name).toBe('bot')
	})

	test('getQueryElement returns bot node with profile v=1', () => {
		const el = proto.getQueryElement()
		expect(el.tag).toBe('bot')
		expect(el.content[0].tag).toBe('profile')
		expect(el.content[0].attrs.v).toBe('1')
	})

	test('getUserElement returns bot node with persona_id', () => {
		const el = proto.getUserElement({ personaId: 'p42' })
		expect(el.tag).toBe('bot')
		expect(el.content[0].attrs.persona_id).toBe('p42')
	})

	test('parser: empty bot node → default result shape', () => {
		const botNode = node('bot', {}, [node('profile', { persona_id: 'p1' }, [])])
		const userNode = node('user', { jid: 'bot@s.whatsapp.net' }, [botNode])
		const result = proto.parser(userNode)
		expect(result).toHaveProperty('jid', 'bot@s.whatsapp.net')
		expect(result).toHaveProperty('commands')
		expect(result).toHaveProperty('prompts')
		expect(Array.isArray(result.commands)).toBe(true)
		expect(Array.isArray(result.prompts)).toBe(true)
	})

	test('parser: isDefault true when profile has "default" child', () => {
		const profileNode = node('profile', { persona_id: 'p1' }, [node('default', {})])
		const botNode = node('bot', {}, [profileNode])
		const userNode = node('user', { jid: 'x@s' }, [botNode])
		const result = proto.parser(userNode)
		expect(result.isDefault).toBe(true)
	})
})

// ── USyncBusinessProtocol ─────────────────────────────────────────────────────
describe('USyncBusinessProtocol', () => {
	const proto = new USyncBusinessProtocol()

	test('name is "business"', () => {
		expect(proto.name).toBe('business')
	})

	test('default profileVersion is "2"', () => {
		expect(proto.profileVersion).toBe('2')
	})

	test('custom profileVersion', () => {
		const p = new USyncBusinessProtocol('3')
		expect(p.profileVersion).toBe('3')
	})

	test('getQueryElement contains verified_name and profile', () => {
		const el = proto.getQueryElement()
		expect(el.tag).toBe('business')
		const tags = el.content.map(c => c.tag)
		expect(tags).toContain('verified_name')
		expect(tags).toContain('profile')
	})

	test('getUserElement: no fields → null (empty children)', () => {
		const el = proto.getUserElement({})
		expect(el).toBeNull()
	})

	test('getUserElement: with verifiedNameSerial → includes verified_name', () => {
		const el = proto.getUserElement({ verifiedNameSerial: 'serial-1' })
		expect(el).not.toBeNull()
		const tags = el.content.map(c => c.tag)
		expect(tags).toContain('verified_name')
	})

	test('getUserElement: with businessProfileTag → includes profile', () => {
		const el = proto.getUserElement({ businessProfileTag: 'tag-1' })
		expect(el.content.find(c => c.tag === 'profile').attrs.tag).toBe('tag-1')
	})

	test('parser: non-business node returns null', () => {
		expect(proto.parser(node('contact', {}))).toBeNull()
	})

	test('parser: business node returns verifiedName/profileTag/pnJid', () => {
		const verifiedNode = node('verified_name', { verified_level: 'high' }, 'Acme Inc')
		const profileNode = node('profile', { tag: 'tag123' })
		const businessNode = node('business', { pn_jid: '491@s.whatsapp.net' }, [verifiedNode, profileNode])
		const result = proto.parser(businessNode)
		expect(result.verifiedName).toBe('Acme Inc')
		expect(result.verifiedLevel).toBe('high')
		expect(result.profileTag).toBe('tag123')
		expect(result.pnJid).toBe('491@s.whatsapp.net')
	})

	test('parser: node with error child throws', () => {
		expect(() => proto.parser(errNode('business'))).toThrow()
	})
})

// ── USyncContactProtocol ──────────────────────────────────────────────────────
describe('USyncContactProtocol', () => {
	const proto = new USyncContactProtocol()

	test('name is "contact"', () => {
		expect(proto.name).toBe('contact')
	})

	test('getQueryElement returns contact tag', () => {
		expect(proto.getQueryElement().tag).toBe('contact')
	})

	test('getUserElement: user with phone → content = phone', () => {
		const el = proto.getUserElement({ phone: '+491234567890' })
		expect(el.tag).toBe('contact')
		expect(el.content).toBe('+491234567890')
	})

	test('getUserElement: user with username → username attr', () => {
		const el = proto.getUserElement({ username: 'myuser' })
		expect(el.attrs.username).toBe('myuser')
		expect(el.attrs.pin).toBeUndefined()
	})

	test('getUserElement: username + usernameKey → pin attr', () => {
		const el = proto.getUserElement({ username: 'u', usernameKey: 'k123' })
		expect(el.attrs.pin).toBe('k123')
	})

	test('getUserElement: username + lid → lid attr', () => {
		const el = proto.getUserElement({ username: 'u', lid: 'l@lid' })
		expect(el.attrs.lid).toBe('l@lid')
	})

	test('getUserElement: user with type → type attr', () => {
		const el = proto.getUserElement({ type: 'registered' })
		expect(el.attrs.type).toBe('registered')
	})

	test('getUserElement: empty user → empty contact attrs', () => {
		const el = proto.getUserElement({})
		expect(el.tag).toBe('contact')
		expect(Object.keys(el.attrs)).toHaveLength(0)
	})

	test('parser: contact node with type=in → true', () => {
		expect(proto.parser(node('contact', { type: 'in' }))).toBe(true)
	})

	test('parser: contact node without type=in → false', () => {
		expect(proto.parser(node('contact', { type: 'out' }))).toBe(false)
	})

	test('parser: contact node with error child throws', () => {
		expect(() => proto.parser(errNode('contact'))).toThrow()
	})

	test('parser: non-contact node → false', () => {
		expect(proto.parser(node('business', {}))).toBe(false)
	})
})

// ── USyncDisappearingModeProtocol ─────────────────────────────────────────────
describe('USyncDisappearingModeProtocol', () => {
	const proto = new USyncDisappearingModeProtocol()

	test('name is "disappearing_mode"', () => {
		expect(proto.name).toBe('disappearing_mode')
	})

	test('getQueryElement returns disappearing_mode tag', () => {
		expect(proto.getQueryElement().tag).toBe('disappearing_mode')
	})

	test('getUserElement always returns null', () => {
		expect(proto.getUserElement({ foo: 1 })).toBeNull()
	})

	test('parser: returns duration and setAt', () => {
		const n = node('disappearing_mode', { duration: '86400', t: '1700000000' })
		const result = proto.parser(n)
		expect(result.duration).toBe(86400)
		expect(result.setAt).toBeInstanceOf(Date)
		expect(result.setAt.getTime()).toBe(1700000000 * 1000)
	})

	test('parser: missing t defaults to epoch', () => {
		const n = node('disappearing_mode', { duration: '0' })
		const result = proto.parser(n)
		expect(result.setAt.getTime()).toBe(0)
	})

	test('parser: error node throws', () => {
		expect(() => proto.parser(errNode('disappearing_mode'))).toThrow()
	})

	test('parser: wrong tag returns undefined', () => {
		expect(proto.parser(node('other', {}))).toBeUndefined()
	})
})

// ── USyncSidelistProtocol ─────────────────────────────────────────────────────
describe('USyncSidelistProtocol', () => {
	test('name is "sidelist"', () => {
		expect(new USyncSidelistProtocol().name).toBe('sidelist')
	})

	test('default: getQueryElement includes addressing_mode=lid', () => {
		const el = new USyncSidelistProtocol().getQueryElement()
		expect(el.attrs.addressing_mode).toBe('lid')
	})

	test('useLidAddressing=false: no addressing_mode attr', () => {
		const el = new USyncSidelistProtocol(false).getQueryElement()
		expect(el.attrs.addressing_mode).toBeUndefined()
	})

	test('getUserElement: sidelistDelete → type=delete', () => {
		const el = new USyncSidelistProtocol().getUserElement({ sidelistDelete: true })
		expect(el.attrs.type).toBe('delete')
	})

	test('getUserElement: no sidelistDelete → null', () => {
		expect(new USyncSidelistProtocol().getUserElement({})).toBeNull()
	})

	test('parser: sidelist node → type attr', () => {
		const result = new USyncSidelistProtocol().parser(node('sidelist', { type: 'full' }))
		expect(result.type).toBe('full')
	})

	test('parser: side_list tag also matches', () => {
		const result = new USyncSidelistProtocol().parser(node('side_list', {}))
		expect(result).not.toBeNull()
		expect(result.type).toBeNull()
	})

	test('parser: other tag → null', () => {
		expect(new USyncSidelistProtocol().parser(node('other', {}))).toBeNull()
	})

	test('parser: error node throws', () => {
		expect(() => new USyncSidelistProtocol().parser(errNode('sidelist'))).toThrow()
	})
})

// ── USyncTextStatusProtocol ───────────────────────────────────────────────────
describe('USyncTextStatusProtocol', () => {
	const proto = new USyncTextStatusProtocol()

	test('name is "text_status"', () => {
		expect(proto.name).toBe('text_status')
	})

	test('getQueryElement returns text_status tag', () => {
		expect(proto.getQueryElement().tag).toBe('text_status')
	})

	test('getUserElement always returns null', () => {
		expect(proto.getUserElement()).toBeNull()
	})

	test('parser: non-text_status node → null', () => {
		expect(proto.parser(node('other', {}))).toBeNull()
	})

	test('parser: error node throws', () => {
		expect(() => proto.parser(errNode('text_status'))).toThrow()
	})

	test('parser: basic status node → text, setAt', () => {
		const n = node('text_status', {
			text: 'Hello world',
			last_update_time: '1700000000'
		})
		const result = proto.parser(n)
		expect(result.text).toBe('Hello world')
		expect(result.emoji).toBeNull()
		expect(result.setAt).toBeInstanceOf(Date)
		expect(result.setAt.getTime()).toBe(1700000000 * 1000)
		expect(result.expiresAt).toBeNull()
	})

	test('parser: with ephemeral_duration_sec → expiresAt set', () => {
		const n = node('text_status', {
			text: 'Ephemeral',
			last_update_time: '1700000000',
			ephemeral_duration_sec: '3600'
		})
		const result = proto.parser(n)
		expect(result.expiresAt).toBeInstanceOf(Date)
		expect(result.expiresAt.getTime()).toBe((1700000000 + 3600) * 1000)
	})

	test('parser: emoji child node → emoji attr', () => {
		const emojiNode = node('emoji', { content: '😊' })
		const n = node('text_status', { last_update_time: '0' }, [emojiNode])
		const result = proto.parser(n)
		expect(result.emoji).toBe('😊')
	})

	test('parser: no last_update_time defaults to epoch', () => {
		const n = node('text_status', {})
		const result = proto.parser(n)
		expect(result.setAt.getTime()).toBe(0)
	})
})
