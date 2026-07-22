'use strict'
const { proto } = require('../WAProto/index.js')
const { decodeConsumerApplication, consumerApplicationToMessage } = require('../src/Utils/consumer-application')

const wrap = contentFields => {
	const obj = { payload: { content: { ...contentFields } } }
	const bytes = proto.ConsumerApplication.encode(obj).finish()
	return decodeConsumerApplication(bytes)
}

describe('decodeConsumerApplication', () => {
	test('round-trips a text payload', () => {
		const app = wrap({ messageText: { text: 'hello' } })
		expect(app.payload.content.messageText.text).toBe('hello')
	})

	test('rejects non-buffer input', () => {
		expect(() => decodeConsumerApplication(123)).toThrow(TypeError)
	})
})

describe('consumerApplicationToMessage', () => {
	test('messageText → conversation', () => {
		const app = wrap({ messageText: { text: 'hi there' } })
		expect(consumerApplicationToMessage(app)).toEqual({ conversation: 'hi there' })
	})

	test('extendedTextMessage → extendedTextMessage with text', () => {
		const app = wrap({ extendedTextMessage: { text: { text: 'linky' }, canonicalUrl: 'http://x' } })
		const msg = consumerApplicationToMessage(app)
		expect(msg.extendedTextMessage.text).toBe('linky')
		expect(msg.extendedTextMessage.canonicalUrl).toBe('http://x')
	})

	test('imageMessage carries SubProtocol blob under mediaPayload', () => {
		const app = wrap({ imageMessage: { image: { payload: Buffer.from([9]), version: 1 }, caption: { text: 'cap' } } })
		const msg = consumerApplicationToMessage(app)
		expect(msg.imageMessage.caption).toBe('cap')
		expect(Buffer.from(msg.imageMessage.mediaPayload.payload)).toEqual(Buffer.from([9]))
	})

	test('videoMessage maps with caption', () => {
		const app = wrap({ videoMessage: { video: { payload: Buffer.from([1]) }, caption: { text: 'v' } } })
		expect(consumerApplicationToMessage(app).videoMessage.caption).toBe('v')
	})

	test('audioMessage maps ptt flag', () => {
		const app = wrap({ audioMessage: { audio: { payload: Buffer.from([1]) }, ptt: true } })
		expect(consumerApplicationToMessage(app).audioMessage.ptt).toBe(true)
	})

	test('documentMessage maps fileName', () => {
		const app = wrap({ documentMessage: { document: { payload: Buffer.from([1]) }, fileName: 'a.pdf' } })
		expect(consumerApplicationToMessage(app).documentMessage.fileName).toBe('a.pdf')
	})

	test('stickerMessage maps mediaPayload', () => {
		const app = wrap({ stickerMessage: { sticker: { payload: Buffer.from([2]) } } })
		expect(Buffer.from(consumerApplicationToMessage(app).stickerMessage.mediaPayload.payload)).toEqual(Buffer.from([2]))
	})

	test('contactMessage maps through', () => {
		const app = wrap({ contactMessage: { contact: { payload: Buffer.from([3]) } } })
		expect(consumerApplicationToMessage(app).contactMessage).toBeTruthy()
	})

	test('contactsArrayMessage maps displayName', () => {
		const app = wrap({ contactsArrayMessage: { displayName: 'group', contacts: [] } })
		expect(consumerApplicationToMessage(app).contactsArrayMessage.displayName).toBe('group')
	})

	test('locationMessage maps lat/long', () => {
		const app = wrap({ locationMessage: { location: { degreesLatitude: 1.5, degreesLongitude: 2.5, name: 'spot' } } })
		const loc = consumerApplicationToMessage(app).locationMessage
		expect(loc.degreesLatitude).toBe(1.5)
		expect(loc.degreesLongitude).toBe(2.5)
	})

	test('liveLocationMessage maps caption', () => {
		const app = wrap({
			liveLocationMessage: { location: { degreesLatitude: 1 }, caption: { text: 'moving' } }
		})
		expect(consumerApplicationToMessage(app).liveLocationMessage.caption).toBe('moving')
	})

	test('reactionMessage maps through', () => {
		const app = wrap({ reactionMessage: { key: { id: 'R1' } } })
		expect(consumerApplicationToMessage(app).reactionMessage.key.id).toBe('R1')
	})

	test('revoke (applicationData) → protocolMessage REVOKE', () => {
		const obj = { payload: { applicationData: { revoke: { key: { id: 'DEL1' } } } } }
		const app = decodeConsumerApplication(proto.ConsumerApplication.encode(obj).finish())
		const msg = consumerApplicationToMessage(app)
		expect(msg.protocolMessage.type).toBe(proto.Message.ProtocolMessage.Type.REVOKE)
		expect(msg.protocolMessage.key.id).toBe('DEL1')
	})

	test('unmapped / empty content → null', () => {
		const app = decodeConsumerApplication(proto.ConsumerApplication.encode({}).finish())
		expect(consumerApplicationToMessage(app)).toBeNull()
	})
})
