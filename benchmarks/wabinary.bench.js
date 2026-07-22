'use strict'

/**
 * Benchmark: WABinary hot paths — JID encode/decode and node traversal
 *
 * Run: node benchmarks/wabinary.bench.js
 */

const { jidEncode, jidDecode, jidNormalizedUser, areJidsSameUser } = require('../src/WABinary/jid-utils')
const {
	getBinaryNodeChildren,
	getBinaryNodeChild,
	getAllBinaryNodeChildren,
	getBinaryNodeChildString
} = require('../src/WABinary/generic-utils')

function bench(label, iterations, fn) {
	for (let i = 0; i < Math.min(500, Math.floor(iterations / 10)); i++) fn(i)

	const start = process.hrtime.bigint()
	for (let i = 0; i < iterations; i++) fn(i)
	const ns = Number(process.hrtime.bigint() - start)

	const ms = (ns / 1e6).toFixed(2)
	const opsPerSec = Math.round(iterations / (ns / 1e9))
	console.log(
		`  ${label.padEnd(50)} ${String(iterations).padStart(8)} ops  ${ms.padStart(8)} ms  ${String(opsPerSec).padStart(12)} ops/s`
	)
}

// ── fixtures ───────────────────────────────────────────────────────────────────

const PHONE_JIDS = Array.from({ length: 100 }, (_, i) => `491234${String(i).padStart(6, '0')}@s.whatsapp.net`)
const DEVICE_JIDS = Array.from(
	{ length: 100 },
	(_, i) => `491234${String(i).padStart(6, '0')}:${i % 10}@s.whatsapp.net`
)
const GROUP_JIDS = Array.from({ length: 50 }, (_, i) => `12036300000${String(i).padStart(7, '0')}@g.us`)

// Pre-built node trees of varying depth
function makeNode(tag, attrs, children) {
	return { tag, attrs, content: children }
}

const WIDE_NODE = makeNode(
	'list',
	{},
	Array.from({ length: 200 }, (_, i) => makeNode('item', { id: String(i), name: `item_${i}`, value: String(i * 2) }))
)

const DEEP_NODE = (() => {
	let n = makeNode('leaf', { name: 'x', value: '1' })
	for (let i = 0; i < 10; i++)
		n = makeNode(`level_${i}`, {}, [n, makeNode('sibling', { name: `s${i}`, value: `v${i}` })])
	return n
})()

const MIXED_NODE = makeNode('iq', {}, [
	makeNode('result', {}, [
		makeNode('item', { id: '1', value: 'a' }),
		makeNode('item', { id: '2', value: 'b' }),
		makeNode('item', { id: '3', value: 'c' })
	]),
	makeNode('error', { text: 'ok' }),
	makeNode('meta', { version: '1' }, [makeNode('name', {}, Buffer.from('test'))])
])

// ── JID encode/decode ─────────────────────────────────────────────────────────

console.log('\nbaileys-wabinary benchmarks')
console.log('='.repeat(80))

console.log('\n JID encode / decode')
bench('jidEncode — phone, no device', 1_000_000, i => jidEncode(`491234${i % 1000000}`, 's.whatsapp.net'))
bench('jidEncode — phone + device', 1_000_000, i => jidEncode(`491234${i % 100}`, 's.whatsapp.net', i % 10))
bench('jidEncode — group', 1_000_000, i => jidEncode(`120363${i % 1000}`, 'g.us'))

bench('jidDecode — phone', 1_000_000, i => jidDecode(PHONE_JIDS[i % PHONE_JIDS.length]))
bench('jidDecode — phone + device', 500_000, i => jidDecode(DEVICE_JIDS[i % DEVICE_JIDS.length]))
bench('jidDecode — group', 500_000, i => jidDecode(GROUP_JIDS[i % GROUP_JIDS.length]))
bench('jidDecode — invalid (no @)', 500_000, () => jidDecode('invalid'))

bench('jidNormalizedUser — c.us → s.whatsapp.net', 500_000, i =>
	jidNormalizedUser(PHONE_JIDS[i % PHONE_JIDS.length].replace('s.whatsapp.net', 'c.us'))
)
bench('areJidsSameUser — same device', 500_000, i => areJidsSameUser(PHONE_JIDS[i % 50], DEVICE_JIDS[i % 50]))

// ── node traversal ────────────────────────────────────────────────────────────

console.log('\n Node traversal')
bench('getBinaryNodeChildren — wide (200 items, cold)', 10_000, () => {
	// Create a new node each time to avoid WeakMap cache hits
	const fresh = makeNode(
		'list',
		{},
		Array.from({ length: 200 }, (_, j) => makeNode('item', { id: String(j) }))
	)
	getBinaryNodeChildren(fresh, 'item')
})

bench('getBinaryNodeChildren — wide (200 items, warm)', 200_000, i => {
	getBinaryNodeChildren(WIDE_NODE, 'item')
})

bench('getBinaryNodeChildren — wide, miss', 200_000, i => {
	getBinaryNodeChildren(WIDE_NODE, 'missing')
})

bench('getBinaryNodeChild — first match', 500_000, i => {
	getBinaryNodeChild(MIXED_NODE, 'result')
})

bench('getAllBinaryNodeChildren', 500_000, i => {
	getAllBinaryNodeChildren(MIXED_NODE)
})

bench('getBinaryNodeChildString — Buffer content', 200_000, i => {
	getBinaryNodeChildString(MIXED_NODE.content[2], 'name')
})

console.log('\n' + '='.repeat(80))
console.log(' Done.')
process.exit(0)
