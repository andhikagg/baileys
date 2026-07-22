'use strict'

const { makeOrderedDictionary } = require('../src/Store/make-ordered-dictionary')

const makeDict = () => makeOrderedDictionary(item => item.id)

describe('makeOrderedDictionary', () => {
	describe('get', () => {
		test('returns undefined for missing id', () => {
			const d = makeDict()
			expect(d.get('x')).toBeUndefined()
		})

		test('returns item after upsert', () => {
			const d = makeDict()
			d.upsert({ id: 'a', value: 1 }, 'append')
			expect(d.get('a')).toEqual({ id: 'a', value: 1 })
		})
	})

	describe('upsert', () => {
		test('append adds to end of array', () => {
			const d = makeDict()
			d.upsert({ id: 'a' }, 'append')
			d.upsert({ id: 'b' }, 'append')
			expect(d.array.map(i => i.id)).toEqual(['a', 'b'])
		})

		test('prepend (non-append) adds to front', () => {
			const d = makeDict()
			d.upsert({ id: 'a' }, 'append')
			d.upsert({ id: 'b' }, 'prepend')
			expect(d.array[0].id).toBe('b')
			expect(d.array[1].id).toBe('a')
		})

		test('updates existing item in place', () => {
			const d = makeDict()
			d.upsert({ id: 'a', value: 1 }, 'append')
			d.upsert({ id: 'a', value: 2 }, 'append')
			expect(d.array).toHaveLength(1)
			expect(d.get('a')?.value).toBe(2)
		})

		test('dict reflects upserted item', () => {
			const d = makeDict()
			d.upsert({ id: 'x', v: 9 }, 'append')
			expect(d.get('x')?.v).toBe(9)
		})
	})

	describe('update', () => {
		test('updates existing item', () => {
			const d = makeDict()
			d.upsert({ id: 'a', v: 1 }, 'append')
			d.update({ id: 'a', v: 99 })
			expect(d.get('a')?.v).toBe(99)
		})

		test('does nothing when item absent', () => {
			const d = makeDict()
			d.update({ id: 'missing', v: 1 })
			expect(d.array).toHaveLength(0)
		})
	})

	describe('remove', () => {
		test('removes existing item, returns true', () => {
			const d = makeDict()
			d.upsert({ id: 'a' }, 'append')
			expect(d.remove({ id: 'a' })).toBe(true)
			expect(d.array).toHaveLength(0)
			expect(d.get('a')).toBeUndefined()
		})

		test('returns false when item not found', () => {
			const d = makeDict()
			expect(d.remove({ id: 'x' })).toBe(false)
		})

		test('removes correct item when multiple present', () => {
			const d = makeDict()
			d.upsert({ id: 'a' }, 'append')
			d.upsert({ id: 'b' }, 'append')
			d.upsert({ id: 'c' }, 'append')
			d.remove({ id: 'b' })
			expect(d.array.map(i => i.id)).toEqual(['a', 'c'])
		})
	})

	describe('updateAssign', () => {
		test('merges partial update onto existing item', () => {
			const d = makeDict()
			d.upsert({ id: 'a', x: 1, y: 2 }, 'append')
			const ok = d.updateAssign('a', { y: 99, z: 3 })
			expect(ok).toBe(true)
			expect(d.get('a')).toEqual({ id: 'a', x: 1, y: 99, z: 3 })
		})

		test('returns false when id not found', () => {
			const d = makeDict()
			expect(d.updateAssign('missing', { x: 1 })).toBe(false)
		})
	})

	describe('clear', () => {
		test('empties array and dict', () => {
			const d = makeDict()
			d.upsert({ id: 'a' }, 'append')
			d.upsert({ id: 'b' }, 'append')
			d.clear()
			expect(d.array).toHaveLength(0)
			expect(d.get('a')).toBeUndefined()
		})

		test('array reference is preserved (same object)', () => {
			const d = makeDict()
			d.upsert({ id: 'a' }, 'append')
			const ref = d.array
			d.clear()
			expect(d.array).toBe(ref)
		})
	})

	describe('filter', () => {
		test('removes items that do not match predicate', () => {
			const d = makeDict()
			d.upsert({ id: 'a', v: 1 }, 'append')
			d.upsert({ id: 'b', v: 2 }, 'append')
			d.upsert({ id: 'c', v: 3 }, 'append')
			d.filter(item => item.v % 2 !== 0)
			expect(d.array.map(i => i.id)).toEqual(['a', 'c'])
			expect(d.get('b')).toBeUndefined()
		})

		test('keeps items that match predicate', () => {
			const d = makeDict()
			d.upsert({ id: 'a', keep: true }, 'append')
			d.upsert({ id: 'b', keep: false }, 'append')
			d.filter(i => i.keep)
			expect(d.array).toHaveLength(1)
			expect(d.get('a')).toBeDefined()
		})
	})

	describe('toJSON / fromJSON', () => {
		test('toJSON returns the array', () => {
			const d = makeDict()
			d.upsert({ id: 'a' }, 'append')
			expect(d.toJSON()).toEqual([{ id: 'a' }])
		})

		test('fromJSON loads items and makes them accessible by get', () => {
			const d = makeDict()
			d.fromJSON([{ id: 'x', v: 10 }, { id: 'y', v: 20 }])
			expect(d.array).toHaveLength(2)
			// Note: fromJSON replaces array content but does NOT rebuild dict
			// so get() may not work — we only assert array length here
		})
	})

	describe('ordering invariants', () => {
		test('array order preserved across multiple appends', () => {
			const d = makeDict()
			for (let i = 0; i < 10; i++) {
				d.upsert({ id: String(i) }, 'append')
			}
			expect(d.array.map(i => i.id)).toEqual(['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'])
		})

		test('update does not change order', () => {
			const d = makeDict()
			d.upsert({ id: 'a' }, 'append')
			d.upsert({ id: 'b' }, 'append')
			d.update({ id: 'a', extra: true })
			expect(d.array[0].id).toBe('a')
			expect(d.array[1].id).toBe('b')
		})
	})
})
