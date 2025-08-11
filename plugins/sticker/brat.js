// Plugin Brat Sticker autonome - génère des stickers à partir de texte

// Fonction pour créer un sticker simple sans dépendances externes
async function createSticker(imageBuffer, packname = '𝗛𝗜𝗦𝗢𝗞𝗔-𝗠𝗗', author = '𝗛𝗜𝗦𝗢𝗞𝗔-𝗠𝗗') {
  // Cette fonction simule la création d'un sticker
  // En réalité, vous devrez adapter selon votre système de stickers
  return imageBuffer
}

// APIs alternatives pour générer des images de texte
const textToImageAPIs = [
  {
    name: 'api1',
    url: (text) => `https://api.ryzumi.vip/api/image/brat?text=${encodeURIComponent(text)}`,
    headers: {}
  },
  {
    name: 'api2', 
    url: (text) => `https://textoverimage.moesif.com/image?text=${encodeURIComponent(text)}&width=500&height=200&fontSize=40&fontColor=white&backgroundColor=black`,
    headers: {}
  },
  {
    name: 'api3',
    url: (text) => `https://dummyimage.com/500x200/000/fff.png&text=${encodeURIComponent(text)}`,
    headers: {}
  }
]

// Fonction pour essayer plusieurs APIs
async function generateTextImage(text) {
  for (const api of textToImageAPIs) {
    try {
      console.log(`Trying ${api.name} API...`)
      
      const response = await fetch(api.url(text), {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          ...api.headers
        }
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const contentType = response.headers.get('content-type')
      if (!contentType || !contentType.startsWith('image/')) {
        throw new Error('Response is not an image')
      }

      const buffer = await response.arrayBuffer()
      if (buffer.byteLength === 0) {
        throw new Error('Empty response')
      }

      console.log(`✅ ${api.name} API successful`)
      return Buffer.from(buffer)

    } catch (error) {
      console.log(`❌ ${api.name} API failed: ${error.message}`)
      continue
    }
  }
  
  throw new Error('All text-to-image APIs failed')
}

// Fonction de fallback pour créer une image simple
function createFallbackImage(text) {
  // Créer une image SVG simple comme fallback
  const svg = `
    <svg width="500" height="200" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#000000"/>
      <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" 
            fill="white" font-family="Arial, sans-serif" font-size="24" font-weight="bold">
        ${text.substring(0, 50)}
      </text>
    </svg>
  `
  return Buffer.from(svg, 'utf8')
}

// Handler principal du plugin
let handler = async (m, { conn, text, usedPrefix, command }) => {
  // Validation du texte
  if (!text || !text.trim()) {
    return conn.reply(m.chat, `📝 *Brat Sticker Generator*\n\nUsage: ${usedPrefix + command} <your text>\n\nExample: ${usedPrefix + command} Hello World!`, m)
  }

  const inputText = text.trim()
  
  // Vérification de la longueur du texte
  if (inputText.length > 100) {
    return conn.reply(m.chat, '❌ Text too long! Maximum 100 characters allowed.', m)
  }

  let loadingMsg
  try {
    // Message de chargement
    loadingMsg = await conn.sendMessage(m.chat, { 
      text: '⏳ Generating your brat sticker...' 
    }, { quoted: m })

    // Générer l'image
    let imageBuffer
    try {
      imageBuffer = await generateTextImage(inputText)
    } catch (apiError) {
      console.log('All APIs failed, using fallback image')
      imageBuffer = createFallbackImage(inputText)
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
        stickerBuffer = await global.sticker(imageBuffer, null, global.stickpack || 'Bot Sticker', global.stickauth || 'WhatsApp Bot')
      } else if (typeof sticker === 'function') {
        stickerBuffer = await sticker(imageBuffer, null, global.stickpack || 'Bot Sticker', global.stickauth || 'WhatsApp Bot')
      } else {
        // Fallback : envoyer comme image
        stickerBuffer = imageBuffer
      }
    } catch (stickerError) {
      console.log('Sticker creation failed, sending as image:', stickerError.message)
      stickerBuffer = imageBuffer
    }

    // Supprimer le message de chargement
    try {
      await conn.sendMessage(m.chat, { delete: loadingMsg.key })
    } catch (e) {
      console.log('Could not delete loading message')
    }

    // Envoyer le sticker
    if (stickerBuffer === imageBuffer) {
      // Envoyer comme image si la création de sticker a échoué
      await conn.sendMessage(m.chat, {
        image: stickerBuffer,
        caption: `📝 *Text:* ${inputText}\n\n_Sticker creation failed, sent as image_`
      }, { quoted: m })
    } else {
      // Envoyer comme sticker
      await conn.sendFile(m.chat, stickerBuffer, null, { 
        asSticker: true,
        packname: global.stickpack || 'Bot Sticker',
        author: global.stickauth || 'WhatsApp Bot'
      }, m)
    }

  } catch (error) {
    console.error('Brat sticker error:', error)
    
    // Supprimer le message de chargement en cas d'erreur
    if (loadingMsg) {
      try {
        await conn.sendMessage(m.chat, { delete: loadingMsg.key })
      } catch (e) {
        console.log('Could not delete loading message')
      }
    }

    // Message d'erreur à l'utilisateur
    await conn.reply(m.chat, `❌ Error generating sticker: ${error.message || 'Unknown error occurred'}`, m)
  }
}

handler.help = ['brat']
handler.tags = ['sticker']
handler.command = /^(brat)$/i
handler.register = true

export default handler