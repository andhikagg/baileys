'use strict'
Object.defineProperty(exports, '__esModule', { value: true })
exports.makeKeyedMutex = exports.makeMutex = void 0
const async_mutex_1 = require('async-mutex')
const makeMutex = () => {
	const mutex = new async_mutex_1.Mutex()
	return {
		mutex(code) {
			return mutex.runExclusive(code)
		}
	}
}
exports.makeMutex = makeMutex
const makeKeyedMutex = () => {
	const map = new Map()
	return {
		async mutex(key, task) {
			let entry = map.get(key)
			if (!entry) {
				entry = { mutex: new async_mutex_1.Mutex(), refCount: 0 }
				map.set(key, entry)
			}
			entry.refCount++
			try {
				return await entry.mutex.runExclusive(task)
			} finally {
				entry.refCount--
				// only delete it if this is still the current entry
				if (entry.refCount === 0 && map.get(key) === entry) {
					map.delete(key)
				}
			}
		}
	}
}
exports.makeKeyedMutex = makeKeyedMutex
