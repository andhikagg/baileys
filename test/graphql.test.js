'use strict'

// Tests for graphql.js: executeWWWGraphQL, executeFacebookGraphQL,
// executeWamoGraphQL, parseGraphQLResponse, and the socket methods.

const { executeWWWGraphQL, executeFacebookGraphQL, executeWamoGraphQL } = require('../src/Socket/graphql')

// ── mock fetch ────────────────────────────────────────────────────────────────

let _fetchImpl = null
global.fetch = (...args) => _fetchImpl(...args)

const mockFetch = (status, body) => {
	_fetchImpl = async () => ({
		ok: status >= 200 && status < 300,
		status,
		json: async () => body
	})
}

afterEach(() => { _fetchImpl = null })

// ── executeWWWGraphQL ─────────────────────────────────────────────────────────

describe('executeWWWGraphQL', () => {
	test('POSTs to graph.whatsapp.com/graphql with doc_id and variables', async () => {
		let capturedUrl, capturedBody
		_fetchImpl = async (url, opts) => {
			capturedUrl = url
			capturedBody = JSON.parse(opts.body)
			return { ok: true, status: 200, json: async () => ({ data: { xwa2_test: { value: 42 } } }) }
		}

		const result = await executeWWWGraphQL('12345678901234567', { foo: 'bar' }, 'TOKEN', 'xwa2_test')

		expect(capturedUrl).toBe('https://graph.whatsapp.com/graphql')
		expect(capturedBody.doc_id).toBe('12345678901234567')
		expect(capturedBody.variables).toEqual({ foo: 'bar' })
		expect(capturedBody.access_token).toBe('TOKEN')
		expect(result).toEqual({ value: 42 })
	})

	test('returns full data object when dataPath is null', async () => {
		mockFetch(200, { data: { a: 1, b: 2 } })
		const result = await executeWWWGraphQL('123', {}, 'TOKEN', null)
		expect(result).toEqual({ a: 1, b: 2 })
	})

	test('throws Boom on GraphQL errors array', async () => {
		mockFetch(200, { errors: [{ message: 'Not authorized', extensions: { error_code: 401 } }] })
		await expect(executeWWWGraphQL('123', {}, 'TOKEN', null)).rejects.toThrow('Not authorized')
	})

	test('throws Boom on HTTP error status', async () => {
		mockFetch(500, {})
		await expect(executeWWWGraphQL('123', {}, 'TOKEN', null)).rejects.toThrow('500')
	})

	test('throws Boom when dataPath key missing from response', async () => {
		mockFetch(200, { data: {} })
		await expect(executeWWWGraphQL('123', {}, 'TOKEN', 'xwa2_missing')).rejects.toThrow()
	})

	test('uses default fallback token when none supplied', async () => {
		let capturedBody
		_fetchImpl = async (url, opts) => {
			capturedBody = JSON.parse(opts.body)
			return { ok: true, status: 200, json: async () => ({ data: { r: true } }) }
		}
		await executeWWWGraphQL('123', {}, null, null)
		expect(capturedBody.access_token).toMatch(/^WA\|/)
	})

	test('uses custom endpoint when provided', async () => {
		let capturedUrl
		_fetchImpl = async (url) => {
			capturedUrl = url
			return { ok: true, status: 200, json: async () => ({ data: {} }) }
		}
		await executeWWWGraphQL('123', {}, 'T', null, 'en', 'https://custom.endpoint/gql')
		expect(capturedUrl).toBe('https://custom.endpoint/gql')
	})
})

// ── executeFacebookGraphQL ────────────────────────────────────────────────────

describe('executeFacebookGraphQL', () => {
	test('POSTs to acs.whatsapp.com/graphql', async () => {
		let capturedUrl
		_fetchImpl = async (url) => {
			capturedUrl = url
			return { ok: true, status: 200, json: async () => ({ data: {} }) }
		}
		await executeFacebookGraphQL('123', {}, 'T', null)
		expect(capturedUrl).toBe('https://acs.whatsapp.com/graphql')
	})
})

// ── executeWamoGraphQL ────────────────────────────────────────────────────────

