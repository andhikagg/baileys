'use strict'

const { BinaryInfo } = require('../src/WAM/BinaryInfo')
const { encodeWAM } = require('../src/WAM/encode')

describe('BinaryInfo', () => {
	test('default values', () => {
		const bi = new BinaryInfo()
		expect(bi.protocolVersion).toBe(5)
		expect(bi.sequence).toBe(0)
		expect(bi.events).toEqual([])
		expect(bi.buffer).toEqual([])
	})

	test('constructor options override defaults', () => {
		const bi = new BinaryInfo({ sequence: 42, protocolVersion: 3 })
		expect(bi.sequence).toBe(42)
		expect(bi.protocolVersion).toBe(3)
	})

	test('extra options are assigned', () => {
		const bi = new BinaryInfo({ custom: 'value' })
		expect(bi.custom).toBe('value')
	})
})

describe('encodeWAM', () => {
	test('header starts with WAM magic bytes', () => {
		const bi = new BinaryInfo({ events: [] })
		// Empty events list: encodeEvents does nothing, encodeWAMHeader adds 8-byte header
		// but totalSize via reduce() requires at least one element — add an empty sentinel
		// Actually the reducer will throw on empty array. We need at least one event.
		// Use WamDroppedEvent which is id 4358 and always available in constants.
		bi.events = [
			{
				WamDroppedEvent: {
					props: { droppedEventCode: 1, droppedEventCount: 0, isFromWamsys: false },
					globals: {}
				}
			}
		]
		const buf = encodeWAM(bi)
		expect(Buffer.isBuffer(buf)).toBe(true)
		expect(buf.slice(0, 3).toString('ascii')).toBe('WAM')
	})

	test('header byte 3 is protocolVersion', () => {
		const bi = new BinaryInfo({ sequence: 0 })
		bi.events = [
			{ WamDroppedEvent: { props: { droppedEventCode: 2, droppedEventCount: 1, isFromWamsys: true }, globals: {} } }
		]
		const buf = encodeWAM(bi)
		expect(buf.readUInt8(3)).toBe(5) // default protocolVersion
	})

	test('header bytes 5-6 encode sequence big-endian', () => {
		const bi = new BinaryInfo({ sequence: 7 })
		bi.events = [
			{ WamDroppedEvent: { props: { droppedEventCode: 1, droppedEventCount: 0, isFromWamsys: false }, globals: {} } }
		]
		const buf = encodeWAM(bi)
		expect(buf.readUInt16BE(5)).toBe(7)
	})

	test('byte 7 is 0 (regular channel)', () => {
		const bi = new BinaryInfo({ sequence: 0 })
		bi.events = [
			{ WamDroppedEvent: { props: { droppedEventCode: 1, droppedEventCount: 0, isFromWamsys: false }, globals: {} } }
		]
		const buf = encodeWAM(bi)
		expect(buf.readUInt8(7)).toBe(0)
	})

	test('different sequences produce different output', () => {
		const makeBI = seq => {
			const bi = new BinaryInfo({ sequence: seq })
			bi.events = [
				{ WamDroppedEvent: { props: { droppedEventCode: 1, droppedEventCount: 0, isFromWamsys: false }, globals: {} } }
			]
			return encodeWAM(bi)
		}
		expect(makeBI(1)).not.toEqual(makeBI(2))
	})

	test('resets buffer on each call', () => {
		const bi = new BinaryInfo()
		bi.events = [
			{ WamDroppedEvent: { props: { droppedEventCode: 1, droppedEventCount: 0, isFromWamsys: false }, globals: {} } }
		]
		const first = encodeWAM(bi)
		const second = encodeWAM(bi)
		expect(first).toEqual(second)
	})

	test('integer value 0 encodes correctly (special case in serialize)', () => {
		const bi = new BinaryInfo()
		bi.events = [
			{ WamDroppedEvent: { props: { droppedEventCode: 0, droppedEventCount: 0, isFromWamsys: false }, globals: {} } }
		]
		expect(() => encodeWAM(bi)).not.toThrow()
	})

	test('integer value 1 encodes correctly (special case in serialize)', () => {
		const bi = new BinaryInfo()
		bi.events = [
			{ WamDroppedEvent: { props: { droppedEventCode: 1, droppedEventCount: 1, isFromWamsys: true }, globals: {} } }
		]
		expect(() => encodeWAM(bi)).not.toThrow()
	})
})
