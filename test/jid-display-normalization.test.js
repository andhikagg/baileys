'use strict'

const {
	normalizeMessageForDisplayJids,
	normalizeMentionedJidsForSend
} = require('../src/Utils/jid-display-normalization')

const noopLogger = { debug: () => {}, warn: () => {} }
const noopRepo = {}

describe('normalizeMessageForDisplayJids', () => {
	test('returns messageInfo unchanged when no key', async () => {
		const msg = { message: {} }
		const result = await normalizeMessageForDisplayJids(msg, noopRepo, noopLogger)
		expect(result).toBe(msg)
	})

	test('null input returns null', async () => {
		const result = await normalizeMessageForDisplayJids(null, noopRepo, noopLogger)
		expect(result).toBeNull()
	})

	test('PN remoteJid passes through unchanged', async () => {
		const msg = {
			key: { remoteJid: '491234567890@s.whatsapp.net', fromMe: false },
			message: {}
		}
		const result = await normalizeMessageForDisplayJids(msg, noopRepo, noopLogger)
		expect(result.key.remoteJid).toBe('491234567890@s.whatsapp.net')
	})

	test('group remoteJid passes through unchanged', async () => {
		const msg = {
			key: { remoteJid: '120363@g.us' },
			message: {}
		}
		const result = await normalizeMessageForDisplayJids(msg, noopRepo, noopLogger)
		expect(result.key.remoteJid).toBe('120363@g.us')
	})

	test('LID remoteJid falls back to PN form when no mapping', async () => {
		const msg = {
			key: { remoteJid: '12345@lid' },
			message: {}
		}
		const result = await normalizeMessageForDisplayJids(msg, noopRepo, noopLogger)
		// fallback: strips device part and maps to s.whatsapp.net
		expect(result.key.remoteJid).toBe('12345@s.whatsapp.net')
	})

	test('LID resolved via hint from key.remoteJidAlt', async () => {
		const msg = {
			key: {
				remoteJid: '12345@lid',
				remoteJidAlt: '491234567890@s.whatsapp.net'
			},
			message: {}
		}
		const result = await normalizeMessageForDisplayJids(msg, noopRepo, noopLogger)
		expect(result.key.remoteJid).toBe('491234567890@s.whatsapp.net')
	})

	test('undefined participant stays undefined', async () => {
		const msg = {
			key: { remoteJid: '120363@g.us', participant: undefined },
			message: {}
		}
		const result = await normalizeMessageForDisplayJids(msg, noopRepo, noopLogger)
		expect(result.key.participant).toBeUndefined()
	})

	test('mentionedJid in message is normalized', async () => {
		const msg = {
			key: { remoteJid: '120363@g.us' },
			message: {
				extendedTextMessage: {
					mentionedJid: ['491111@s.whatsapp.net', '492222@s.whatsapp.net']
				}
			}
		}
		const result = await normalizeMessageForDisplayJids(msg, noopRepo, noopLogger)
		// PN JIDs are not LID users, so they pass through
		expect(result.message.extendedTextMessage.mentionedJid).toEqual(['491111@s.whatsapp.net', '492222@s.whatsapp.net'])
	})
})

describe('normalizeMentionedJidsForSend', () => {
	test('returns non-array input unchanged', async () => {
		const result = await normalizeMentionedJidsForSend(null, null, noopRepo, noopLogger)
		expect(result).toBeNull()
	})

	test('PN JIDs pass through unchanged', async () => {
		const mentions = ['491234@s.whatsapp.net', '492345@s.whatsapp.net']
		const result = await normalizeMentionedJidsForSend(mentions, null, noopRepo, noopLogger)
		expect(result).toEqual(mentions)
	})

	test('empty array returns empty array', async () => {
		const result = await normalizeMentionedJidsForSend([], null, noopRepo, noopLogger)
		expect(result).toEqual([])
	})

	test('LID mention falls back to PN form when no groupData mapping', async () => {
		const result = await normalizeMentionedJidsForSend(['12345@lid'], null, noopRepo, noopLogger)
		expect(result).toEqual(['12345@s.whatsapp.net'])
	})

	test('resolves LID via groupData participants', async () => {
		const groupData = {
			participants: [{ id: '12345@lid', phoneNumber: '491234567890@s.whatsapp.net' }]
		}
		const result = await normalizeMentionedJidsForSend(['12345@lid'], groupData, noopRepo, noopLogger)
		expect(result[0]).toBe('491234567890@s.whatsapp.net')
	})
})
