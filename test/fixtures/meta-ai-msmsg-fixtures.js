'use strict'

const BOT_JID = '867051314767696@bot'
const ME_LID = '48615137533978:47@lid'
const ME_JID = '48615137533978@lid'

const baseSecret = hex => Buffer.from(hex, 'hex')

exports.privateChatFixture = {
  messageSecret: baseSecret('832964e6df408de461d91ce9628063fa0af5766763c67061d41c5f02f551ca2a'),
  messageKey: {
    participant: BOT_JID,
    meId: ME_JID,
    meLid: ME_LID,
    conversationJid: BOT_JID,
    senderJid: null,
    botType: 'last',
    botEditTargetId: 'B26CEF28976F53295B83110C75E985EA',
    metaTargetId: 'ACFB86505734C005E4F91931B484D31F',
    stanzaId: 'D9AB3474A7795A206DF649739B098291',
    targetId: 'B26CEF28976F53295B83110C75E985EA',
    targetIdCandidates: [
      'B26CEF28976F53295B83110C75E985EA',
      'ACFB86505734C005E4F91931B484D31F',
      'D9AB3474A7795A206DF649739B098291',
    ],
  },
}

exports.normalGroupFixture = {
  messageSecret: baseSecret('15c8cbf91545aaabfec0a2dbe1a8a2fbe2cb8b6613f110ba7d5b0dcb0eb6ca46'),
  messageKey: {
    participant: BOT_JID,
    meId: ME_JID,
    meLid: ME_LID,
    conversationJid: '120363403392621269@g.us',
    senderJid: ME_JID,
    botType: 'last',
    botEditTargetId: 'CCBC4F84CCE819308E082F6F79D0E4EF',
    metaTargetId: 'AC88168FB3A553110F685B4C3D123854',
    stanzaId: '1CD17D29E286A1520D7F9FC748627F6F',
    targetId: 'CCBC4F84CCE819308E082F6F79D0E4EF',
    targetIdCandidates: [
      'CCBC4F84CCE819308E082F6F79D0E4EF',
      'AC88168FB3A553110F685B4C3D123854',
      '1CD17D29E286A1520D7F9FC748627F6F',
    ],
  },
}

exports.metaAiGroupFixture = {
  messageSecret: baseSecret('a50ef54d939f525265d237274b7a01ca8dabfc5a0b5cdb7684346a2b71d7bc3f'),
  messageKey: {
    participant: BOT_JID,
    meId: ME_JID,
    meLid: ME_LID,
    conversationJid: '120363426873478539@g.us',
    senderJid: ME_JID,
    botType: 'full',
    botEditTargetId: '',
    metaTargetId: 'ACCD5293923C864D52BE2DCF3D5B5095',
    stanzaId: '1C2E557DD0E68E6AFD6DBD10F3D225E4',
    targetId: 'ACCD5293923C864D52BE2DCF3D5B5095',
    targetIdCandidates: [
      'ACCD5293923C864D52BE2DCF3D5B5095',
      '1C2E557DD0E68E6AFD6DBD10F3D225E4',
    ],
  },
}
