// Plugin Watermark autonome - ajoute des métadonnées EXIF aux stickers

// Fonction pour détecter le type de fichier
function detectFileType(buffer) {
    const signatures = {
        webp: [0x52, 0x49, 0x46, 0x46], // RIFF (WebP commence par RIFF)
        png: [0x89, 0x50, 0x4E, 0x47], // PNG signature
        jpeg: [0xFF, 0xD8, 0xFF], // JPEG signature
    }
    
    for (const [type, signature] of Object.entries(signatures)) {
        if (signature.every((byte, index) => buffer[index] === byte)) {
            return type
        }
    }
    return 'unknown'
}

// Fonction pour créer des métadonnées EXIF pour sticker
function createExifData(packname = 'Bot Sticker', author = 'WhatsApp Bot') {
    try {
        // Structure EXIF basique pour WhatsApp stickers
        const exifAttr = Buffer.from([
            0x49, 0x49, 0x2A, 0x00, 0x08, 0x00, 0x00, 0x00, 0x01, 0x00, 0x41, 0x57, 0x07, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x16, 0x00, 0x00, 0x00
        ])
        
        // Métadonnées JSON pour le sticker
        const stickerMetadata = {
            "sticker-pack-id": "com.whatsapp.sticker." + Date.now(),
            "sticker-pack-name": packname.substring(0, 50), // Limite WhatsApp
            "sticker-pack-publisher": author.substring(0, 50), // Limite WhatsApp
            "sticker-pack-publisher-email": "",
            "sticker-pack-publisher-website": "",
            "android-app-store-link": "",
            "ios-app-store-link": ""
        }
        
        const jsonBuffer = Buffer.from(JSON.stringify(stickerMetadata), 'utf8')
        
        // Calculer la taille totale
        const totalSize = exifAttr.length + jsonBuffer.length
        
        // Créer le buffer final avec la taille correcte
        const finalExif = Buffer.alloc(totalSize + 4)
        
        // Écrire la taille au début
        finalExif.writeUInt32LE(totalSize, 0)
        
        // Copier les données EXIF
        exifAttr.copy(finalExif, 4)
        jsonBuffer.copy(finalExif, 4 + exifAttr.length)
        
        return finalExif
        
    } catch (error) {
        console.error('Error creating EXIF data:', error)
        // Fallback : EXIF minimal
        return Buffer.from([
            0x49, 0x49, 0x2A, 0x00, 0x08, 0x00, 0x00, 0x00, 0x01, 0x00, 0x41, 0x57, 0x07, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x16, 0x00, 0x00, 0x00
        ])
    }
}

// Fonction pour ajouter des métadonnées EXIF à un WebP
function addExifToWebP(webpBuffer, packname, author) {
    try {
        // Vérifier que c'est bien un WebP
        if (!webpBuffer.toString('ascii', 0, 4).includes('RIFF') ||
            !webpBuffer.toString('ascii', 8, 12).includes('WEBP')) {
            throw new Error('Invalid WebP format')
        }
        
        // Lire la taille du fichier original
        const originalSize = webpBuffer.readUInt32LE(4)
        
        // Créer les données EXIF
        const exifData = createExifData(packname, author)
        
        // Créer le chunk EXIF
        const exifChunkHeader = Buffer.from('EXIF', 'ascii')
        const exifChunkSize = exifData.length
        
        // Calculer la nouvelle taille du fichier
        const newSize = originalSize + 8 + exifChunkSize + (exifChunkSize % 2) // Padding pour alignement
        
        // Créer le nouveau buffer
        const newWebP = Buffer.alloc(webpBuffer.length + 8 + exifChunkSize + (exifChunkSize % 2))
        
        // Copier le header RIFF + nouvelle taille
        webpBuffer.copy(newWebP, 0, 0, 8)
        newWebP.writeUInt32LE(newSize, 4)
        
        // Copier le header WEBP
        webpBuffer.copy(newWebP, 8, 8, 12)
        
        let offset = 12
        
        // Ajouter le chunk EXIF
        exifChunkHeader.copy(newWebP, offset)
        offset += 4
        
        newWebP.writeUInt32LE(exifChunkSize, offset)
        offset += 4
        
        exifData.copy(newWebP, offset)
        offset += exifChunkSize
        
        // Padding si nécessaire
        if (exifChunkSize % 2) {
            newWebP.writeUInt8(0, offset)
            offset++
        }
        
        // Copier le reste du fichier original (données image)
        webpBuffer.copy(newWebP, offset, 12)
        
        return newWebP
        
    } catch (error) {
        console.error('Error adding EXIF to WebP:', error)
        // En cas d'erreur, retourner le buffer original
        return webpBuffer
    }
}

