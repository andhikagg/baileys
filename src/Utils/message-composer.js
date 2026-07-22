'use strict'

const { proto } = require('../../WAProto/index.js')
const { generateMessageIDV2 } = require('./generics.js')

const JS_KEYWORDS = new Set([
	'import',
	'export',
	'from',
	'default',
	'as',
	'const',
	'let',
	'var',
	'function',
	'class',
	'extends',
	'new',
	'return',
	'if',
	'else',
	'for',
	'while',
	'do',
	'switch',
	'case',
	'break',
	'continue',
	'try',
	'catch',
	'finally',
	'throw',
	'async',
	'await',
	'yield',
	'typeof',
	'instanceof',
	'in',
	'of',
	'delete',
	'void',
	'true',
	'false',
	'null',
	'undefined',
	'NaN',
	'Infinity',
	'this',
	'super',
	'static',
	'get',
	'set',
	'debugger',
	'with'
])

const PYTHON_KEYWORDS = new Set([
	'import',
	'from',
	'as',
	'def',
	'class',
	'return',
	'if',
	'elif',
	'else',
	'for',
	'while',
	'break',
	'continue',
	'try',
	'except',
	'finally',
	'raise',
	'with',
	'yield',
	'lambda',
	'pass',
	'del',
	'global',
	'nonlocal',
	'assert',
	'True',
	'False',
	'None',
	'and',
	'or',
	'not',
	'in',
	'is',
	'async',
	'await',
	'self',
	'print'
])

const LANGUAGE_KEYWORDS = {
	javascript: JS_KEYWORDS,
	typescript: JS_KEYWORDS,
	js: JS_KEYWORDS,
	ts: JS_KEYWORDS,
	python: PYTHON_KEYWORDS,
	py: PYTHON_KEYWORDS
}

var CodeHighlightType
;(function (CodeHighlightType) {
	CodeHighlightType[(CodeHighlightType['DEFAULT'] = 0)] = 'DEFAULT'
	CodeHighlightType[(CodeHighlightType['KEYWORD'] = 1)] = 'KEYWORD'
	CodeHighlightType[(CodeHighlightType['METHOD'] = 2)] = 'METHOD'
	CodeHighlightType[(CodeHighlightType['STRING'] = 3)] = 'STRING'
	CodeHighlightType[(CodeHighlightType['NUMBER'] = 4)] = 'NUMBER'
	CodeHighlightType[(CodeHighlightType['COMMENT'] = 5)] = 'COMMENT'
})(CodeHighlightType || (CodeHighlightType = {}))

var RichSubMessageType
;(function (RichSubMessageType) {
	RichSubMessageType[(RichSubMessageType['UNKNOWN'] = 0)] = 'UNKNOWN'
	RichSubMessageType[(RichSubMessageType['GRID_IMAGE'] = 1)] = 'GRID_IMAGE'
	RichSubMessageType[(RichSubMessageType['TEXT'] = 2)] = 'TEXT'
	RichSubMessageType[(RichSubMessageType['INLINE_IMAGE'] = 3)] = 'INLINE_IMAGE'
	RichSubMessageType[(RichSubMessageType['TABLE'] = 4)] = 'TABLE'
	RichSubMessageType[(RichSubMessageType['CODE'] = 5)] = 'CODE'
	RichSubMessageType[(RichSubMessageType['DYNAMIC'] = 6)] = 'DYNAMIC'
	RichSubMessageType[(RichSubMessageType['MAP'] = 7)] = 'MAP'
	RichSubMessageType[(RichSubMessageType['LATEX'] = 8)] = 'LATEX'
	RichSubMessageType[(RichSubMessageType['CONTENT_ITEMS'] = 9)] = 'CONTENT_ITEMS'
})(RichSubMessageType || (RichSubMessageType = {}))

