'use strict'

const {
	getBinaryNodeChildren,
	getBinaryNodeChild,
	getAllBinaryNodeChildren,
	getBinaryNodeChildBuffer,
	getBinaryNodeChildString,
	getBinaryNodeChildUInt,
	assertNodeErrorFree,
	reduceBinaryNodeToDictionary,
} = require('../src/WABinary/generic-utils')

// Minimal node builder helpers
const node = (tag, attrs = {}, ...content) => ({ tag, attrs, content: content.length ? content : undefined })
const nodeWithContent = (tag, attrs, content) => ({ tag, attrs, content })

describe('getBinaryNodeChildren', () => {
	test('returns matching children by tag', () => {
		const parent = nodeWithContent('iq', {}, [
			node('item', { id: '1' }),
			node('item', { id: '2' }),
			node('other', { id: '3' }),
		])
		const items = getBinaryNodeChildren(parent, 'item')
		expect(items).toHaveLength(2)
		expect(items[0].attrs.id).toBe('1')
		expect(items[1].attrs.id).toBe('2')
	})

	test('returns empty array when no match', () => {
		const parent = nodeWithContent('iq', {}, [node('item', {})])
		expect(getBinaryNodeChildren(parent, 'missing')).toEqual([])
	})

	test('returns empty array when content is not array', () => {
		const parent = nodeWithContent('iq', {}, Buffer.from('data'))
		expect(getBinaryNodeChildren(parent, 'item')).toEqual([])
	})

	test('returns empty array for null node', () => {
		expect(getBinaryNodeChildren(null, 'item')).toEqual([])
	})

	test('returns empty array for undefined node', () => {
		expect(getBinaryNodeChildren(undefined, 'item')).toEqual([])
	})

	test('caches index — second call is consistent', () => {
		const child = node('ping', {})
		const parent = nodeWithContent('iq', {}, [child])
		const first = getBinaryNodeChildren(parent, 'ping')
		const second = getBinaryNodeChildren(parent, 'ping')
		expect(first).toEqual(second)
	})

	test('cached result does not include subsequent mutation of content', () => {
		const content = [node('x', {})]
		const parent = nodeWithContent('iq', {}, content)
		getBinaryNodeChildren(parent, 'x') // prime cache
		content.push(node('x', {})) // mutate after caching
		// cache was built on first call — result reflects original state
		expect(getBinaryNodeChildren(parent, 'x')).toHaveLength(1)
	})
})

describe('getBinaryNodeChild', () => {
	test('returns first matching child', () => {
		const parent = nodeWithContent('iq', {}, [node('item', { id: 'a' }), node('item', { id: 'b' })])
		const child = getBinaryNodeChild(parent, 'item')
		expect(child?.attrs.id).toBe('a')
	})

	test('returns undefined when no match', () => {
		const parent = nodeWithContent('iq', {}, [node('item', {})])
		expect(getBinaryNodeChild(parent, 'missing')).toBeUndefined()
	})

	test('null node → undefined', () => {
		expect(getBinaryNodeChild(null, 'item')).toBeUndefined()
	})
})

describe('getAllBinaryNodeChildren', () => {
	test('returns all children regardless of tag', () => {
		const children = [node('a', {}), node('b', {}), node('c', {})]
		const parent = nodeWithContent('iq', {}, children)
		expect(getAllBinaryNodeChildren(parent)).toHaveLength(3)
	})

	test('returns empty array when content is not array', () => {
		expect(getAllBinaryNodeChildren(nodeWithContent('iq', {}, 'string content'))).toEqual([])
	})

	test('returns empty array when content is undefined', () => {
		expect(getAllBinaryNodeChildren({ tag: 'iq', attrs: {} })).toEqual([])
	})
})

describe('getBinaryNodeChildBuffer', () => {
	test('returns Buffer child content', () => {
		const buf = Buffer.from([1, 2, 3])
		const parent = nodeWithContent('iq', {}, [nodeWithContent('data', {}, buf)])
		expect(getBinaryNodeChildBuffer(parent, 'data')).toEqual(buf)
	})

	test('returns Uint8Array child content', () => {
		const arr = new Uint8Array([4, 5, 6])
		const parent = nodeWithContent('iq', {}, [nodeWithContent('data', {}, arr)])
		expect(getBinaryNodeChildBuffer(parent, 'data')).toBe(arr)
	})

	test('returns undefined when content is string', () => {
		const parent = nodeWithContent('iq', {}, [nodeWithContent('data', {}, 'text')])
		expect(getBinaryNodeChildBuffer(parent, 'data')).toBeUndefined()
	})

	test('returns undefined when child missing', () => {
		const parent = nodeWithContent('iq', {}, [node('other', {})])
		expect(getBinaryNodeChildBuffer(parent, 'data')).toBeUndefined()
	})
})

