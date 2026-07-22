'use strict'

const { Browsers, getPlatformId } = require('../src/Utils/browser-utils')

describe('Browsers', () => {
	test('ubuntu returns ["Ubuntu", browser, version]', () => {
		const r = Browsers.ubuntu('Chrome')
		expect(r).toEqual(['Ubuntu', 'Chrome', '22.04.4'])
	})

	test('macOS', () => {
		const r = Browsers.macOS('Safari')
		expect(r[0]).toBe('Mac OS')
		expect(r[1]).toBe('Safari')
	})

	test('windows', () => {
		const r = Browsers.windows('Edge')
		expect(r[0]).toBe('Windows')
	})

	test('linux', () => {
		expect(Browsers.linux('Firefox')[0]).toBe('Linux')
	})

	test('baileys', () => {
		const r = Browsers.baileys('Baileys')
		expect(r[0]).toBe('Baileys')
	})

	test('android', () => {
		expect(Browsers.android('Chrome')[0]).toBe('Android')
	})

	test('iOS', () => {
		expect(Browsers.iOS('Safari')[0]).toBe('iOS')
	})

	test('kaiOS', () => {
		expect(Browsers.kaiOS('Browser')[0]).toBe('KaiOS')
	})

	test('chromeOS', () => {
		expect(Browsers.chromeOS('Chrome')[0]).toBe('Chrome OS')
	})

	test('appropriate returns array of length 3', () => {
		const r = Browsers.appropriate('Chrome')
		expect(r).toHaveLength(3)
		expect(typeof r[0]).toBe('string')
		expect(r[1]).toBe('Chrome')
	})

	test('custom with known platform name', () => {
		const r = Browsers.custom('linux', 'Chrome', '6.0')
		expect(r[0]).toBe('Linux')
		expect(r[1]).toBe('Chrome')
		expect(r[2]).toBe('6.0')
	})

	test('custom with unknown platform falls back to raw name', () => {
		const r = Browsers.custom('MyOS', 'Browser', '1.0')
		expect(r[0]).toBe('MyOS')
	})

	test('custom without version uses platform default or latest', () => {
		const r = Browsers.custom('linux', 'Chrome')
		expect(r[2]).toBeTruthy()
	})

	test('each Browsers factory returns [platform, browser, version] tuple', () => {
		const browser = 'TestBrowser'
		for (const key of ['ubuntu', 'macOS', 'windows', 'linux', 'baileys', 'android', 'iOS']) {
			const r = Browsers[key](browser)
			expect(r).toHaveLength(3)
			expect(r[1]).toBe(browser)
			expect(typeof r[2]).toBe('string')
		}
	})
})

describe('getPlatformId', () => {
	test('CHROME returns string id', () => {
		const id = getPlatformId('chrome')
		expect(typeof id).toBe('string')
	})

	test('unknown browser falls back to "1"', () => {
		expect(getPlatformId('nonexistentbrowser')).toBe('1')
	})

	test('case-insensitive lookup (uppercases input)', () => {
		const lower = getPlatformId('chrome')
		const upper = getPlatformId('CHROME')
		expect(lower).toBe(upper)
	})
})
