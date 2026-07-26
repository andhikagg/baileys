'use strict'
Object.defineProperty(exports, '__esModule', { value: true })
exports.handleIdentityChange = handleIdentityChange
const WABinary_1 = require('../WABinary')
const generics_1 = require('./generics')
async function handleIdentityChange(node, ctx) {
	const from = node.attrs.from
	if (!from) {
		return { action: 'invalid_notification' }
	}
	const identityNode = (0, WABinary_1.getBinaryNodeChild)(node, 'identity')
	if (!identityNode) {
		return { action: 'no_identity_node' }
	}
	ctx.logger.info({ jid: from }, 'identity changed')
	const decoded = (0, WABinary_1.jidDecode)(from)
	if (decoded?.device && decoded.device !== 0) {
		ctx.logger.debug({ jid: from, device: decoded.device }, 'ignoring identity change from companion device')
		return { action: 'skipped_companion_device', device: decoded.device }
	}
	const isSelfPrimary =
		ctx.meId &&
		((0, WABinary_1.areJidsSameUser)(from, ctx.meId) || (ctx.meLid && (0, WABinary_1.areJidsSameUser)(from, ctx.meLid)))
	if (isSelfPrimary) {
		ctx.logger.info({ jid: from }, 'self primary identity changed')
		return { action: 'skipped_self_primary' }
	}
	if (ctx.debounceCache.get(from)) {
		ctx.logger.debug({ jid: from }, 'skipping identity assert (debounced)')
		return { action: 'debounced' }
	}
	ctx.debounceCache.set(from, true)
	const isOfflineNotification = !(0, generics_1.isStringNullOrEmpty)(node.attrs.offline)
	const hasExistingSession = await ctx.validateSession(from)
	if (!hasExistingSession.exists) {
		ctx.logger.debug({ jid: from }, 'no old session, skipping session refresh')
		return { action: 'skipped_no_session' }
	}
	ctx.logger.debug({ jid: from }, 'old session exists, will refresh session')
	if (isOfflineNotification) {
		ctx.logger.debug({ jid: from }, 'skipping session refresh during offline processing')
		return { action: 'skipped_offline' }
	}
	ctx.onBeforeSessionRefresh?.(from)
	try {
		await ctx.assertSessions([from], true)
		return { action: 'session_refreshed' }
	} catch (error) {
		ctx.logger.warn({ error, jid: from }, 'failed to assert sessions after identity change')
		return { action: 'session_refresh_failed', error }
	}
}
