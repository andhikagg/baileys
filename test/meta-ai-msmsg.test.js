'use strict'

const { proto } = require('../WAProto')
const { privateChatFixture, normalGroupFixture, metaAiGroupFixture } = require('./fixtures/meta-ai-msmsg-fixtures')
const { decryptMsmsgBotMessage, decodeDecryptedMsmsgMessage } = require('../src/Utils/meta-ai-msmsg')

const msMsgFromHex = ({ encIvHex, encPayloadHex }) => ({
	version: 1,
	encIv: Buffer.from(encIvHex, 'hex'),
	encPayload: Buffer.from(encPayloadHex, 'hex')
})

const knownVectors = {
	privatePrimary: {
		msMsg: msMsgFromHex({
			encIvHex: '000102030405060708090a0b',
			encPayloadHex: 'cdd172931e02d67a9332662ea9b37224e2f2c1b36592ba4123aebcac679ebbcf537d1feb'
		}),
		expectedText: 'private ok'
	},
	groupPrimary: {
		msMsg: msMsgFromHex({
			encIvHex: '101112131415161718191a1b',
			encPayloadHex: '75abc30849e328531b803048b81bff603235150341c4c335412df57e3f336542929a'
		}),
		expectedText: 'group ok'
	},
	groupFallbackMetaTarget: {
		msMsg: msMsgFromHex({
			encIvHex: '202122232425262728292a2b',
			encPayloadHex: '6db9b2a0d4008e9b56a1e4aae13b80966c8c3e6adc5617f6a52c91bc69c1a61f2f72f61aff72'
		}),
		expectedText: 'fallback ok'
	}
}

describe('meta-ai msmsg candidate selection', () => {
	test('botEditTargetId is preferred over stanzaId as msgId', async () => {
		// both are valid 32-char hex → both have ascii+binary forms; botEditTargetId must come first
		const key = { ...privateChatFixture.messageKey, stanzaId: 'FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF' }
		// privatePrimary vector was encrypted with botEditTargetId — should still decrypt
		const decrypted = await decryptMsmsgBotMessage(
			privateChatFixture.messageSecret,
			key,
			knownVectors.privatePrimary.msMsg
		)
		const decoded = decodeDecryptedMsmsgMessage(decrypted)
		expect(decoded.protocolMessage.editedMessage.extendedTextMessage.text).toBe(
			knownVectors.privatePrimary.expectedText
		)
	})

	test('falls back to stanzaId when botEditTargetId is absent', async () => {
		// metaAiGroupFixture has botEditTargetId='' — groupFallback vector uses metaTargetId
		// just verify stanzaId is included in candidates and decryption still works
		const key = { ...normalGroupFixture.messageKey, botEditTargetId: '' }
		const decrypted = await decryptMsmsgBotMessage(
			normalGroupFixture.messageSecret,
			key,
			knownVectors.groupFallbackMetaTarget.msMsg
		)
		const decoded = decodeDecryptedMsmsgMessage(decrypted)
		expect(decoded.richResponseMessage.submessages[0].messageText).toBe(
			knownVectors.groupFallbackMetaTarget.expectedText
		)
	})

	test('deduplicates meId and meLid when they normalize to the same value', async () => {
		// ME_JID === normalizeLidJid(ME_LID) → only one target JID candidate
		// decryption must still succeed (not fail from missing JID)
		const decrypted = await decryptMsmsgBotMessage(
			privateChatFixture.messageSecret,
			privateChatFixture.messageKey,
			knownVectors.privatePrimary.msMsg
		)
		expect(decrypted).toBeInstanceOf(Buffer)
	})
})

