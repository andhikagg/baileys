module.exports = {
	testEnvironment: 'node',
	roots: ['<rootDir>/test'],
	testMatch: ['**/*.test.js'],
	moduleNameMapper: {
		'^whatsapp-rust-bridge-baron$': '<rootDir>/test/__mocks__/whatsapp-rust-bridge-baron.js',
		'^p-queue$': '<rootDir>/test/__mocks__/p-queue.js'
	},
	testTimeout: 15000,
	verbose: true,
	coverageDirectory: 'coverage',
	collectCoverageFrom: ['src/**/*.js', '!src/**/*.d.js'],
	coverageThreshold: {
		global: {
			lines: 30
		}
	},
	coverageReporters: ['text-summary', 'lcov'],
	forceExit: true
}
