'use strict'

const { ObjectRepository } = require('../src/Store/object-repository')

describe('ObjectRepository', () => {
	describe('constructor', () => {
		test('empty default', () => {
			const r = new ObjectRepository()
			expect(r.count()).toBe(0)
		})

		test('initializes from entity map', () => {
			const r = new ObjectRepository({ a: { name: 'Alice' }, b: { name: 'Bob' } })
			expect(r.count()).toBe(2)
		})
	})

	describe('findById', () => {
		test('returns entity when present', () => {
			const r = new ObjectRepository({ x: { v: 1 } })
			expect(r.findById('x')).toEqual({ v: 1 })
		})

		test('returns undefined when absent', () => {
			const r = new ObjectRepository()
			expect(r.findById('missing')).toBeUndefined()
		})
	})

	describe('findAll', () => {
		test('returns all values', () => {
			const r = new ObjectRepository({ a: { v: 1 }, b: { v: 2 } })
			const all = r.findAll()
			expect(all).toHaveLength(2)
			expect(all.map(e => e.v).sort()).toEqual([1, 2])
		})

		test('empty repository → empty array', () => {
			expect(new ObjectRepository().findAll()).toEqual([])
		})
	})

	describe('upsertById', () => {
		test('inserts new entity', () => {
			const r = new ObjectRepository()
			r.upsertById('a', { v: 1 })
			expect(r.findById('a')).toEqual({ v: 1 })
			expect(r.count()).toBe(1)
		})

		test('replaces existing entity', () => {
			const r = new ObjectRepository({ a: { v: 1 } })
			r.upsertById('a', { v: 99 })
			expect(r.findById('a')).toEqual({ v: 99 })
			expect(r.count()).toBe(1)
		})

		test('stores a shallow copy', () => {
			const r = new ObjectRepository()
			const entity = { v: 1 }
			r.upsertById('a', entity)
			entity.v = 999
			expect(r.findById('a')?.v).toBe(1)
		})
	})

	describe('deleteById', () => {
		test('removes existing entity → returns true', () => {
			const r = new ObjectRepository({ a: { v: 1 } })
			expect(r.deleteById('a')).toBe(true)
			expect(r.findById('a')).toBeUndefined()
			expect(r.count()).toBe(0)
		})

		test('missing id → returns false', () => {
			const r = new ObjectRepository()
			expect(r.deleteById('missing')).toBe(false)
		})
	})

	describe('count', () => {
		test('tracks insertions and deletions', () => {
			const r = new ObjectRepository()
			expect(r.count()).toBe(0)
			r.upsertById('a', {})
			expect(r.count()).toBe(1)
			r.upsertById('b', {})
			expect(r.count()).toBe(2)
			r.deleteById('a')
			expect(r.count()).toBe(1)
		})
	})

	describe('toJSON', () => {
		test('returns array of all entities', () => {
			const r = new ObjectRepository({ a: { v: 1 } })
			expect(r.toJSON()).toEqual([{ v: 1 }])
		})

		test('empty → empty array', () => {
			expect(new ObjectRepository().toJSON()).toEqual([])
		})
	})
})