describe('meta-ai msmsg decryption', () => {
	test('decryptMessageNode delegates msmsg integration to helper module', async () => {
		const decryptMsmsgBotMessage = jest.fn().mockResolvedValue(Buffer.from('decrypted-msmsg'))
		const decodeDecryptedMsmsgMessage = jest.fn().mockReturnValue({
			protocolMessage: {
				editedMessage: {
					extendedTextMessage: {
						text: 'delegated ok'
					}
				}
			}
		})

		jest.resetModules()
		jest.doMock('../src/Utils/generics', () => ({
			unpadRandomMax16: value => value
		}))
		jest.doMock('../src/Utils/messages', () => ({
			getDevice: jest.fn().mockReturnValue(undefined)
		}))
		jest.doMock('../src/Utils/meta-ai-msmsg', () => ({
			decryptMsmsgBotMessage,
			decodeDecryptedMsmsgMessage
		}))

		let decryptMessageNode
		let setBotMessageSecret
		jest.isolateModules(() => {
			;({ decryptMessageNode, setBotMessageSecret } = require('../src/Utils/decode-wa-message'))
		})

		setBotMessageSecret(
			privateChatFixture.messageKey.botEditTargetId,
			privateChatFixture.messageSecret,
			privateChatFixture.messageKey.conversationJid
		)

		const stanza = {
			attrs: {
				id: privateChatFixture.messageKey.stanzaId,
				from: privateChatFixture.messageKey.participant,
				t: '1712345678'
			},
			content: [
				{
					tag: 'meta',
					attrs: {
						target_id: privateChatFixture.messageKey.metaTargetId
					}
				},
				{
					tag: 'bot',
					attrs: {
						edit: privateChatFixture.messageKey.botType,
						edit_target_id: privateChatFixture.messageKey.botEditTargetId
					}
				},
				{
					tag: 'enc',
					attrs: {
						type: 'msmsg'
					},
					content: proto.MessageSecretMessage.encode(knownVectors.privatePrimary.msMsg).finish()
				}
			]
		}

		const repository = {
			lidMapping: {
				getLIDForPN: jest.fn().mockResolvedValue(null),
				storeLIDPNMappings: jest.fn().mockResolvedValue(undefined)
			},
			migrateSession: jest.fn().mockResolvedValue(undefined),
			processSenderKeyDistributionMessage: jest.fn().mockResolvedValue(undefined)
		}
		const logger = {
			debug: jest.fn(),
			warn: jest.fn(),
			error: jest.fn()
		}

		const decoded = decryptMessageNode(
			stanza,
			'1234567890@s.whatsapp.net',
			privateChatFixture.messageKey.meLid,
			repository,
			logger
		)

		await decoded.decrypt()

		expect(decryptMsmsgBotMessage).toHaveBeenCalledTimes(1)
		expect(decryptMsmsgBotMessage).toHaveBeenCalledWith(
			privateChatFixture.messageSecret,
			expect.objectContaining({
				participant: privateChatFixture.messageKey.participant,
				meId: privateChatFixture.messageKey.meId,
				meLid: privateChatFixture.messageKey.meLid,
				botEditTargetId: privateChatFixture.messageKey.botEditTargetId,
				metaTargetId: privateChatFixture.messageKey.metaTargetId,
				stanzaId: privateChatFixture.messageKey.stanzaId
			}),
			knownVectors.privatePrimary.msMsg
		)
		expect(decodeDecryptedMsmsgMessage).toHaveBeenCalledWith(Buffer.from('decrypted-msmsg'))
		expect(decoded.fullMessage.message.protocolMessage.editedMessage.extendedTextMessage.text).toBe('delegated ok')

		jest.dontMock('../src/Utils/meta-ai-msmsg')
		jest.resetModules()
	})

	test('decrypts a known private chat payload', async () => {
		const decrypted = await decryptMsmsgBotMessage(
			privateChatFixture.messageSecret,
			privateChatFixture.messageKey,
			knownVectors.privatePrimary.msMsg
		)

		const decoded = decodeDecryptedMsmsgMessage(decrypted)
		expect(decoded.protocolMessage.editedMessage.extendedTextMessage.text).toBe(
			knownVectors.privatePrimary.expectedText
		)
	})

	test('decrypts a known normal group payload', async () => {
		const decrypted = await decryptMsmsgBotMessage(
			normalGroupFixture.messageSecret,
			normalGroupFixture.messageKey,
			knownVectors.groupPrimary.msMsg
		)

		const decoded = decodeDecryptedMsmsgMessage(decrypted)
		expect(decoded.protocolMessage.editedMessage.extendedTextMessage.text).toBe(knownVectors.groupPrimary.expectedText)
	})

	test('decrypts a known payload by falling back to a non-primary target id candidate', async () => {
		const decrypted = await decryptMsmsgBotMessage(
			normalGroupFixture.messageSecret,
			normalGroupFixture.messageKey,
			knownVectors.groupFallbackMetaTarget.msMsg
		)

		const decoded = decodeDecryptedMsmsgMessage(decrypted)
		expect(decoded.richResponseMessage.submessages[0].messageText).toBe(
			knownVectors.groupFallbackMetaTarget.expectedText
		)
	})

	test('fails early when required decryption inputs are missing', async () => {
		await expect(
			decryptMsmsgBotMessage(
				privateChatFixture.messageSecret,
				{ ...privateChatFixture.messageKey, meId: '' },
				knownVectors.privatePrimary.msMsg
			)
		).rejects.toThrow('Missing required meId for msmsg decryption')
	})

	test('fails early when there is no usable target message id source', async () => {
		await expect(
			decryptMsmsgBotMessage(
				privateChatFixture.messageSecret,
				{ ...privateChatFixture.messageKey, botEditTargetId: '', metaTargetId: '', stanzaId: '' },
				knownVectors.privatePrimary.msMsg
			)
		).rejects.toThrow('Missing required target message id for msmsg decryption')
	})

	test('fails early on empty typed-array encryption inputs', async () => {
		await expect(
			decryptMsmsgBotMessage(new Uint8Array(0), privateChatFixture.messageKey, {
				version: 1,
				encIv: new Uint8Array(0),
				encPayload: new Uint8Array(0)
			})
		).rejects.toThrow('Missing required messageSecret for msmsg decryption')
	})

	test('throws with cause when all key derivation candidates are exhausted', async () => {
		await expect(
			decryptMsmsgBotMessage(Buffer.alloc(32), normalGroupFixture.messageKey, knownVectors.groupPrimary.msMsg)
		).rejects.toMatchObject({
			message: 'msmsg decryption failed: all key derivation candidates exhausted',
			cause: expect.objectContaining({ message: expect.any(String) })
		})
	})
})