// Fonction alternative utilisant une API en ligne pour ajouter des métadonnées
async function addExifOnline(webpBuffer, packname, author) {
    try {
        const formData = new FormData()
        formData.append('file', new Blob([webpBuffer], { type: 'image/webp' }), 'sticker.webp')
        formData.append('packname', packname)
        formData.append('author', author)
        
        const response = await fetch('https://api.sticker-tools.com/add-metadata', {
            method: 'POST',
            body: formData
        })
        
        if (!response.ok) throw new Error('Online EXIF API failed')
        
        const result = await response.arrayBuffer()
        return Buffer.from(result)
        
    } catch (error) {
        console.log('Online EXIF service failed:', error.message)
        throw error
    }
}

// Handler principal du plugin
var handler = async (m, { conn, text, usedPrefix, command }) => {
    // Vérifier qu'on répond à un message
    if (!m.quoted) {
        return conn.reply(m.chat, `🏷️ *Sticker Watermark*\n\nUsage: Reply to a sticker with ${usedPrefix + command} <packname>|<author>\n\nExample:\n- ${usedPrefix + command} My Pack|John Doe\n- ${usedPrefix + command} Funny Stickers|Bot\n\n_Adds custom metadata to stickers_`, m)
    }
    
    let stiker = false
    let loadingMsg
    
    try {
        // Message de chargement
        loadingMsg = await conn.sendMessage(m.chat, {
            text: '🏷️ Adding watermark to sticker...'
        }, { quoted: m })
        
        // Parser le texte pour extraire packname et author
        let packname = 'Bot Sticker'
        let author = 'WhatsApp Bot'
        
        if (text && text.trim()) {
            const parts = text.split('|')
            packname = parts[0]?.trim() || packname
            author = parts.slice(1).join('|').trim() || author
        } else {
            // Utiliser les valeurs globales si disponibles
            packname = global.stickpack || global.sticker?.packname || packname
            author = global.stickauth || global.sticker?.author || author
        }
        
        // Valider les longueurs (WhatsApp a des limites)
        if (packname.length > 50) {
            packname = packname.substring(0, 50)
            console.log('Packname truncated to 50 characters')
        }
        
        if (author.length > 50) {
            author = author.substring(0, 50)
            console.log('Author truncated to 50 characters')
        }
        
        // Vérifier le type MIME
        let mime = m.quoted.mimetype || ''
        if (!/webp/.test(mime)) {
            throw new Error('❌ Please reply to a sticker (WebP format)!')
        }
        
        // Télécharger le sticker
        let img = await m.quoted.download()
        if (!img) {
            throw new Error('❌ Failed to download sticker!')
        }
        
        // Vérifier que c'est bien un WebP
        const fileType = detectFileType(img)
        if (fileType !== 'webp') {
            throw new Error('❌ File is not a valid WebP sticker!')
        }
        
        // Mise à jour du message de chargement
        await conn.sendMessage(m.chat, {
            text: `🔧 Processing: "${packname}" by "${author}"...`,
            edit: loadingMsg.key
        })
        
        // Essayer d'ajouter les métadonnées EXIF
        try {
            // Méthode 1: API en ligne
            stiker = await addExifOnline(img, packname, author)
        } catch (onlineError) {
            console.log('Online method failed, using local method...')
            
            try {
                // Méthode 2: Traitement local
                stiker = addExifToWebP(img, packname, author)
            } catch (localError) {
                console.log('Local method failed, using original sticker...')
                
                // Méthode 3: Fallback - retourner le sticker original
                stiker = img
            }
        }
        
        // Supprimer le message de chargement
        try {
            await conn.sendMessage(m.chat, { delete: loadingMsg.key })
        } catch (e) {
            console.log('Could not delete loading message')
        }
        
        // Envoyer le sticker avec watermark
        if (stiker && Buffer.isBuffer(stiker) && stiker.length > 0) {
            await conn.sendFile(m.chat, stiker, 'watermarked.webp',
                `🏷️ *Watermark added!*\n📦 *Pack:* ${packname}\n✍️ *Author:* ${author}`, m, {
                    asSticker: true,
                    packname: packname,
                    author: author
                })
        } else {
            throw new Error('❌ Failed to process sticker watermark')
        }
        
    } catch (error) {
        console.error('Watermark error:', error)
        
        // Supprimer le message de chargement en cas d'erreur
        if (loadingMsg) {
            try {
                await conn.sendMessage(m.chat, { delete: loadingMsg.key })
            } catch (e) {
                console.log('Could not delete loading message')
            }
        }
        
        // Message d'erreur à l'utilisateur
        const errorMsg = error.message || 'Unknown error occurred'
        await conn.reply(m.chat, errorMsg, m)
    }
}

handler.help = ['wm']
handler.tags = ['sticker']
handler.command = /^wm$/i
handler.register = true

export default handler