describe('getBinaryNodeChildString', () => {
	test('returns string from Buffer content', () => {
		const buf = Buffer.from('hello')
		const parent = nodeWithContent('iq', {}, [nodeWithContent('name', {}, buf)])
		expect(getBinaryNodeChildString(parent, 'name')).toBe('hello')
	})

	test('returns string from Uint8Array content', () => {
		const arr = new Uint8Array(Buffer.from('world'))
		const parent = nodeWithContent('iq', {}, [nodeWithContent('name', {}, arr)])
		expect(getBinaryNodeChildString(parent, 'name')).toBe('world')
	})

	test('returns string content directly', () => {
		const parent = nodeWithContent('iq', {}, [nodeWithContent('name', {}, 'direct')])
		expect(getBinaryNodeChildString(parent, 'name')).toBe('direct')
	})

	test('returns undefined when child missing', () => {
		const parent = nodeWithContent('iq', {}, [])
		expect(getBinaryNodeChildString(parent, 'name')).toBeUndefined()
	})
})

describe('getBinaryNodeChildUInt', () => {
	test('decodes a big-endian uint from buffer', () => {
		const buf = Buffer.from([0x00, 0x00, 0x00, 0x05]) // 5 as 4-byte big-endian
		const parent = nodeWithContent('iq', {}, [nodeWithContent('counter', {}, buf)])
		expect(getBinaryNodeChildUInt(parent, 'counter', 4)).toBe(5)
	})

	test('decodes 2-byte uint', () => {
		const buf = Buffer.from([0x01, 0x00]) // 256
		const parent = nodeWithContent('iq', {}, [nodeWithContent('n', {}, buf)])
		expect(getBinaryNodeChildUInt(parent, 'n', 2)).toBe(256)
	})

	test('returns undefined when child missing', () => {
		const parent = nodeWithContent('iq', {}, [])
		expect(getBinaryNodeChildUInt(parent, 'n', 4)).toBeUndefined()
	})
})

describe('assertNodeErrorFree', () => {
	test('does not throw when no error child', () => {
		const parent = nodeWithContent('iq', {}, [node('result', {})])
		expect(() => assertNodeErrorFree(parent)).not.toThrow()
	})

	test('throws Boom when error child present', () => {
		const errChild = nodeWithContent('error', { text: 'not-allowed', code: '401' }, undefined)
		const parent = nodeWithContent('iq', {}, [errChild])
		expect(() => assertNodeErrorFree(parent)).toThrow('not-allowed')
	})

	test('includes numeric code in Boom data', () => {
		const errChild = nodeWithContent('error', { text: 'forbidden', code: '403' }, undefined)
		const parent = nodeWithContent('iq', {}, [errChild])
		try {
			assertNodeErrorFree(parent)
			fail('should have thrown')
		} catch (e) {
			expect(e.data).toBe(403)
		}
	})

	test('falls back to "Unknown error" when no text attr', () => {
		const errChild = nodeWithContent('error', { code: '500' }, undefined)
		const parent = nodeWithContent('iq', {}, [errChild])
		expect(() => assertNodeErrorFree(parent)).toThrow('Unknown error')
	})
})

describe('reduceBinaryNodeToDictionary', () => {
	test('builds dict keyed by name attr', () => {
		const parent = nodeWithContent('config', {}, [
			nodeWithContent('item', { name: 'foo', value: 'bar' }, undefined),
			nodeWithContent('item', { name: 'baz', value: '42' }, undefined),
		])
		const dict = reduceBinaryNodeToDictionary(parent, 'item')
		expect(dict).toEqual({ foo: 'bar', baz: '42' })
	})

	test('prefers config_value when value absent', () => {
		const parent = nodeWithContent('config', {}, [
			nodeWithContent('item', { name: 'key', config_value: 'cv' }, undefined),
		])
		const dict = reduceBinaryNodeToDictionary(parent, 'item')
		expect(dict).toEqual({ key: 'cv' })
	})

	test('uses config_code as key when name is not a string', () => {
		const parent = nodeWithContent('config', {}, [
			nodeWithContent('item', { config_code: 'CODE1', value: 'val1' }, undefined),
		])
		const dict = reduceBinaryNodeToDictionary(parent, 'item')
		expect(dict).toEqual({ CODE1: 'val1' })
	})

	test('returns empty object when no matching tag', () => {
		const parent = nodeWithContent('config', {}, [node('other', {})])
		expect(reduceBinaryNodeToDictionary(parent, 'item')).toEqual({})
	})
})
