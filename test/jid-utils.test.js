'use strict'

const {
	jidEncode,
	jidDecode,
	getBotJid,
	areJidsSameUser,
	isJidMetaAI,
	isPnUser,
	isInteropUser,
	isLidUser,
	isJidBroadcast,
	isJidGroup,
	isJidStatusBroadcast,
	isJidNewsletter,
	isHostedPnUser,
	isHostedLidUser,
	isJidBot,
	jidNormalizedUser,
	transferDevice,
	WAJIDDomains,
	S_WHATSAPP_NET,
	OFFICIAL_BIZ_JID,
	SERVER_JID,
	PSA_WID,
	STORIES_JID,
	META_AI_JID,
} = require('../src/WABinary/jid-utils')

describe('constants', () => {
	test('S_WHATSAPP_NET', () => expect(S_WHATSAPP_NET).toBe('@s.whatsapp.net'))
	test('STORIES_JID', () => expect(STORIES_JID).toBe('status@broadcast'))
	test('META_AI_JID', () => expect(META_AI_JID).toBe('13135550002@c.us'))
	test('OFFICIAL_BIZ_JID', () => expect(OFFICIAL_BIZ_JID).toBe('16505361212@c.us'))
	test('SERVER_JID', () => expect(SERVER_JID).toBe('server@c.us'))
	test('PSA_WID', () => expect(PSA_WID).toBe('0@c.us'))
})

describe('WAJIDDomains', () => {
	test('WHATSAPP = 0', () => expect(WAJIDDomains.WHATSAPP).toBe(0))
	test('LID = 1', () => expect(WAJIDDomains.LID).toBe(1))
	test('HOSTED = 128', () => expect(WAJIDDomains.HOSTED).toBe(128))
	test('HOSTED_LID = 129', () => expect(WAJIDDomains.HOSTED_LID).toBe(129))
})

describe('jidEncode', () => {
	test('basic user@server', () => {
		expect(jidEncode('491234567890', 's.whatsapp.net')).toBe('491234567890@s.whatsapp.net')
	})

	test('with device', () => {
		expect(jidEncode('491234567890', 's.whatsapp.net', 3)).toBe('491234567890:3@s.whatsapp.net')
	})

	test('with agent', () => {
		expect(jidEncode('491234567890', 's.whatsapp.net', undefined, 2)).toBe('491234567890_2@s.whatsapp.net')
	})

	test('with device and agent', () => {
		expect(jidEncode('491234567890', 's.whatsapp.net', 3, 2)).toBe('491234567890_2:3@s.whatsapp.net')
	})

	test('device 0 is included', () => {
		expect(jidEncode('491234567890', 's.whatsapp.net', 0)).toBe('491234567890:0@s.whatsapp.net')
	})

	test('device 0 is omitted for interop', () => {
		expect(jidEncode('491234567890', 'interop', 0)).toBe('491234567890@interop')
	})

	test('group jid', () => {
		expect(jidEncode('120363000000000000', 'g.us')).toBe('120363000000000000@g.us')
	})

	test('null user produces empty string prefix', () => {
		expect(jidEncode(null, 's.whatsapp.net')).toBe('@s.whatsapp.net')
	})
})