describe('executeWamoGraphQL', () => {
	test('POSTs form-encoded body to wamo host', async () => {
		let capturedUrl, capturedBody, capturedHeaders
		_fetchImpl = async (url, opts) => {
			capturedUrl = url
			capturedBody = opts.body
			capturedHeaders = opts.headers
			return { ok: true, status: 200, json: async () => ({ data: { r: 'ok' } }) }
		}

		await executeWamoGraphQL('99999999999999999', { x: 1 }, {
			accessToken: 'WAM_TOKEN',
			credential: 'CRED',
			userId: 'UID'
		}, null)

		expect(capturedUrl).toContain('wamo.whatsapp.net')
		expect(capturedUrl).toContain('/api/wamo/graphql/')
		expect(capturedHeaders['Content-Type']).toBe('application/x-www-form-urlencoded')
		expect(capturedBody).toContain('access_token=WAM_TOKEN')
		expect(capturedBody).toContain('credential=CRED')
		expect(capturedBody).toContain('user_id=UID')
		expect(capturedBody).toContain('app_id=1015890928915437')
		expect(capturedBody).toContain('doc_id=99999999999999999')
	})

	test('uses custom wamoHost when provided', async () => {
		let capturedUrl
		_fetchImpl = async (url) => {
			capturedUrl = url
			return { ok: true, status: 200, json: async () => ({ data: {} }) }
		}
		await executeWamoGraphQL('123', {}, {}, null, 'custom-wamo.example.com')
		expect(capturedUrl).toContain('custom-wamo.example.com')
	})

	test('throws on HTTP error', async () => {
		mockFetch(403, {})
		await expect(executeWamoGraphQL('123', {}, {})).rejects.toThrow('403')
	})

	test('extracts dataPath from response', async () => {
		mockFetch(200, { data: { xwa2_wamo_user_basic: { name: 'Test' } } })
		const result = await executeWamoGraphQL('123', {}, {}, 'xwa2_wamo_user_basic')
		expect(result).toEqual({ name: 'Test' })
	})
})

// ── WWW_GQL_IDS / WAMO_GQL_IDS presence ──────────────────────────────────────

describe('GQL ID dictionaries', () => {
	const { makeGraphQLSocket } = require('../src/Socket/graphql')

	// makeGraphQLSocket expects a sock with wwwGetNonce/wwwExchangeNonce
	const mockSock = {
		wwwGetNonce: jest.fn().mockResolvedValue({ nonce: 'test-nonce' }),
		wwwExchangeNonce: jest.fn().mockResolvedValue({ access_token: 'test-token' })
	}

	const sock = makeGraphQLSocket(mockSock)

	test('WWW_GQL_IDS is exported and contains key entries', () => {
		expect(sock.WWW_GQL_IDS).toBeDefined()
		expect(sock.WWW_GQL_IDS.CREATE_EVENT).toBeDefined()
		expect(sock.WWW_GQL_IDS.GET_UPI_ACCOUNTS).toBeDefined()
		expect(sock.WWW_GQL_IDS.IMAGINE_EDIT).toBeDefined()
		expect(sock.WWW_GQL_IDS.BR_GET_AUTH_OPTIONS).toBeDefined()
	})

	test('WAMO_GQL_IDS is exported and contains key entries', () => {
		expect(sock.WAMO_GQL_IDS).toBeDefined()
		expect(sock.WAMO_GQL_IDS.USER_BASIC).toBeDefined()
		expect(sock.WAMO_GQL_IDS.HEARTBEAT).toBeDefined()
	})

	test('FACEBOOK_GQL_IDS is exported and contains key entries', () => {
		expect(sock.FACEBOOK_GQL_IDS).toBeDefined()
		expect(sock.FACEBOOK_GQL_IDS.GET_COMPLIANCE).toBeDefined()
		expect(sock.FACEBOOK_GQL_IDS.BIZ_ALERTS_UPDATE).toBeDefined()
	})

	test('CLIENT_PERSIST_GQL_IDS is exported and contains key entries', () => {
		expect(sock.CLIENT_PERSIST_GQL_IDS).toBeDefined()
		expect(sock.CLIENT_PERSIST_GQL_IDS.META_AI_FEEDBACK).toBeDefined()
	})

	test('all WWW_GQL_IDS values are non-empty strings', () => {
		for (const [key, val] of Object.entries(sock.WWW_GQL_IDS)) {
			expect(typeof val).toBe('string', `${key} should be a string`)
			expect(val.length).toBeGreaterThan(0)
		}
	})

	test('acquireAccessToken caches token on second call', async () => {
		_fetchImpl = async () => ({ ok: true, status: 200, json: async () => ({ data: {} }) })

		const s = makeGraphQLSocket({
			wwwGetNonce: jest.fn().mockResolvedValue({ nonce: 'n1' }),
			wwwExchangeNonce: jest.fn().mockResolvedValue({ access_token: 'cached-token' })
		})

		const t1 = await s.acquireAccessToken()
		const t2 = await s.acquireAccessToken()
		expect(t1).toBe('cached-token')
		expect(t2).toBe('cached-token')
		// should only call wwwGetNonce once
		expect(s.wwwGetNonce ?? mockSock.wwwGetNonce).toBeDefined()
	})

	test('setAccessToken bypasses the nonce flow', async () => {
		const s = makeGraphQLSocket(mockSock)
		s.setAccessToken('direct-token')
		const t = await s.acquireAccessToken()
		expect(t).toBe('direct-token')
	})
})
