# HTTPS GraphQL — Meta AI, Events, Payments, and More

Baron-Baileys-v2 also supports WhatsApp's three HTTPS GraphQL schemas, which power features like Meta AI, Imagine, Events, payments, and business tools. Unlike MEX (which runs over WebSocket), these go out over HTTPS POST requests.

## What is HTTPS GraphQL?

WhatsApp uses three separate HTTPS GraphQL endpoints for features that require Facebook's infrastructure or commerce backends:

| Schema     | Endpoint                                      | Used For                                          |
| ---------- | --------------------------------------------- | ------------------------------------------------- |
| `www`      | `https://graph.whatsapp.com/graphql`          | Meta AI, Imagine, Events, Payments, most features |
| `facebook` | `https://acs.whatsapp.com/graphql`            | Business alerts, compliance, DCP products         |
| `wamo`     | `https://wamo.whatsapp.net/api/wamo/graphql/` | Wamo commerce platform                            |

## Authentication

### www and facebook schemas

Both require an ACS access token. Baileys fetches it automatically — your first API call triggers the exchange:

1. `wwwGetNonce()` fetches a one-time nonce over the WebSocket (MEX).
2. `wwwExchangeNonce(nonce)` exchanges it for an ACS access token.
3. The token is cached in memory for the rest of the session.

You don't need to do anything for this to work:

```js
// Token is fetched automatically on the first call
const memories = await sock.metaAiMemoryQuery()
```

To reuse a token from a previous session (skips the nonce round-trip):

```js
sock.setAccessToken('WA|xxxxxxxx|...')
```

To pre-fetch before making any calls:

```js
await sock.acquireAccessToken()
```

The token format is `WA|<app_id>|<data>` — store it as-is if you want to reuse it across reconnects.

### wamo schema

Wamo uses separate credentials, not the ACS token. Set them before calling any `wamo*` method:

```js
sock.setWamoAuth({
	accessToken: 'WA|...',
	credential: '...',
	userId: '123456789'
})
```

## Usage Examples

```js
import makeWASocket from 'baron-baileys-v2'
const sock = makeWASocket({ auth: state })

// ── Meta AI ───────────────────────────────────────────────────────────────

// Check your AI memory opt-out status
const status = await sock.metaAiMemoryOptOutStatus()

// Delete all Meta AI memories
await sock.metaAiMemoryDeleteAll()

// Get AI voice options
const voices = await sock.metaAiVoiceOptionsFetch()

// ── Imagine / Image Generation ────────────────────────────────────────────

// Generate an animated image
const result = await sock.imagineGenerateAnimate(imageId)

// Check if you're onboarded to Imagine Me
const onboarded = await sock.imagineMeIsOnboarded()

// ── Events ────────────────────────────────────────────────────────────────

// Create an event
const event = await sock.createEvent({
	title: 'Team Meeting',
	start_time: Math.floor(Date.now() / 1000) + 3600,
	description: 'Weekly sync'
})

// List your events
const events = await sock.listEvents()

// Update RSVP for an event
await sock.updateEventRsvp(eventId, 'GOING')

// ── Payments (Brazil) ─────────────────────────────────────────────────────

// Get PIX bank list
const banks = await sock.getPixBankList()

// Check payment eligibility
const eligibility = await sock.getEligibility()

// ── Business ─────────────────────────────────────────────────────────────

// Get business interaction pills for a chat
const pills = await sock.businessInteractionPills(bizJid)

// Facebook schema (different endpoint, same usage):
const alerts = await sock.bizAlertsNotificationList()
await sock.bizAlertsUpdate(alertId, true)
```

## Wamo Commerce

Wamo is WhatsApp's commerce platform for paid newsletters and subscriptions. Set up auth first (see Authentication above), then call Wamo methods:

```js
const userInfo = await sock.wamoUserBasic()
const subStatus = await sock.wamoSubQueryStatus(newsletterJid)
```

## All Available Methods

### Meta AI