describe('jidDecode', () => {
	test('basic user', () => {
		const r = jidDecode('491234567890@s.whatsapp.net')
		expect(r).toEqual({ user: '491234567890', server: 's.whatsapp.net', domainType: WAJIDDomains.WHATSAPP, device: undefined })
	})

	test('with device', () => {
		const r = jidDecode('491234567890:3@s.whatsapp.net')
		expect(r).toEqual({ user: '491234567890', server: 's.whatsapp.net', domainType: WAJIDDomains.WHATSAPP, device: 3 })
	})

	test('lid domain type', () => {
		const r = jidDecode('491234567890@lid')
		expect(r?.domainType).toBe(WAJIDDomains.LID)
	})

	test('hosted domain type', () => {
		const r = jidDecode('491234567890@hosted')
		expect(r?.domainType).toBe(WAJIDDomains.HOSTED)
	})

	test('hosted.lid domain type', () => {
		const r = jidDecode('491234567890@hosted.lid')
		expect(r?.domainType).toBe(WAJIDDomains.HOSTED_LID)
	})

	test('group', () => {
		const r = jidDecode('120363000000000000@g.us')
		expect(r?.server).toBe('g.us')
		expect(r?.user).toBe('120363000000000000')
	})

	test('no @ returns undefined', () => {
		expect(jidDecode('invalid')).toBeUndefined()
	})

	test('non-string returns undefined', () => {
		expect(jidDecode(null)).toBeUndefined()
		expect(jidDecode(42)).toBeUndefined()
	})

	test('roundtrip encode → decode → encode', () => {
		const jid = '491234567890:3@s.whatsapp.net'
		const decoded = jidDecode(jid)
		const reEncoded = jidEncode(decoded.user, decoded.server, decoded.device)
		expect(reEncoded).toBe(jid)
	})
})

describe('areJidsSameUser', () => {
	test('same user, different device → true', () => {
		expect(areJidsSameUser('491234567890:0@s.whatsapp.net', '491234567890:3@s.whatsapp.net')).toBe(true)
	})

	test('different user → false', () => {
		expect(areJidsSameUser('491234567890@s.whatsapp.net', '499876543210@s.whatsapp.net')).toBe(false)
	})

	test('c.us vs s.whatsapp.net same number → true', () => {
		expect(areJidsSameUser('491234567890@c.us', '491234567890@s.whatsapp.net')).toBe(true)
	})

	test('null jid → does not throw', () => {
		expect(() => areJidsSameUser(null, '491234567890@s.whatsapp.net')).not.toThrow()
	})
})

describe('JID type predicates', () => {
	describe('isJidMetaAI', () => {
		test('true for @bot', () => expect(isJidMetaAI('13135550002@bot')).toBe(true))
		test('false for @s.whatsapp.net', () => expect(isJidMetaAI('491234567890@s.whatsapp.net')).toBe(false))
		test('null → falsy', () => expect(isJidMetaAI(null)).toBeFalsy())
	})

	describe('isPnUser', () => {
		test('true for @s.whatsapp.net', () => expect(isPnUser('491234567890@s.whatsapp.net')).toBe(true))
		test('false for @g.us', () => expect(isPnUser('120363@g.us')).toBe(false))
		test('null → falsy', () => expect(isPnUser(null)).toBeFalsy())
	})

	describe('isInteropUser', () => {
		test('true for @interop', () => expect(isInteropUser('user@interop')).toBe(true))
		test('false otherwise', () => expect(isInteropUser('user@s.whatsapp.net')).toBe(false))
		test('null → falsy', () => expect(isInteropUser(null)).toBeFalsy())
	})

	describe('isLidUser', () => {
		test('true for @lid', () => expect(isLidUser('491234567890@lid')).toBe(true))
		test('false otherwise', () => expect(isLidUser('491234567890@s.whatsapp.net')).toBe(false))
		test('null → falsy', () => expect(isLidUser(null)).toBeFalsy())
	})

	describe('isJidBroadcast', () => {
		test('true for @broadcast', () => expect(isJidBroadcast('status@broadcast')).toBe(true))
		test('true for status broadcast', () => expect(isJidBroadcast('status@broadcast')).toBe(true))
		test('false for group', () => expect(isJidBroadcast('120363@g.us')).toBe(false))
		test('null → falsy', () => expect(isJidBroadcast(null)).toBeFalsy())
	})

	describe('isJidGroup', () => {
		test('true for @g.us', () => expect(isJidGroup('120363000000000000@g.us')).toBe(true))
		test('false for user', () => expect(isJidGroup('491234567890@s.whatsapp.net')).toBe(false))
		test('null → falsy', () => expect(isJidGroup(null)).toBeFalsy())
	})

	describe('isJidStatusBroadcast', () => {
		test('true only for status@broadcast', () => expect(isJidStatusBroadcast('status@broadcast')).toBe(true))
		test('false for other broadcast', () => expect(isJidStatusBroadcast('list@broadcast')).toBe(false))
		test('null → falsy', () => expect(isJidStatusBroadcast(null)).toBeFalsy())
	})

	describe('isJidNewsletter', () => {
		test('true for @newsletter', () => expect(isJidNewsletter('123@newsletter')).toBe(true))
		test('false for user', () => expect(isJidNewsletter('491234567890@s.whatsapp.net')).toBe(false))
		test('null → falsy', () => expect(isJidNewsletter(null)).toBeFalsy())
	})

	describe('isHostedPnUser', () => {
		test('true for @hosted', () => expect(isHostedPnUser('491234567890@hosted')).toBe(true))
		test('false otherwise', () => expect(isHostedPnUser('491234567890@s.whatsapp.net')).toBe(false))
		test('null → falsy', () => expect(isHostedPnUser(null)).toBeFalsy())
	})

	describe('isHostedLidUser', () => {
		test('true for @hosted.lid', () => expect(isHostedLidUser('491234567890@hosted.lid')).toBe(true))
		test('false for @hosted', () => expect(isHostedLidUser('491234567890@hosted')).toBe(false))
		test('null → falsy', () => expect(isHostedLidUser(null)).toBeFalsy())
	})

	describe('isJidBot', () => {
		test('true for known bot number @c.us', () => {
			expect(isJidBot('13135550002@c.us')).toBe(true)
		})
		test('true for pattern 13135559100@c.us', () => {
			expect(isJidBot('13135559100@c.us')).toBe(true)
		})
		test('false for normal user @s.whatsapp.net', () => {
			expect(isJidBot('491234567890@s.whatsapp.net')).toBe(false)
		})
		test('false for bot number @s.whatsapp.net (wrong server)', () => {
			expect(isJidBot('13135550002@s.whatsapp.net')).toBe(false)
		})
		test('null → falsy', () => expect(isJidBot(null)).toBeFalsy())
	})
})

