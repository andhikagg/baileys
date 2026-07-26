'use strict'
Object.defineProperty(exports, '__esModule', { value: true })
exports.executeWMexQuery = void 0
const boom_1 = require('@hapi/boom')
const WABinary_1 = require('../WABinary')
const wMexQuery = (variables, queryId, query, generateMessageTag) => {
	return query({
		tag: 'iq',
		attrs: {
			id: generateMessageTag(),
			type: 'get',
			to: WABinary_1.S_WHATSAPP_NET,
			xmlns: 'w:mex'
		},
		content: [
			{
				tag: 'query',
				attrs: { query_id: queryId },
				content: Buffer.from(JSON.stringify({ variables }), 'utf-8')
			}
		]
	})
}
const executeWMexQuery = async (variables, queryId, dataPath, query, generateMessageTag) => {
	const result = await wMexQuery(variables, queryId, query, generateMessageTag)
	const child = (0, WABinary_1.getBinaryNodeChild)(result, 'result')
	if (child?.content) {
		const data = JSON.parse(child.content.toString())
		if (data.errors && data.errors.length > 0) {
			const errorMessages = data.errors.map(err => err.message || 'Unknown error').join(', ')
			const firstError = data.errors[0]
			const errorCode = firstError.extensions?.error_code || 400
			// Log full error payload to aid debugging stale/invalid query_id issues
			console.error('[mex error] query_id=%s code=%s errors=%s', queryId, errorCode, JSON.stringify(data.errors))
			throw new boom_1.Boom(`GraphQL server error: ${errorMessages}`, { statusCode: errorCode, data: firstError })
		}
		const response = dataPath ? data?.data?.[dataPath] : data?.data
		if (typeof response !== 'undefined') {
			return response
		}
	}
	const action = (dataPath || '').startsWith('xwa2_')
		? dataPath.substring(5).replace(/_/g, ' ')
		: dataPath?.replace(/_/g, ' ')
	throw new boom_1.Boom(`Failed to ${action}, unexpected response structure.`, { statusCode: 400, data: result })
}
exports.executeWMexQuery = executeWMexQuery
