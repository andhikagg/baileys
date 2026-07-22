'use strict'

/**
 * Benchmark: antiban.js core hot paths
 *
 * Run: node benchmarks/antiban.bench.js
 *
 * Each section runs N iterations, measures wall-clock ms, and prints ops/sec.
 * No network, no WS — pure in-process logic.
 */

const { RateLimiter, WarmUp, AntiBan, ContentVariator, resolveConfig } = require('../src/antiban')

function bench(label, iterations, fn) {
	// warmup
	for (let i = 0; i < Math.min(100, iterations / 10); i++) fn(i)

	const start = process.hrtime.bigint()
	for (let i = 0; i < iterations; i++) fn(i)
	const ns = Number(process.hrtime.bigint() - start)

	const ms = (ns / 1e6).toFixed(2)
	const opsPerSec = Math.round(iterations / (ns / 1e9))
	console.log(
		`  ${label.padEnd(45)} ${String(iterations).padStart(7)} ops  ${ms.padStart(8)} ms  ${String(opsPerSec).padStart(10)} ops/s`
	)
}

async function benchAsync(label, iterations, fn) {
	// warmup
	for (let i = 0; i < Math.min(20, iterations / 10); i++) await fn(i)

	const start = process.hrtime.bigint()
	for (let i = 0; i < iterations; i++) await fn(i)
	const ns = Number(process.hrtime.bigint() - start)

	const ms = (ns / 1e6).toFixed(2)
	const opsPerSec = Math.round(iterations / (ns / 1e9))
	console.log(
		`  ${label.padEnd(45)} ${String(iterations).padStart(7)} ops  ${ms.padStart(8)} ms  ${String(opsPerSec).padStart(10)} ops/s`
	)
}

async function main() {
	console.log('\nbaileys-antiban benchmarks')
	console.log('='.repeat(80))

	// ── resolveConfig ──────────────────────────────────────────────────────────
	console.log('\n resolveConfig')
	bench('resolveConfig(undefined)', 100_000, () => resolveConfig(undefined))
	bench('resolveConfig("moderate")', 100_000, () => resolveConfig('moderate'))
	bench('resolveConfig({ maxPerMinute: 20 })', 100_000, () => resolveConfig({ maxPerMinute: 20 }))

	// ── RateLimiter ────────────────────────────────────────────────────────────
	console.log('\n RateLimiter')
	const limiter = new RateLimiter({ maxPerMinute: 999, maxPerHour: 999, maxPerDay: 999 })
	const jids = Array.from({ length: 100 }, (_, i) => `49${i}@s.whatsapp.net`)

	await benchAsync('getDelay — known chat (no new-chat overhead)', 5_000, async i => {
		const jid = jids[i % jids.length]
		limiter.knownChats.add(jid)
		await limiter.getDelay(jid, 'hello world')
	})

	await benchAsync('getDelay — unknown chat (new-chat overhead)', 2_000, async i => {
		await limiter.getDelay(`new${i}@s.whatsapp.net`, 'hello world')
	})

	bench('record()', 10_000, i => {
		limiter.record(jids[i % jids.length], 'benchmark text')
	})

	bench('getStats()', 50_000, () => limiter.getStats())

	// ── WarmUp ─────────────────────────────────────────────────────────────────
	console.log('\n WarmUp')
	const warmup = new WarmUp({ warmUpDays: 5, day1Limit: 30, growthFactor: 1.8 })
	bench('canSend()', 100_000, () => warmup.canSend())
	bench('getDailyLimit()', 100_000, () => warmup.getDailyLimit())
	bench('getStatus()', 50_000, () => warmup.getStatus())
	bench('exportState()', 50_000, () => warmup.exportState())

	// ── AntiBan.beforeSend ────────────────────────────────────────────────────
	console.log('\n AntiBan.beforeSend')
	const ab = new AntiBan({ preset: 'moderate', logging: false })
	const abJids = Array.from({ length: 50 }, (_, i) => `49${1000 + i}@s.whatsapp.net`)
	abJids.forEach(j => ab.rateLimiter.knownChats.add(j))

	await benchAsync('beforeSend — known chat, below limits', 500, async i => {
		await ab.beforeSend(abJids[i % abJids.length], 'hi')
	})

	await benchAsync('beforeSend — paused (early return)', 10_000, async i => {
		ab.health.setPaused(true)
		await ab.beforeSend(abJids[i % abJids.length], 'hi')
	})
	ab.health.setPaused(false)
	ab.destroy()

	// ── ContentVariator ────────────────────────────────────────────────────────
	console.log('\n ContentVariator')
	const shortText = 'Hello, how are you?'
	const longText =
		'This is a longer broadcast message with several words to test synonym replacement and punctuation variation performance at scale across many recipients in your campaign.'

	const vZW = new ContentVariator({
		zeroWidthChars: true,
		punctuationVariation: false,
		synonyms: false,
		emojiPadding: false
	})
	const vPunct = new ContentVariator({
		zeroWidthChars: false,
		punctuationVariation: true,
		synonyms: false,
		emojiPadding: false
	})
	const vAll = new ContentVariator({
		zeroWidthChars: true,
		punctuationVariation: true,
		synonyms: true,
		emojiPadding: false
	})

	bench('vary — short text, zero-width only', 100_000, () => vZW.vary(shortText))
	bench('vary — short text, punctuation only', 100_000, () => vPunct.vary(shortText))
	bench('vary — long text, all transforms', 20_000, () => vAll.vary(longText))
	bench('varyBulk(text, 100)', 1_000, () => vAll.varyBulk(shortText, 100))

	console.log('\n' + '='.repeat(80))
	console.log(' Done.')
}

main()
	.catch(err => {
		console.error(err)
		process.exit(1)
	})
	.then(() => process.exit(0))
