'use strict'

const { processContactAction, emitSyncActionResults } = require('../src/Utils/sync-action-utils')

const noopLogger = { warn: () => {} }

describe('processContactAction', () => {
	test('returns contacts.upsert event for a PN user', () => {
		const results = processContactAction(
			{ fullName: 'Alice', lidJid: null, pnJid: null },
			'491234567890@s.whatsapp.net',
			noopLogger
		)
		expect(results).toHaveLength(1)
		expect(results[0].event).toBe('contacts.upsert')
		expect(results[0].data[0].name).toBe('Alice')
		expect(results[0].data[0].id).toBe('491234567890@s.whatsapp.net')
	})

	test('uses firstName when fullName is absent', () => {
		const results = processContactAction({ firstName: 'Bob' }, '491234567890@s.whatsapp.net', noopLogger)
		expect(results[0].data[0].name).toBe('Bob')
	})

	test('falls back to username when no name fields', () => {
		const results = processContactAction({ username: 'alice123' }, '491234567890@s.whatsapp.net', noopLogger)
		expect(results[0].data[0].name).toBe('alice123')
	})

	test('name is undefined when all name fields empty', () => {
		const results = processContactAction({}, '491234567890@s.whatsapp.net', noopLogger)
		expect(results[0].data[0].name).toBeUndefined()
	})

	test('phoneNumber is the PN id for PN users', () => {
		const jid = '491234567890@s.whatsapp.net'
		const results = processContactAction({ pnJid: null }, jid, noopLogger)
		expect(results[0].data[0].phoneNumber).toBe(jid)
	})

	test('phoneNumber falls back to pnJid for LID users', () => {
		const results = processContactAction({ pnJid: '491234567890@s.whatsapp.net' }, '12345@lid', noopLogger)
		expect(results[0].data[0].phoneNumber).toBe('491234567890@s.whatsapp.net')
	})

	test('adds lid-mapping.update when LID-PN pair is present', () => {
		const results = processContactAction(
			{ lidJid: '12345@lid', fullName: 'Alice', pnJid: '491234567890@s.whatsapp.net' },
			'491234567890@s.whatsapp.net',
			noopLogger
		)
		expect(results).toHaveLength(2)
		const mapping = results.find(r => r.event === 'lid-mapping.update')
		expect(mapping).toBeDefined()
		expect(mapping.data.lid).toBe('12345@lid')
		expect(mapping.data.pn).toBe('491234567890@s.whatsapp.net')
	})

	test('does not emit lid-mapping.update when lidJid is absent', () => {
		const results = processContactAction({ lidJid: null }, '491234567890@s.whatsapp.net', noopLogger)
		expect(results.every(r => r.event !== 'lid-mapping.update')).toBe(true)
	})

	test('does not emit lid-mapping.update when id is LID (not PN)', () => {
		const results = processContactAction(
			{ lidJid: '12345@lid' },
			'12345@lid', // id itself is LID, not PN
			noopLogger
		)
		expect(results.every(r => r.event !== 'lid-mapping.update')).toBe(true)
	})

	test('returns empty array when id is falsy', () => {
		const results = processContactAction({ fullName: 'Alice' }, null, noopLogger)
		expect(results).toHaveLength(0)
	})

	test('works without logger', () => {
		expect(() => processContactAction({ fullName: 'Alice' }, null, undefined)).not.toThrow()
	})

	test('username is set on the contact', () => {
		const results = processContactAction(
			{ username: 'alice', fullName: 'Alice' },
			'491234567890@s.whatsapp.net',
			noopLogger
		)
		expect(results[0].data[0].username).toBe('alice')
	})
})

describe('emitSyncActionResults', () => {
	test('emits contacts.upsert for contact results', () => {
		const emitted = {}
		const ev = {
			emit: (event, data) => {
				emitted[event] = data
			}
		}
		emitSyncActionResults(ev, [{ event: 'contacts.upsert', data: [{ id: '491@s.whatsapp.net' }] }])
		expect(emitted['contacts.upsert']).toEqual([{ id: '491@s.whatsapp.net' }])
	})

	test('emits lid-mapping.update for mapping results', () => {
		const emitted = {}
		const ev = {
			emit: (event, data) => {
				emitted[event] = data
			}
		}
		emitSyncActionResults(ev, [{ event: 'lid-mapping.update', data: { lid: '12345@lid', pn: '491@s.whatsapp.net' } }])
		expect(emitted['lid-mapping.update']).toEqual({ lid: '12345@lid', pn: '491@s.whatsapp.net' })
	})

	test('handles empty results array without error', () => {
		const ev = { emit: jest.fn() }
		expect(() => emitSyncActionResults(ev, [])).not.toThrow()
		expect(ev.emit).not.toHaveBeenCalled()
	})
})
