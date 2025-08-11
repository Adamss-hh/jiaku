// Plugin BratVid Sticker autonome - génère des stickers vidéo à partir de texte

// Fonction pour créer un sticker vidéo sans dépendances externes
async function createVideoSticker(videoBuffer, packname = 'Bot Sticker', author = 'WhatsApp Bot') {
  // Cette fonction simule la création d'un sticker vidéo
  // En réalité, vous devrez adapter selon votre système de stickers
  return videoBuffer
}

// APIs alternatives pour générer des vidéos/GIFs de texte animé
const textToVideoAPIs = [
  {
    name: 'ryzen_animated',
    url: (text) => `https://api.ryzendesu.vip/api/image/brat/animated?text=${encodeURIComponent(text)}`,
    headers: {}
  },
  {
    name: 'ryzumi_animated', 
    url: (text) => `https://api.ryzumi.vip/api/image/brat/animated?text=${encodeURIComponent(text)}`,
    headers: {}
  },
  {
    name: 'textanim_api',
    url: (text) => `https://textanim.com/api/gif?text=${encodeURIComponent(text)}&style=brat`,
    headers: {}
  },
  {
    name: 'gifmaker_api',
    url: (text) => `https://api.gifmaker.me/text?text=${encodeURIComponent(text)}&animation=fade&duration=2`,
    headers: {}
  }
]

