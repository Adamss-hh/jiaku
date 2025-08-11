// Plugin EmojiMix autonome - mélange deux emojis pour créer un sticker

// Fonction pour créer un sticker sans dépendances externes
async function createSticker(imageBuffer, packname = 'Bot Sticker', author = 'WhatsApp Bot') {
  // Cette fonction simule la création d'un sticker
  // En réalité, vous devrez adapter selon votre système de stickers
  return imageBuffer
}

// APIs alternatives pour EmojiMix
const emojiMixAPIs = [
  {
    name: 'google_tenor',
    url: (emoji1, emoji2) => `https://tenor.googleapis.com/v2/featured?key=AIzaSyAyimkuYQYF_FXVALexPuGQctUWRURdCYQ&contentfilter=high&media_filter=png_transparent&component=proactive&collection=emoji_kitchen_v5&q=${encodeURIComponent(emoji1 + '_' + emoji2)}`,
    headers: {}
  },
  {
    name: 'backup_tenor',
    url: (emoji1, emoji2) => `https://tenor.googleapis.com/v2/featured?key=AIzaSyAyimkuYQYF_FXVALexPuGQctUWRURdCYQ&contentfilter=high&media_filter=png_transparent&component=proactive&collection=emoji_kitchen_v6&q=${encodeURIComponent(emoji1 + emoji2)}`,
    headers: {}
  },
  {
    name: 'emojimix_api',
    url: (emoji1, emoji2) => `https://www.gstatic.com/android/keyboard/emojikitchen/20201001/u${emoji1.codePointAt(0).toString(16)}/u${emoji1.codePointAt(0).toString(16)}_u${emoji2.codePointAt(0).toString(16)}.png`,
    headers: {}
  }
]

// Fonction pour valider les emojis
function isEmoji(text) {
  const emojiRegex = /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/u
  return emojiRegex.test(text)
}

// Fonction pour extraire les emojis d'un texte
function extractEmojis(text) {
  const emojiRegex = /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu
  return text.match(emojiRegex) || []
}