describe('getBotJid', () => {
	test('known FB id → WA number', () => {
		// 867051314767696 maps to 13135550002
		expect(getBotJid('867051314767696@bot')).toBe('13135550002@s.whatsapp.net')
	})

	test('unknown FB id → unchanged', () => {
		expect(getBotJid('9999999@bot')).toBe('9999999@bot')
	})

	test('non-bot server → unchanged', () => {
		expect(getBotJid('867051314767696@s.whatsapp.net')).toBe('867051314767696@s.whatsapp.net')
	})

	test('no @ → returned as-is', () => {
		expect(getBotJid('867051314767696')).toBe('867051314767696')
	})
})

describe('jidNormalizedUser', () => {
	test('c.us → s.whatsapp.net', () => {
		expect(jidNormalizedUser('491234567890@c.us')).toBe('491234567890@s.whatsapp.net')
	})

	test('s.whatsapp.net unchanged', () => {
		expect(jidNormalizedUser('491234567890@s.whatsapp.net')).toBe('491234567890@s.whatsapp.net')
	})

	test('device stripped', () => {
		expect(jidNormalizedUser('491234567890:3@s.whatsapp.net')).toBe('491234567890@s.whatsapp.net')
	})

	test('invalid → empty string', () => {
		expect(jidNormalizedUser('invalid')).toBe('')
	})
})

describe('transferDevice', () => {
	test('copies device id from source to target user', () => {
		const from = '491111111111:5@s.whatsapp.net'
		const to = '492222222222@s.whatsapp.net'
		expect(transferDevice(from, to)).toBe('492222222222:5@s.whatsapp.net')
	})

	test('no device on source → device 0', () => {
		const from = '491111111111@s.whatsapp.net'
		const to = '492222222222@s.whatsapp.net'
		expect(transferDevice(from, to)).toBe('492222222222:0@s.whatsapp.net')
	})
})
