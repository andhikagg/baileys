'use strict'
Object.defineProperty(exports, '__esModule', { value: true })
exports.SenderMessageKey = void 0
const rb = require('whatsapp-rust-bridge-baron')
class SenderMessageKey {
	constructor(iteration, seed) {
		// HKDF(seed, 96, salt=0x00*32, info='WhisperGroup') → split into 3×32 byte chunks
		const derived = Buffer.from(rb.hkdf(seed, 96, { salt: Buffer.alloc(32), info: 'WhisperGroup' }))
		const keys = new Uint8Array(32)
		keys.set(new Uint8Array(derived.slice(16, 32))) // bytes 16-31 of chunk 0
		keys.set(new Uint8Array(derived.slice(32, 48)), 16) // bytes 0-15 of chunk 1
		this.iv = Buffer.from(derived.slice(0, 16))
		this.cipherKey = Buffer.from(keys.buffer)
		this.iteration = iteration
		this.seed = seed
	}
	getIteration() {
		return this.iteration
	}
	getIv() {
		return this.iv
	}
	getCipherKey() {
		return this.cipherKey
	}
	getSeed() {
		return this.seed
	}
}
exports.SenderMessageKey = SenderMessageKey