| Method                                 | What it does                    |
| -------------------------------------- | ------------------------------- |
| `metaAiMemoryQuery()`                  | Get your stored AI memories     |
| `metaAiMemoryDelete(id)`               | Delete one memory               |
| `metaAiMemoryDeleteAll()`              | Clear all memories              |
| `metaAiUnifiedMemoryQuery()`           | Unified AI + AI Studio memories |
| `metaAiMemoryOptOutStatus()`           | Check memory opt-out status     |
| `metaAiMemoryOptOutUpdate(optOut)`     | Enable/disable memory storage   |
| `metaAiCommandGet(chatJid, command)`   | Get an AI command               |
| `metaAiVoiceOptionsFetch()`            | Available voice options         |
| `metaAiVoiceOptionsWithDefaultFetch()` | Voice options with default      |
| `aiStudioMemoryQuery()`                | AI Studio memories              |
| `aiStudioMemoryDelete(id)`             | Delete AI Studio memory         |
| `aiStudioMemoryDeleteAll()`            | Clear all AI Studio memories    |
| `aiSubscriptionState()`                | AI subscription status          |
| `aiSubscriptionUsageData()`            | AI usage data                   |
| `metaConfigFetch()`                    | Meta config                     |
| `metaPoiTypeAhead(query)`              | Place/POI search                |

### AI Creation (Bot Personas)

| Method                                             | What it does                      |
| -------------------------------------------------- | --------------------------------- |
| `aiCreationFetchCreatedBot(botId)`                 | Fetch a bot persona               |
| `aiCreationUpdatePersona(botId, updates)`          | Update persona                    |
| `aiCreationDeletePersona(botId)`                   | Delete persona                    |
| `aiCreationUploadImage(imageData)`                 | Upload persona image              |
| `aiCreationCheckCreatedByMe(botId)`                | Check ownership                   |
| `aiCreationFetchVoiceSample(voiceId)`              | Fetch voice sample                |
| `aiHomeFetchUserCreatedPersonas()`                 | Your created personas             |
| `aiHomeSearch(query)`                              | Search AI home                    |
| `aiCharacterUpdateHideStatus(botId, hidden)`       | Show/hide character               |
| `botProactiveMessageControlStatus(botId)`          | Proactive message status          |
| `botProactiveMessageControlUpdate(botId, enabled)` | Enable/disable proactive messages |
| `botProfilesSync()`                                | Sync bot profiles                 |

### Imagine / Image Generation

| Method                                      | What it does                  |
| ------------------------------------------- | ----------------------------- |
| `imagineEdit(imageId, prompt)`              | Edit an image with a prompt   |
| `imagineEditVideo(videoId, styleId)`        | Edit a video                  |
| `imagineExpand(imageId, direction)`         | Expand an image               |
| `imagineGenerateAnimate(imageId, options?)` | Animate an image              |
| `imagineIntents(prompt)`                    | Get intents for a prompt      |
| `imagineCanvasContent(canvasId)`            | Get canvas content            |
| `imagineSpotlight(prompt, options?)`        | Spotlight generation          |
| `imagineVideoStatus(jobId)`                 | Check video generation status |
| `imagineReport(imageId, reason)`            | Report generated content      |
| `imagineMeIsOnboarded()`                    | Check Imagine Me status       |
| `imagineMeOnboarding(input)`                | Start Imagine Me onboarding   |
| `imagineMeOnboardingWithValidation(input)`  | Onboarding with validation    |
| `imagineMeDeleteOnboarding()`               | Reset Imagine Me              |
| `imagineEditVideoStyles()`                  | Available video styles        |

### Avatar

| Method                             | What it does             |
| ---------------------------------- | ------------------------ |
| `avatarUserRecovery()`             | Recover avatar           |
| `loadAvatarPoses()`                | Load available poses     |
| `saveAvatarPose(poseId, options?)` | Save a pose              |
| `selectedOrDefaultPose()`          | Get current/default pose |

### Events

| Method                                  | What it does           |
| --------------------------------------- | ---------------------- |
| `createEvent(input)`                    | Create a new event     |
| `getEvent(eventId)`                     | Get event details      |
| `updateEvent(eventId, updates)`         | Update event           |
| `deleteEvent(eventId)`                  | Delete event           |
| `listEvents(options?)`                  | List your events       |
| `updateEventRsvp(eventId, rsvp)`        | Set your RSVP          |
| `addEventInvitations(eventId, jids)`    | Invite participants    |
| `removeEventInvitations(eventId, jids)` | Remove invitations     |
| `removeSelfEventInvitation(eventId)`    | Decline invitation     |
| `getOrCreateEventInviteLink(eventId)`   | Get invite link        |
| `rotateEventInviteLink(eventId)`        | Rotate invite link     |
| `getEventLinkPreview(url)`              | Get link preview       |
| `listPresetCoverImages()`               | Available cover images |

### Payments — Brazil PIX