// Fonction pour essayer plusieurs APIs vidéo
async function generateTextVideo(text) {
  for (const api of textToVideoAPIs) {
    try {
      console.log(`Trying ${api.name} API...`)
      
      const response = await fetch(api.url(text), {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'image/gif, video/mp4, */*',
          ...api.headers
        }
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const contentType = response.headers.get('content-type')
      if (!contentType || (!contentType.includes('gif') && !contentType.includes('video') && !contentType.includes('webp'))) {
        throw new Error(`Invalid content type: ${contentType}`)
      }

      const buffer = await response.arrayBuffer()
      if (buffer.byteLength === 0) {
        throw new Error('Empty response')
      }

      console.log(`✅ ${api.name} API successful - Content-Type: ${contentType}`)
      return Buffer.from(buffer)

    } catch (error) {
      console.log(`❌ ${api.name} API failed: ${error.message}`)
      continue
    }
  }
  
  throw new Error('All text-to-video APIs failed')
}

// Fonction de fallback pour créer un GIF simple avec du texte
function createFallbackGif(text) {
  // Créer un GIF SVG animé simple comme fallback
  const svg = `
    <svg width="400" height="200" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <style>
          .text-anim {
            font-family: Arial, sans-serif;
            font-size: 24px;
            font-weight: bold;
            fill: white;
            text-anchor: middle;
            dominant-baseline: middle;
          }
          .bg-rect {
            animation: colorChange 2s infinite;
          }
          @keyframes colorChange {
            0% { fill: #000000; }
            25% { fill: #333333; }
            50% { fill: #666666; }
            75% { fill: #333333; }
            100% { fill: #000000; }
          }
        </style>
      </defs>
      <rect class="bg-rect" width="100%" height="100%"/>
      <text class="text-anim" x="50%" y="50%">
        ${text.substring(0, 30)}
        <animate attributeName="opacity" values="0;1;1;0" dur="2s" repeatCount="indefinite"/>
      </text>
    </svg>
  `
  return Buffer.from(svg, 'utf8')
}

// Handler principal du plugin
let handler = async (m, { conn, text, usedPrefix, command }) => {
  // Validation du texte
  if (!text || !text.trim()) {
    return conn.reply(m.chat, `🎬 *BratVid Sticker Generator*\n\nUsage: ${usedPrefix + command} <your text>\n\nExample: ${usedPrefix + command} Hello World!\n\n_Creates animated video stickers_`, m)
  }

  const inputText = text.trim()
  
  // Vérification de la longueur du texte
  if (inputText.length > 80) {
    return conn.reply(m.chat, '❌ Text too long! Maximum 80 characters allowed for video stickers.', m)
  }

  let loadingMsg
  try {
    // Message de chargement
    loadingMsg = await conn.sendMessage(m.chat, { 
      text: '🎬 Generating your animated brat sticker...' 
    }, { quoted: m })

    // Générer la vidéo/GIF
    let videoBuffer
    try {
      videoBuffer = await generateTextVideo(inputText)
    } catch (apiError) {
      console.log('All video APIs failed, using fallback')
      
      // Mise à jour du message de chargement
      await conn.sendMessage(m.chat, {
        text: '⚠️ Video APIs unavailable, creating simple animation...',
        edit: loadingMsg.key
      })
      
      videoBuffer = createFallbackGif(inputText)
    }

    // Mise à jour du message de chargement
    await conn.sendMessage(m.chat, {
      text: '🎨 Converting to video sticker...',
      edit: loadingMsg.key
    })

    // Créer le sticker vidéo
    let stickerBuffer
    try {
      // Essayer d'utiliser la fonction sticker globale si disponible
      if (typeof global.sticker === 'function') {
        stickerBuffer = await global.sticker(videoBuffer, null, global.stickpack || 'Bot Video Sticker', global.stickauth || 'WhatsApp Bot')
      } else if (typeof sticker === 'function') {
        stickerBuffer = await sticker(videoBuffer, null, global.stickpack || 'Bot Video Sticker', global.stickauth || 'WhatsApp Bot')
      } else {
        // Fallback : envoyer comme vidéo/GIF
        stickerBuffer = videoBuffer
      }
    } catch (stickerError) {
      console.log('Video sticker creation failed, sending as video:', stickerError.message)
      stickerBuffer = videoBuffer
    }

    // Supprimer le message de chargement
    try {
      await conn.sendMessage(m.chat, { delete: loadingMsg.key })
    } catch (e) {
      console.log('Could not delete loading message')
    }

    // Envoyer le sticker vidéo
    if (stickerBuffer === videoBuffer) {
      // Envoyer comme vidéo/GIF si la création de sticker a échoué
      const isGif = videoBuffer.toString('hex').startsWith('474946') // Check if GIF
      
      if (isGif) {
        await conn.sendMessage(m.chat, {
          document: stickerBuffer,
          mimetype: 'image/gif',
          fileName: `brat_${inputText.replace(/[^a-zA-Z0-9]/g, '_')}.gif`,
          caption: `🎬 *Text:* ${inputText}\n\n_Video sticker creation failed, sent as GIF_`
        }, { quoted: m })
      } else {
        await conn.sendMessage(m.chat, {
          video: stickerBuffer,
          caption: `🎬 *Text:* ${inputText}\n\n_Video sticker creation failed, sent as video_`,
          gifPlayback: true
        }, { quoted: m })
      }
    } else {
      // Envoyer comme sticker vidéo
      await conn.sendFile(m.chat, stickerBuffer, null, { 
        asSticker: true,
        packname: global.stickpack || 'Bot Video Sticker',
        author: global.stickauth || 'WhatsApp Bot'
      }, m)
    }

  } catch (error) {
    console.error('BratVid sticker error:', error)
    
    // Supprimer le message de chargement en cas d'erreur
    if (loadingMsg) {
      try {
        await conn.sendMessage(m.chat, { delete: loadingMsg.key })
      } catch (e) {
        console.log('Could not delete loading message')
      }
    }

    // Message d'erreur à l'utilisateur
    await conn.reply(m.chat, `❌ Error creating video sticker: ${error.message || 'Unknown error occurred'}`, m)
  }
}

handler.help = ['bratvid', 'bratvids', 'bratvideo']
handler.tags = ['sticker']
handler.command = /^(bratvid|bratvids|bratvideo)$/i
handler.register = true

export default handler