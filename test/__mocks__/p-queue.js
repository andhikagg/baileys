'use strict'
// Minimal p-queue stub for Jest — only the default export / constructor is used
class PQueue {
	constructor() {
		this._queue = []
	}
	add(fn) {
		return fn()
	}
	onIdle() {
		return Promise.resolve()
	}
	get size() { return 0 }
	get pending() { return 0 }
}

module.exports = PQueue
module.exports.default = PQueue