| Method                                    | What it does               |
| ----------------------------------------- | -------------------------- |
| `brGetAuthOptions()`                      | Get biometric auth options |
| `brSaveCpf(cpf)`                          | Save CPF                   |
| `brCreateEnrollment(options)`             | Create PIX enrollment      |
| `brCompleteEnrollmentRegistration(input)` | Complete enrollment        |
| `brGetEnrollmentOptions()`                | Get enrollment options     |
| `brAuthorizePayment(input)`               | Authorize payment          |
| `getPixBankList()`                        | List PIX banks             |
| `getMerchantPixInfo(merchantId)`          | Merchant info              |
| `completePixTransaction(input)`           | Complete transaction       |
| `payWithPixPrecheck(input)`               | Payment pre-check          |
| `paymentHealthChecks()`                   | System health check        |
| `getPaymentKey()`                         | Get payment key            |
| `genCreatePaymentKey(input)`              | Create payment key         |
| `genUpdatePaymentKey(input)`              | Update payment key         |
| `genDeletePaymentKey(keyId)`              | Delete payment key         |
| `getBillerPlans(billerId)`                | Get biller plans           |
| `getBillReceipt(billId)`                  | Get receipt                |
| `getBillComplaintUrl(billId)`             | Complaint URL              |
| `paymentReminderCreate(input)`            | Create reminder            |
| `paymentReminderGet(reminderId)`          | Get reminder               |
| `paymentReminderCancel(reminderId)`       | Cancel reminder            |
| `paymentReminderStop(reminderId)`         | Stop reminder              |
| `genShareRemittanceIntent(input)`         | Share remittance           |
| `getRemittanceTransactionDetails(txId)`   | Transaction details        |
| `getEligibility(feature?)`                | Check eligibility          |
| `pmtaGetAiControls()`                     | PMTA AI controls           |
| `pmtaSetAiControls(controls)`             | Set AI controls            |

### Payments — UPI India

| Method                         | What it does         |
| ------------------------------ | -------------------- |
| `getUpiAccounts()`             | List UPI accounts    |
| `getUpiLiteDetails()`          | UPI Lite details     |
| `getUpiToken(upiAccountId)`    | Get UPI token        |
| `getUpiPurposeLimitingKey()`   | Purpose limiting key |
| `upiCreateMandate(input)`      | Create mandate       |
| `upiAcceptMandate(mandateId)`  | Accept mandate       |
| `upiRejectMandate(mandateId)`  | Reject mandate       |
| `upiExecuteMandate(mandateId)` | Execute mandate      |
| `upiPauseMandate(mandateId)`   | Pause mandate        |
| `upiResumeMandate(mandateId)`  | Resume mandate       |
| `upiRevokeMandate(mandateId)`  | Revoke mandate       |

### Business / Catalog

| Method                                            | What it does        |
| ------------------------------------------------- | ------------------- |
| `getBusinessProfileWebsiteShimUrl(bizJid)`        | Website shim URL    |
| `waWebBizCreateOrderJob(input)`                   | Create order job    |
| `waWebBizGraphqlRefreshCart(cartId)`              | Refresh cart        |
| `waWebBizQueryOrderJob(jobId)`                    | Query order job     |
| `whatsappCatalogReportProduct(productId, reason)` | Report product      |
| `brandIdsGetPhoneNumbers(brandId)`                | Brand phone numbers |
| `businessInteractionPills(bizJid)`                | Interaction pills   |
| `externalCtxAuthoriseWAChat(input)`               | Authorize WA chat   |

### Wamo Commerce (via www endpoint)

| Method                                                     | What it does          |
| ---------------------------------------------------------- | --------------------- |
| `wamoSubQueryStatus(newsletterJid)`                        | Subscription status   |
| `wamoSubCancelSubscription(newsletterJid, subscriptionId)` | Cancel subscription   |
| `wamoSubOverrideStatus(newsletterJid, status)`             | Override status       |
| `wamoAfsSubscriptionInfo(newsletterJid)`                   | AFS subscription info |
| `wamoPromoIdQuery(newsletterJid)`                          | Get promo ID          |
| `wamoPromoIdSet(newsletterJid, promoId)`                   | Set promo ID          |
| `wamoPromoIdDelete(newsletterJid)`                         | Delete promo ID       |

### User / Account