const tokenizeCode = (codeStr, language = 'javascript') => {
	const keywords = LANGUAGE_KEYWORDS[language] || JS_KEYWORDS
	const blocks = []
	const lines = codeStr.split('\n')
	for (let li = 0; li < lines.length; li++) {
		const line = lines[li]
		const isLast = li === lines.length - 1
		const nl = isLast ? '' : '\n'
		if (!line.trim()) {
			blocks.push({
				highlightType: CodeHighlightType.DEFAULT,
				codeContent: line + nl
			})
			continue
		}
		if (line.trim().startsWith('//') || line.trim().startsWith('#')) {
			blocks.push({
				highlightType: CodeHighlightType.COMMENT,
				codeContent: line + nl
			})
			continue
		}
		const regex =
			/(\/\/.*$|#.*$)|(["'`](?:[^"'`\\]|\\.)*["'`])|(\b\d+(?:\.\d+)?\b)|(\b[a-zA-Z_$][\w$]*\b)|([^\s\w$"'`]+)|(\s+)/g
		let match
		const tokens = []
		while ((match = regex.exec(line)) !== null) {
			const val = match[0]
			if (match[1]) {
				tokens.push({
					highlightType: CodeHighlightType.COMMENT,
					codeContent: val
				})
			} else if (match[2]) {
				tokens.push({
					highlightType: CodeHighlightType.STRING,
					codeContent: val
				})
			} else if (match[3]) {
				tokens.push({
					highlightType: CodeHighlightType.NUMBER,
					codeContent: val
				})
			} else if (match[4]) {
				if (keywords.has(val)) {
					tokens.push({
						highlightType: CodeHighlightType.KEYWORD,
						codeContent: val
					})
				} else {
					const after = line.slice(regex.lastIndex).trimStart()
					if (after.startsWith('(')) {
						tokens.push({
							highlightType: CodeHighlightType.METHOD,
							codeContent: val
						})
					} else {
						tokens.push({
							highlightType: CodeHighlightType.DEFAULT,
							codeContent: val
						})
					}
				}
			} else {
				tokens.push({
					highlightType: CodeHighlightType.DEFAULT,
					codeContent: val
				})
			}
		}
		if (tokens.length === 0) {
			blocks.push({
				highlightType: CodeHighlightType.DEFAULT,
				codeContent: line + nl
			})
			continue
		}
		const merged = []
		for (const t of tokens) {
			const prev = merged.length > 0 ? merged[merged.length - 1] : undefined
			if (prev && prev.highlightType === t.highlightType) {
				prev.codeContent += t.codeContent
			} else {
				merged.push({ ...t })
			}
		}
		if (merged.length > 0) {
			merged[merged.length - 1].codeContent += nl
		}
		blocks.push(...merged)
	}
	return blocks
}

const buildRichContextInfo = (quoted, options) => {
	const ctxInfo = {
		forwardingScore: 1,
		isForwarded: true,
		forwardedAiBotMessageInfo: { botJid: options.botJid ? options.botJid : '867051314767696@bot' },
		forwardOrigin: 4,
		...(options.mentions ? { mentionedJid: options.mentions } : {})
	}
	if (quoted?.key) {
		ctxInfo.stanzaId = quoted.key.id
		ctxInfo.participant = quoted.key.participant || quoted.sender || quoted.key.remoteJid
		ctxInfo.quotedMessage = quoted.message
	}
	return ctxInfo
}

const buildBotForwardedMessage = (submessages, contextInfo, unifiedResponse) => {
	const richResponse = {
		messageType: 1,
		submessages,
		contextInfo
	}
	if (unifiedResponse) {
		richResponse.unifiedResponse = unifiedResponse
	}
	return {
		botForwardedMessage: {
			message: {
				richResponseMessage: richResponse
			}
		}
	}
}

const generateTableContent = (title, headers, rows, quoted, options = {}) => {
	const { footer, headerText } = options
	const tableRows = [{ items: headers, isHeading: true }, ...rows.map(row => ({ items: row.map(String) }))]
	const submessages = []
	if (headerText) {
		submessages.push({ messageType: 2, messageText: headerText })
	}
	submessages.push({
		messageType: 4,
		tableMetadata: { title, rows: tableRows }
	})
	if (footer) {
		submessages.push({ messageType: 2, messageText: footer })
	}
	const ctxInfo = buildRichContextInfo(quoted)
	return {
		message: buildBotForwardedMessage(submessages, ctxInfo),
		messageId: generateMessageIDV2()
	}
}

const generateListContent = (title, items, quoted, options = {}) => {
	const { footer, headerText } = options
	const tableRows = items.map(item => ({
		items: Array.isArray(item) ? item.map(String) : [String(item)]
	}))
	const submessages = []
	if (headerText) {
		submessages.push({ messageType: 2, messageText: headerText })
	}
	submessages.push({
		messageType: 4,
		tableMetadata: { title, rows: tableRows }
	})
	if (footer) {
		submessages.push({ messageType: 2, messageText: footer })
	}
	const ctxInfo = buildRichContextInfo(quoted)
	return {
		message: buildBotForwardedMessage(submessages, ctxInfo),
		messageId: generateMessageIDV2()
	}
}

const generateCodeBlockContent = (code, quoted, options = {}) => {
	const { title, footer, language = 'javascript' } = options
	const submessages = []
	if (title) {
		submessages.push({ messageType: 2, messageText: title })
	}
	submessages.push({
		messageType: 5,
		codeMetadata: {
			codeLanguage: language,
			codeBlocks: tokenizeCode(code, language)
		}
	})
	if (footer) {
		submessages.push({ messageType: 2, messageText: footer })
	}
	const ctxInfo = buildRichContextInfo(quoted)
	return {
		message: buildBotForwardedMessage(submessages, ctxInfo),
		messageId: generateMessageIDV2()
	}
}

const generateLatexContent = (quoted, options) => {
	const { text, expressions, headerText, footer } = options
	const submessages = []
	if (headerText) {
		submessages.push({ messageType: 2, messageText: headerText })
	}
	const latexExpressions = expressions.map(expr => {
		const entry = {
			latexExpression: expr.latexExpression,
			url: expr.url,
			width: expr.width,
			height: expr.height
		}
		if (expr.fontHeight !== undefined) entry.fontHeight = expr.fontHeight
		if (expr.imageTopPadding !== undefined) entry.imageTopPadding = expr.imageTopPadding
		if (expr.imageLeadingPadding !== undefined) entry.imageLeadingPadding = expr.imageLeadingPadding
		if (expr.imageBottomPadding !== undefined) entry.imageBottomPadding = expr.imageBottomPadding
		if (expr.imageTrailingPadding !== undefined) entry.imageTrailingPadding = expr.imageTrailingPadding
		return entry
	})
	submessages.push({
		messageType: 8,
		latexMetadata: {
			text: text || '',
			expressions: latexExpressions
		}
	})
	if (footer) {
		submessages.push({ messageType: 2, messageText: footer })
	}
	const ctxInfo = buildRichContextInfo(quoted)
	return {
		message: buildBotForwardedMessage(submessages, ctxInfo),
		messageId: generateMessageIDV2()
	}
}

const generateLatexImageContent = async (quoted, options, uploadFn, renderLatexToPng) => {
	const { text, expressions, headerText, footer } = options
	const submessages = []
	if (headerText) {
		submessages.push({ messageType: 2, messageText: headerText })
	}
	const latexExpressions = await Promise.all(
		expressions.map(async expr => {
			const { buffer, width, height } = await renderLatexToPng(expr.latexExpression)
			const uploadResult = await uploadFn(buffer, 'image')
			const imageUrl = uploadResult.url || uploadResult.directPath
			return {
				latexExpression: expr.latexExpression,
				url: imageUrl,
				width,
				height
			}
		})
	)
	submessages.push({
		messageType: 8,
		latexMetadata: {
			text: text || '',
			expressions: latexExpressions
		}
	})
	if (footer) {
		submessages.push({ messageType: 2, messageText: footer })
	}
	const ctxInfo = buildRichContextInfo(quoted)
	return {
		message: buildBotForwardedMessage(submessages, ctxInfo),
		messageId: generateMessageIDV2()
	}
}

const generateLatexInlineImageContent = async (quoted, options, uploadFn, renderLatexToPng) => {
	const { text, expressions, headerText, footer } = options
	const submessages = []
	if (headerText) {
		submessages.push({ messageType: 2, messageText: headerText })
	}
	if (text) {
		submessages.push({ messageType: 2, messageText: text })
	}
	for (const expr of expressions) {
		const { buffer, width, height } = await renderLatexToPng(expr.latexExpression)
		const uploadResult = await uploadFn(buffer, 'image')
		const imageUrl = uploadResult.url || uploadResult.directPath
		submessages.push({
			messageType: 3,
			imageMetadata: {
				imageUrl: {
					imagePreviewUrl: imageUrl,
					imageHighResUrl: imageUrl
				},
				imageText: expr.latexExpression,
				alignment: 2
			}
		})
	}
	if (footer) {
		submessages.push({ messageType: 2, messageText: footer })
	}
	const ctxInfo = buildRichContextInfo(quoted)
	return {
		message: buildBotForwardedMessage(submessages, ctxInfo),
		messageId: generateMessageIDV2()
	}
}

const captureUnifiedResponse = msg => {
	const botFwd = msg?.botForwardedMessage?.message
	if (!botFwd) return null
	const rich = botFwd.richResponseMessage
	if (!rich?.unifiedResponse?.data) return null
	return {
		unifiedResponse: { data: rich.unifiedResponse.data },
		submessages: rich.submessages || [],
		contextInfo: rich.contextInfo || {}
	}
}

const generateUnifiedResponseContent = (quoted, captured) => {
	const ctxInfo = buildRichContextInfo(quoted)
	return {
		message: buildBotForwardedMessage(captured.submessages, ctxInfo, captured.unifiedResponse),
		messageId: generateMessageIDV2()
	}
}

const generateRichMessageContent = (submessages, quoted, options) => {
	const ctxInfo = buildRichContextInfo(quoted, options)
	return {
		message: buildBotForwardedMessage(submessages, ctxInfo),
		messageId: generateMessageIDV2()
	}
}

module.exports = {
	JS_KEYWORDS,
	PYTHON_KEYWORDS,
	LANGUAGE_KEYWORDS,
	CodeHighlightType,
	RichSubMessageType,
	tokenizeCode,
	buildRichContextInfo,
	buildBotForwardedMessage,
	generateTableContent,
	generateListContent,
	generateCodeBlockContent,
	generateLatexContent,
	generateLatexImageContent,
	generateLatexInlineImageContent,
	captureUnifiedResponse,
	generateUnifiedResponseContent,
	generateRichMessageContent
}
