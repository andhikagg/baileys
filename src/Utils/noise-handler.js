'use strict'
Object.defineProperty(exports, '__esModule', { value: true })
exports.makeNoiseHandler = void 0
const boom_1 = require('@hapi/boom')
const index_js_1 = require('../../WAProto/index.js')
const Defaults_1 = require('../Defaults')
const rb = require('whatsapp-rust-bridge-baron')

// rustNodeToJs mirrors the one in decode.js — converts InternalBinaryNode to plain JS object
const rustNodeToJs = node => {
	if (!node || typeof node !== 'object') return node
	const result = { tag: node.tag, attrs: node.attrs || {} }
	const content = node.content
	if (content === undefined || content === null) {
		// no content
	} else if (content instanceof Uint8Array) {
		result.content = Buffer.from(content)
	} else if (typeof content === 'string') {
		result.content = content
	} else if (Array.isArray(content)) {
		result.content = content.map(rustNodeToJs)
	} else {
		result.content = content
	}
	return result
}

const makeNoiseHandler = ({
	keyPair: { private: privateKey, public: publicKey },
	NOISE_HEADER,
	logger,
	routingInfo
}) => {
	logger = logger.child({ class: 'ns' })

	const session = new rb.NoiseSession(
		publicKey instanceof Uint8Array ? publicKey : new Uint8Array(publicKey),
		NOISE_HEADER instanceof Uint8Array ? NOISE_HEADER : new Uint8Array(NOISE_HEADER),
		routingInfo ? (routingInfo instanceof Uint8Array ? routingInfo : new Uint8Array(routingInfo)) : undefined
	)

	let isWaitingForTransport = false
	let pendingOnFrame = null
	let pendingBytes = null

	const processFrames = async onFrame => {
		// decodeFrame returns an Array of InternalBinaryNode (post-handshake) or Uint8Array (handshake)
		const frames = session.decodeFrame(new Uint8Array(0))
		for (let i = 0; i < frames.length; i++) {
			const item = frames[i]
			let frame
			if (item instanceof Uint8Array) {
				frame = Buffer.from(item)
			} else {
				try {
					frame = rustNodeToJs(item.toJSON())
				} catch (decodeErr) {
					logger.debug({ err: decodeErr?.message }, '[noise] decode error')
					continue
				}
			}
			if (logger.level === 'trace') {
				logger.trace({ msg: frame?.attrs?.id }, 'recv frame')
			}
			onFrame(frame)
		}
	}

	const finishInit = async () => {
		isWaitingForTransport = true
		session.finishInit()
		isWaitingForTransport = false
		logger.trace('Noise handler transitioned to Transport state (Rust)')
		if (pendingOnFrame && pendingBytes) {
			logger.trace({ length: pendingBytes.length }, 'Flushing buffered frames after transport ready')
			const frames = session.decodeFrame(pendingBytes)
			pendingBytes = null
			const cb = pendingOnFrame
			pendingOnFrame = null
			for (let i = 0; i < frames.length; i++) {
				const item = frames[i]
				let frame
				if (item instanceof Uint8Array) {
					frame = Buffer.from(item)
				} else {
					try {
						frame = rustNodeToJs(item.toJSON())
					} catch {
						continue
					}
				}
				cb(frame)
			}
		}
	}

	return {
		encrypt: plaintext => {
			const u8 = plaintext instanceof Uint8Array ? plaintext : new Uint8Array(plaintext)
			return Buffer.from(session.encrypt(u8))
		},
		decrypt: ciphertext => {
			const u8 = ciphertext instanceof Uint8Array ? ciphertext : new Uint8Array(ciphertext)
			return Buffer.from(session.decrypt(u8))
		},
		authenticate: data => {
			session.authenticate(data instanceof Uint8Array ? data : new Uint8Array(data))
		},
		mixIntoKey: data => {
			session.mixIntoKey(data instanceof Uint8Array ? data : new Uint8Array(data))
		},
		finishInit,
		processHandshake: ({ serverHello }, noiseKey) => {
			// Rust handles the crypto: authenticate ephemeral, ECDH, decrypt static+payload
			const certPayload = session.processHandshakeInit(
				serverHello.ephemeral,
				serverHello.static,
				serverHello.payload,
				privateKey instanceof Uint8Array ? privateKey : new Uint8Array(privateKey)
			)

			// Certificate validation stays in JS (uses protobuf + WA-specific constants)
			const { intermediate: certIntermediate, leaf } = index_js_1.proto.CertChain.decode(certPayload)
			if (!leaf?.details || !leaf?.signature) {
				throw new boom_1.Boom('invalid noise leaf certificate', { statusCode: 400 })
			}
			if (!certIntermediate?.details || !certIntermediate?.signature) {
				throw new boom_1.Boom('invalid noise intermediate certificate', { statusCode: 400 })
			}
			const details = index_js_1.proto.CertChain.NoiseCertificate.Details.decode(certIntermediate.details)
			const { issuerSerial } = details
			const { Curve } = require('./crypto')
			if (!Curve.verify(details.key, leaf.details, leaf.signature)) {
				throw new boom_1.Boom('noise certificate signature invalid', { statusCode: 400 })
			}
			if (!Curve.verify(Defaults_1.WA_CERT_DETAILS.PUBLIC_KEY, certIntermediate.details, certIntermediate.signature)) {
				throw new boom_1.Boom('noise intermediate certificate signature invalid', { statusCode: 400 })
			}
			if (issuerSerial !== Defaults_1.WA_CERT_DETAILS.SERIAL) {
				throw new boom_1.Boom('certification match failed', { statusCode: 400 })
			}

			// Extract server static key from leaf cert — used to cache for NoiseIkSession (fast reconnect)
			let serverStaticPub
			try {
				const leafDetails = index_js_1.proto.CertChain.NoiseCertificate.Details.decode(leaf.details)
				if (leafDetails.key?.length === 32) serverStaticPub = Buffer.from(leafDetails.key)
			} catch {}

			// Encrypt our static key and do final ECDH
			const keyEnc = session.processHandshakeFinish(
				noiseKey.public instanceof Uint8Array ? noiseKey.public : new Uint8Array(noiseKey.public),
				noiseKey.private instanceof Uint8Array ? noiseKey.private : new Uint8Array(noiseKey.private),
				serverHello.ephemeral
			)
			return { keyEnc: Buffer.from(keyEnc), serverStaticPub }
		},
		encodeFrame: data => {
			const u8 = data instanceof Uint8Array ? data : new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
			return Buffer.from(session.encodeFrameRaw(u8))
		},
		decodeFrame: async (newData, onFrame) => {
			if (isWaitingForTransport) {
				pendingBytes = pendingBytes ? Buffer.concat([pendingBytes, Buffer.from(newData)]) : Buffer.from(newData)
				pendingOnFrame = onFrame
				return
			}

			const u8 =
				newData instanceof Uint8Array ? newData : new Uint8Array(newData.buffer, newData.byteOffset, newData.byteLength)
			const frames = session.decodeFrame(u8)

			for (let i = 0; i < frames.length; i++) {
				const item = frames[i]
				let frame
				if (item instanceof Uint8Array) {
					frame = Buffer.from(item)
				} else {
					try {
						frame = rustNodeToJs(item.toJSON())
					} catch (decodeErr) {
						logger.debug({ err: decodeErr?.message }, '[noise] decode error')
						continue
					}
				}
				if (logger.level === 'trace') {
					logger.trace({ msg: frame?.attrs?.id }, 'recv frame')
				}
				onFrame(frame)
			}
		}
	}
}
exports.makeNoiseHandler = makeNoiseHandler
