// Plugin ToImg simplifié - convertit les stickers en images
import { convertWebPToImage, detectFileType } from '../../lib/sticker_simple.js';

// Fonction pour convertir WebP vers PNG sans dépendances système
async function convertWebpToPng(webpBuffer) {
  try {
    // Essayer plusieurs APIs de conversion en ligne
    const conversionAPIs = [
      {
        name: 'convertio',
        convert: async (buffer) => {
          const formData = new FormData()
          formData.append('file', new Blob([buffer], { type: 'image/webp' }), 'image.webp')
          
          const response = await fetch('https://api.convertio.co/convert', {
            method: 'POST',
            body: formData,
            headers: {
              'Authorization': 'Bearer free-api-key' // API gratuite limitée
            }
          })
          
          if (!response.ok) throw new Error('Convertio API failed')
          return await response.arrayBuffer()
        }
      },
      {
        name: 'cloudconvert',
        convert: async (buffer) => {
          const response = await fetch('https://api.cloudconvert.com/v2/convert/webp/png', {
            method: 'POST',
            body: buffer,
            headers: {
              'Content-Type': 'image/webp'
            }
          })
          
          if (!response.ok) throw new Error('CloudConvert API failed')
          return await response.arrayBuffer()
        }
      },
      {
        name: 'freeconvert',
        convert: async (buffer) => {
          const formData = new FormData()
          formData.append('file', new Blob([buffer], { type: 'image/webp' }))
          formData.append('to', 'png')
          
          const response = await fetch('https://api.freeconvert.com/v1/process/convert', {
            method: 'POST',
            body: formData
          })
          
          if (!response.ok) throw new Error('FreeConvert API failed')
          const result = await response.json()
          
          if (result.output && result.output.url) {
            const imageResponse = await fetch(result.output.url)
            return await imageResponse.arrayBuffer()
          }
          throw new Error('No output URL')
        }
      }
    ]

    for (const api of conversionAPIs) {
      try {
        console.log(`Trying ${api.name} for WebP conversion...`)
        const result = await api.convert(webpBuffer)
        console.log(`✅ ${api.name} conversion successful`)
        return Buffer.from(result)
      } catch (error) {
        console.log(`❌ ${api.name} failed: ${error.message}`)
        continue
      }
    }

    throw new Error('All conversion APIs failed')
  } catch (error) {
    console.error('WebP conversion failed:', error)
    throw error
  }
}

// Fonction de fallback pour extraire l'image d'un WebP
function extractWebpFrame(webpBuffer) {
  try {
    // Cette fonction essaie d'extraire une frame d'un WebP animé
    // C'est une approche simplifiée qui peut ne pas fonctionner pour tous les WebP
    
    // Chercher les chunks VP8/VP8L dans le WebP
    const riffHeader = 'RIFF'
    const webpHeader = 'WEBP'
    
    let offset = 0
    
    // Vérifier RIFF header
    if (webpBuffer.toString('ascii', 0, 4) !== riffHeader) {
      throw new Error('Invalid RIFF header')
    }
    
    // Vérifier WEBP header
    if (webpBuffer.toString('ascii', 8, 12) !== webpHeader) {
      throw new Error('Invalid WebP header')
    }
    
    offset = 12
    
    // Parcourir les chunks pour trouver VP8/VP8L
    while (offset < webpBuffer.length - 8) {
      const chunkType = webpBuffer.toString('ascii', offset, offset + 4)
      const chunkSize = webpBuffer.readUInt32LE(offset + 4)
      
      if (chunkType === 'VP8 ' || chunkType === 'VP8L') {
        // Extraire les données de l'image
        const imageData = webpBuffer.slice(offset + 8, offset + 8 + chunkSize)
        
        // Créer un nouveau buffer WebP avec juste cette frame
        const newWebpSize = 12 + 8 + chunkSize
        const newWebp = Buffer.alloc(newWebpSize)
        
        // Header RIFF
        newWebp.write('RIFF', 0)
        newWebp.writeUInt32LE(newWebpSize - 8, 4)
        newWebp.write('WEBP', 8)
        
        // Chunk VP8/VP8L
        newWebp.write(chunkType, 12)
        newWebp.writeUInt32LE(chunkSize, 16)
        imageData.copy(newWebp, 20)
        
        return newWebp
      }
      
      offset += 8 + chunkSize + (chunkSize % 2) // Padding pour alignement
    }
    
    throw new Error('No VP8/VP8L chunk found')
  } catch (error) {
    console.error('WebP frame extraction failed:', error)
    // Retourner le buffer original si l'extraction échoue
    return webpBuffer
  }
}