| Method                                        | What it does              |
| --------------------------------------------- | ------------------------- |
| `facebookAccountName()`                       | Facebook account name     |
| `instagramAccountName()`                      | Instagram account name    |
| `getSignupMetadata()`                         | Signup metadata           |
| `registerInit(input)`                         | Start registration        |
| `registerAllAccounts()`                       | Register all accounts     |
| `checkDeviceRegistration(deviceId)`           | Check device registration |
| `canonicalEntQueryFeature(feature)`           | Query feature             |
| `canonicalEntSetupFeature(feature, options?)` | Setup feature             |
| `canonicalEntTeardownFeature(feature)`        | Teardown feature          |
| `wwwCanonicalUserValid(token)`                | Validate canonical user   |
| `waffleUserAgeCheck()`                        | Age check                 |
| `getAiPredictedAge()`                         | AI age prediction         |

### Support / Misc

| Method                                          | What it does            |
| ----------------------------------------------- | ----------------------- |
| `submitBugReport(input)`                        | Submit bug report       |
| `supportContactForm(input)`                     | Contact support         |
| `createGroupSuspensionAppeal(groupJid, reason)` | Appeal group suspension |
| `hatchChannelLink(input)`                       | Hatch channel link      |
| `hatchChannelMetadata(channelId)`               | Hatch channel metadata  |
| `oxygenChannelOptIn(channelId)`                 | Opt in to channel       |
| `oxygenChannelOptOut(channelId)`                | Opt out of channel      |
| `oxygenChannelStatus(channelId)`                | Channel status          |
| `paslGetLoggerConfig()`                         | Logger config           |
| `quickPromotionBatchFetch(input)`               | Quick promotion batch   |
| `waSupportMessageFeedback(input)`               | Message feedback        |
| `unifiedConversationStarters(chatJid)`          | Conversation starters   |
| `editGenAiTask(taskId, updates)`                | Edit GenAI task         |
| `deleteGenAiTasks(taskIds)`                     | Delete GenAI tasks      |
| `deleteUserBillAccount()`                       | Delete bill account     |

### Facebook Schema (acs.whatsapp.com)

| Method                                    | What it does             |
| ----------------------------------------- | ------------------------ |
| `bizAlertsNotificationList()`             | Business alerts          |
| `bizAlertsUpdate(alertId, read)`          | Mark alert as read       |
| `ctwaAdsContextBiz(bizJid)`               | CTWA ads context         |
| `digitalContentIapPurchaseQuote(input)`   | IAP purchase quote       |
| `getCompliance()`                         | Compliance status        |
| `setCompliance(complianceType, accepted)` | Set compliance           |
| `getCustomUrls()`                         | Custom URLs              |
| `getDcpProducts(categoryId?)`             | DCP products             |
| `acDcCreateCommerceNonce(input)`          | Create commerce nonce    |
| `fbUsernameRecommendations(source?)`      | Username recommendations |

### Wamo Platform Schema (wamo.whatsapp.net)

| Method                                   | What it does         |
| ---------------------------------------- | -------------------- |
| `wamoUserBasic()`                        | Basic user info      |
| `wamoCreateUser(input)`                  | Create Wamo user     |
| `wamoDeleteUser()`                       | Delete Wamo user     |
| `wamoLinkUser(input)`                    | Link user            |
| `wamoHeartbeat()`                        | Heartbeat            |
| `wamoHidePage(pageId)`                   | Hide page            |
| `wamoUnhidePage(pageId)`                 | Unhide page          |
| `wamoUnhidePageV2(pageId)`               | Unhide page v2       |
| `wamoHidePromo(promoId)`                 | Hide promotion       |
| `wamoReportPromo(promoId, reason)`       | Report promotion     |
| `wamoStartViewerSession(pageId)`         | Start viewer session |
| `wamoBloksGetLayout(layoutId, context?)` | Get Bloks layout     |
| `wamoDyiJobCreate(input)`                | Create DYI job       |
| `wamoDyiJobDelete(jobId)`                | Delete DYI job       |
| `wamoDyiJobStatus(jobId)`                | DYI job status       |

## Coverage

| Schema                      | Operations | Status                         |
| --------------------------- | ---------- | ------------------------------ |
| www (graph.whatsapp.com)    | 150/150    | ✓                              |
| facebook (acs.whatsapp.com) | 10/10      | ✓                              |
| wamo (wamo.whatsapp.net)    | 15/15      | ✓                              |
| client-persist (IDs only)   | 48/48      | IDs exported, no named methods |

IDs verified against APK asset files from WhatsApp.
