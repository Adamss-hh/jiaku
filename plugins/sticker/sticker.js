// Plugin Sticker simplifié - convertit images/vidéos en stickers
import { createStickerWithMetadata, detectFileType } from '../../lib/sticker_simple.js';

// Handler principal du plugin
var handler = async (m, { conn, args, usedPrefix, command }) => {
  let stiker = false
  let loadingMsg
  
  try {
    // Message de chargement
    loadingMsg = await conn.sendMessage(m.chat, { 
      text: '🔄 Creating sticker...' 
    }, { quoted: m })

    let q = m.quoted ? m.quoted : m
    let mime = (q.msg || q).mimetype || ''

    // Vérifier qu'on n'a pas déjà un sticker
    if (/webp/.test(mime)) {
      throw new Error(`❌ Please reply to an image/video/gif with ${usedPrefix + command}`)
    }

    if (/image/.test(mime)) {
      // Traitement d'image
      await conn.sendMessage(m.chat, {
        text: '🖼️ Processing image...',
        edit: loadingMsg.key
      })

      let img = await q.download()
      if (!img) throw new Error('Failed to download image')

      const fileType = detectFileType(img)
      if (!['png', 'jpeg', 'gif'].includes(fileType)) {
        throw new Error('Unsupported image format. Please use PNG, JPEG, or GIF.')
      }

      stiker = await createStickerWithMetadata(img, null, global.stickpack || 'Bot Sticker', global.stickauth || 'WhatsApp Bot')

    } else if (/video/.test(mime)) {
      // Traitement de vidéo
      await conn.sendMessage(m.chat, {
        text: '🎥 Processing video...',
        edit: loadingMsg.key
      })

      // Vérifier la durée approximative
      const duration = (q.msg || q).seconds || 0
      if (duration > 11) {
        throw new Error('❌ Maximum video duration is 10 seconds!')
      }

      let vid = await q.download()
      if (!vid) throw new Error('Failed to download video')

      // Vérification basique de la taille (approximation de durée)
      const sizeMB = vid.length / (1024 * 1024)
      if (sizeMB > 5) {
        throw new Error('❌ Video file too large (probably longer than 10 seconds)!')
      }

      const fileType = detectFileType(vid)
      if (!['mp4', 'webm', 'gif'].includes(fileType)) {
        throw new Error('Unsupported video format. Please use MP4, WebM, or GIF.')
      }

      stiker = await createStickerWithMetadata(vid, null, global.stickpack || 'Bot Sticker', global.stickauth || 'WhatsApp Bot')

    } else if (args[0] && /^https?:\/\//.test(args[0])) {
      // Traitement d'URL
      await conn.sendMessage(m.chat, {
        text: '🌐 Downloading from URL...',
        edit: loadingMsg.key
      })

      try {
        const response = await fetch(args[0])
        if (!response.ok) throw new Error('Failed to fetch URL')
        
        const buffer = await response.arrayBuffer()
        const mediaBuffer = Buffer.from(buffer)
        const contentType = response.headers.get('content-type') || ''
        
        if (/image/.test(contentType)) {
          stiker = await createStickerWithMetadata(mediaBuffer, null, global.stickpack || 'Bot Sticker', global.stickauth || 'WhatsApp Bot')
        } else if (/video/.test(contentType)) {
          stiker = await createStickerWithMetadata(mediaBuffer, null, global.stickpack || 'Bot Sticker', global.stickauth || 'WhatsApp Bot')
        } else {
          throw new Error('URL must point to an image or video')
        }
      } catch (urlError) {
        throw new Error(`Failed to process URL: ${urlError.message}`)
      }

    } else {
      throw new Error(`📝 *Sticker Creator*\n\nUsage:\n- Reply to image/video/gif with ${usedPrefix + command}\n- ${usedPrefix + command} <image/video URL>\n\n⚠️ Video duration: 1-10 seconds max`)
    }

  } catch (e) {
    console.error('Sticker creation error:', e)
    stiker = false
    
    // Supprimer le message de chargement
    if (loadingMsg) {
      try {
        await conn.sendMessage(m.chat, { delete: loadingMsg.key })
      } catch (delError) {
        console.log('Could not delete loading message')
      }
    }
    
    // Envoyer le message d'erreur
    const errorMsg = e.message || e.toString()
    await conn.reply(m.chat, errorMsg, m)
    return
  }

  // Finaliser l'envoi
  try {
    if (loadingMsg) {
      await conn.sendMessage(m.chat, {
        text: '✅ Sticker created successfully!',
        edit: loadingMsg.key
      })
      
      // Supprimer le message après un court délai
      setTimeout(async () => {
        try {
          await conn.sendMessage(m.chat, { delete: loadingMsg.key })
        } catch (e) {
          console.log('Could not delete success message')
        }
      }, 2000)
    }

    if (stiker && stiker.length > 0) {
      await conn.sendFile(m.chat, stiker, 'sticker.webp', '', m, {
        asSticker: true,
        packname: global.stickpack || 'Bot Sticker',
        author: global.stickauth || 'WhatsApp Bot'
      })
    } else {
      throw new Error('Sticker creation failed - empty result')
    }

  } catch (sendError) {
    console.error('Error sending sticker:', sendError)
    await conn.reply(m.chat, '❌ Failed to send sticker. Please try again.', m)
  }
}

handler.help = ['sticker', 's']
handler.tags = ['sticker']
handler.command = /^s(tick?er)?(gif)?$/i
handler.register = true

export default handler