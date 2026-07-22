'use strict'

const { decompressingIfRequired, decodeBinaryNode } = require('../src/WABinary/decode')
const zlib = require('zlib')

describe('decompressingIfRequired', () => {
	test('strips 0x00 prefix when compression bit not set', async () => {
		const data = Buffer.from([0x00, 0x01, 0x02, 0x03])
		const result = await decompressingIfRequired(data)
		expect(result).toEqual(Buffer.from([0x01, 0x02, 0x03]))
	})

	test('even-value first byte (no compression bit) → strips prefix', async () => {
		// 0x04 & 2 === 0 → no compression
		const data = Buffer.from([0x04, 0xaa, 0xbb])
		const result = await decompressingIfRequired(data)
		expect(result).toEqual(Buffer.from([0xaa, 0xbb]))
	})

	test('decompresses zlib-deflated data when compression bit set', async () => {
		const payload = Buffer.from('hello compressed world')
		const compressed = zlib.deflateSync(payload)
		// compression bit = (byte & 2) !== 0 → use 0x02 as the prefix byte
		const data = Buffer.concat([Buffer.from([0x02]), compressed])
		const result = await decompressingIfRequired(data)
		expect(result).toEqual(payload)
	})
})

describe('decodeBinaryNode', () => {
	test('returns an object with tag, attrs, content', () => {
		// decodeBinaryNode delegates to rb.decodeNode which the mock returns
		// a fixed {tag:'iq', attrs:{id:'1', type:'get'}, content:undefined}
		const result = decodeBinaryNode(Buffer.alloc(8))
		expect(result).toHaveProperty('tag')
		expect(result).toHaveProperty('attrs')
	})

	test('accepts Uint8Array input', () => {
		expect(() => decodeBinaryNode(new Uint8Array(8))).not.toThrow()
	})

	test('accepts Buffer input', () => {
		expect(() => decodeBinaryNode(Buffer.alloc(4))).not.toThrow()
	})
})