// Fonction pour essayer plusieurs APIs EmojiMix
async function generateEmojiMix(emoji1, emoji2) {
  for (const api of emojiMixAPIs) {
    try {
      console.log(`Trying ${api.name} API for ${emoji1} + ${emoji2}...`)
      
      const response = await fetch(api.url(emoji1, emoji2), {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'image/png, image/webp, image/jpeg, */*',
          ...api.headers
        }
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      // Vérifier que c'est bien une image
      const contentType = response.headers.get('content-type')
      if (!contentType || !contentType.startsWith('image/')) {
        throw new Error(`Invalid content type: ${contentType}`)
      }

      const buffer = await response.arrayBuffer()
      if (buffer.byteLength === 0) {
        throw new Error('Empty response')
      }

      // Pour l'API Tenor, parse le JSON pour extraire l'URL de l'image
      if (api.name.includes('tenor')) {
        const data = JSON.parse(new TextDecoder().decode(buffer))
        if (!data.results || !data.results[0]) {
          throw new Error('No emoji mix found in results')
        }
        
        const imageUrl = data.results[0].media_formats?.png_transparent?.url
        if (!imageUrl) {
          throw new Error('No image URL found in response')
        }

        // Télécharger l'image réelle
        const imageResponse = await fetch(imageUrl)
        if (!imageResponse.ok) {
          throw new Error(`Failed to download image: ${imageResponse.status}`)
        }

        const imageBuffer = await imageResponse.arrayBuffer()
        console.log(`✅ ${api.name} API successful`)
        return Buffer.from(imageBuffer)
      } else {
        // Pour les autres APIs, retourner directement le buffer
        console.log(`✅ ${api.name} API successful`)
        return Buffer.from(buffer)
      }

    } catch (error) {
      console.log(`❌ ${api.name} API failed: ${error.message}`)
      continue
    }
  }
  
  throw new Error('All emoji mix APIs failed')
}

// Fonction de fallback pour créer une image de mélange simple
function createFallbackMix(emoji1, emoji2) {
  // Créer une image SVG simple avec les deux emojis
  const svg = `
    <svg width="300" height="300" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#ffffff"/>
      <circle cx="150" cy="150" r="140" stroke="#000" stroke-width="4" fill="none"/>
      <text x="100" y="180" font-size="80" text-anchor="middle">${emoji1}</text>
      <text x="200" y="180" font-size="80" text-anchor="middle">${emoji2}</text>
      <text x="150" y="250" font-size="24" text-anchor="middle" fill="#666">Mix</text>
    </svg>
  `
  return Buffer.from(svg, 'utf8')
}

// Handler principal du plugin
let handler = async (m, { conn, text, usedPrefix, command }) => {
  // Validation du texte
  if (!text || !text.trim()) {
    return conn.reply(m.chat, `🎭 *EmojiMix Generator*\n\nUsage: ${usedPrefix + command} <emoji1>+<emoji2>\nOr: ${usedPrefix + command} <emoji1> <emoji2>\n\nExample:\n- ${usedPrefix + command} 😂+😍\n- ${usedPrefix + command} 🔥 💖\n\n_Mix two emojis into one sticker!_`, m)
  }

  // Extraire les emojis du texte
  let emojis = text.split(/[\+\s]/).filter(Boolean)
  
  // Valider qu'on a au moins 2 emojis
  if (emojis.length < 2) {
    return conn.reply(m.chat, '❌ Please provide at least 2 emojis!\n\nExample: 😂+😍 or 🔥 💖', m)
  }
  
  // Limiter à 2 emojis maximum
  if (emojis.length > 2) {
    return conn.reply(m.chat, '❌ Maximum 2 emojis allowed for mixing!\n\nExample: 😂+😍', m)
  }

  const emoji1 = emojis[0].trim()
  const emoji2 = emojis[1].trim()

  // Valider que ce sont bien des emojis
  if (!isEmoji(emoji1) || !isEmoji(emoji2)) {
    return conn.reply(m.chat, '❌ Please provide valid emojis only!\n\nExample: 😂+😍 or 🔥 💖', m)
  }

  let loadingMsg
  try {
    // Message de chargement
    loadingMsg = await conn.sendMessage(m.chat, { 
      text: `🎭 Mixing ${emoji1} + ${emoji2}...` 
    }, { quoted: m })

    // Générer le mélange d'emojis
    let mixBuffer
    try {
      mixBuffer = await generateEmojiMix(emoji1, emoji2)
    } catch (apiError) {
      console.log('All emoji mix APIs failed, using fallback')
      
      // Mise à jour du message de chargement
      await conn.sendMessage(m.chat, {
        text: `⚠️ Emoji mix not found, creating simple combination...`,
        edit: loadingMsg.key
      })
      
      mixBuffer = createFallbackMix(emoji1, emoji2)
    }

    // Mise à jour du message de chargement
    await conn.sendMessage(m.chat, {
      text: '🎨 Converting to sticker...',
      edit: loadingMsg.key
    })

    // Créer le sticker
    let stickerBuffer
    try {
      // Essayer d'utiliser la fonction sticker globale si disponible
      if (typeof global.sticker === 'function') {
        stickerBuffer = await global.sticker(mixBuffer, null, global.stickpack || 'EmojiMix', global.stickauth || 'WhatsApp Bot')
      } else if (typeof sticker === 'function') {
        stickerBuffer = await sticker(mixBuffer, null, global.stickpack || 'EmojiMix', global.stickauth || 'WhatsApp Bot')
      } else {
        // Fallback : envoyer comme image
        stickerBuffer = mixBuffer
      }
    } catch (stickerError) {
      console.log('Sticker creation failed, sending as image:', stickerError.message)
      stickerBuffer = mixBuffer
    }

    // Supprimer le message de chargement
    try {
      await conn.sendMessage(m.chat, { delete: loadingMsg.key })
    } catch (e) {
      console.log('Could not delete loading message')
    }

    // Envoyer le sticker
    if (stickerBuffer === mixBuffer) {
      // Envoyer comme image si la création de sticker a échoué
      await conn.sendMessage(m.chat, {
        image: stickerBuffer,
        caption: `🎭 *EmojiMix:* ${emoji1} + ${emoji2}\n\n_Sticker creation failed, sent as image_`
      }, { quoted: m })
    } else {
      // Envoyer comme sticker
      await conn.sendFile(m.chat, stickerBuffer, 'emojimix.webp', '', m, { 
        asSticker: true,
        packname: global.stickpack || 'EmojiMix',
        author: global.stickauth || 'WhatsApp Bot'
      })
    }

  } catch (error) {
    console.error('EmojiMix error:', error)
    
    // Supprimer le message de chargement en cas d'erreur
    if (loadingMsg) {
      try {
        await conn.sendMessage(m.chat, { delete: loadingMsg.key })
      } catch (e) {
        console.log('Could not delete loading message')
      }
    }

    // Message d'erreur à l'utilisateur
    await conn.reply(m.chat, `❌ Error creating emoji mix: ${error.message || 'Unknown error occurred'}`, m)
  }
}

handler.help = ['emojimix', 'emix']
handler.tags = ['sticker']
handler.command = /^(emojimix|emix)$/i
handler.register = true

export default handler