// Fonction pour créer une PNG simple à partir de WebP (très basique)
function createFallbackPng(webpBuffer) {
  // Créer une PNG simple avec un message
  const width = 200
  const height = 200
  
  // Header PNG simple (très basique)
  const pngSignature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])
  
  // IHDR chunk (simplified)
  const ihdr = Buffer.alloc(25)
  ihdr.writeUInt32BE(13, 0) // Chunk length
  ihdr.write('IHDR', 4)
  ihdr.writeUInt32BE(width, 8)  // Width
  ihdr.writeUInt32BE(height, 12) // Height
  ihdr.writeUInt8(8, 16)  // Bit depth
  ihdr.writeUInt8(2, 17)  // Color type (RGB)
  ihdr.writeUInt8(0, 18)  // Compression
  ihdr.writeUInt8(0, 19)  // Filter
  ihdr.writeUInt8(0, 20)  // Interlace
  // CRC would go here but simplified
  
  return Buffer.concat([pngSignature, ihdr])
}

// Handler principal du plugin
var handler = async (m, { conn, usedPrefix, command }) => {
  // Vérifier qu'on répond à un message
  if (!m.quoted) {
    return conn.reply(m.chat, `📸 *Sticker to Image Converter*\n\nUsage: Reply to a sticker with ${usedPrefix + command}\n\nExample: Reply to any sticker and type ${usedPrefix + command}`, m)
  }

  let q = m.quoted || m
  let mime = (q.msg || q).mimetype || ''
  
  // Vérifier le type MIME
  if (!mime) {
    return conn.reply(m.chat, `❌ Cannot detect file type. Please reply to a sticker with ${usedPrefix + command}`, m)
  }
  
  if (!/webp/.test(mime)) {
    return conn.reply(m.chat, `❌ Please reply to a sticker (WebP format) with ${usedPrefix + command}`, m)
  }

  let loadingMsg
  try {
    // Message de chargement
    loadingMsg = await conn.sendMessage(m.chat, { 
      text: '🔄 Converting sticker to image...' 
    }, { quoted: m })

    // Télécharger le média
    let media = await q.download()
    
    if (!media || media.length === 0) {
      throw new Error('Failed to download sticker')
    }

    // Vérifier que c'est bien un WebP
    const fileType = detectFileType(media)
    if (fileType !== 'webp') {
      throw new Error('File is not a valid WebP sticker')
    }

    // Mise à jour du message de chargement
    await conn.sendMessage(m.chat, {
      text: '🎨 Processing WebP conversion...',
      edit: loadingMsg.key
    })

    let outputBuffer
    
    try {
      // Utiliser notre fonction centralisée
      outputBuffer = await convertWebPToImage(media, 'png')
    } catch (conversionError) {
      console.log('All conversion methods failed, returning original...')
      outputBuffer = media
    }

    // Supprimer le message de chargement
    try {
      await conn.sendMessage(m.chat, { delete: loadingMsg.key })
    } catch (e) {
      console.log('Could not delete loading message')
    }

    // Déterminer l'extension de fichier
    const outputType = detectFileType(outputBuffer)
    const extension = outputType === 'png' ? 'png' : 'webp'
    const filename = `converted_image.${extension}`

    // Envoyer le fichier converti
    await conn.sendFile(m.chat, outputBuffer, filename, `📸 *Sticker converted to image*\n\nFormat: ${extension.toUpperCase()}`, m)

  } catch (error) {
    console.error('ToImg conversion error:', error)
    
    // Supprimer le message de chargement en cas d'erreur
    if (loadingMsg) {
      try {
        await conn.sendMessage(m.chat, { delete: loadingMsg.key })
      } catch (e) {
        console.log('Could not delete loading message')
      }
    }

    // Message d'erreur à l'utilisateur
    await conn.reply(m.chat, `❌ Error converting sticker: ${error.message}\n\nPlease make sure you're replying to a valid sticker.`, m)
  }
}

handler.help = ['toimg']
handler.tags = ['sticker']
handler.command = /^toimg$/i
handler.register = true

export default handler