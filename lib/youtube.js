/*This function is modified to use the new API:                     |
 * https://api.ypnk.dpdns.org/api/search/youtube?q=                  |
 * Updated implementation                                            |
 * -----------------------------------------------------|
*/
import fetch from 'node-fetch'

var durationMultipliers = {
  1: { 0: 1 },
  2: { 0: 60, 1: 1 },
  3: { 0: 3600, 1: 60, 2: 1 }
};

function youtubeSearch(query) {
  return new Promise(async (resolve, reject) => {
    try {
      const response = await fetch(`https://api.ypnk.dpdns.org/api/search/youtube?q=${encodeURIComponent(query)}`, {
        method: "GET",
        headers: {
          'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      // Structure de résultats similaire à l'ancienne version
      var results = { video: [], channel: [], playlist: [] };

      // Traitement des résultats selon la structure de la nouvelle API
      if (data && data.status === true && Array.isArray(data.result)) {
        data.result.forEach((item) => {
          if (item.title && item.link) { // L'API retourne title et link pour les vidéos
            // Calcul de la durée en secondes
            let durationS = 0;
            if (item.duration) {
              const durationParts = item.duration.split(':');
              durationParts.forEach((v, i, arr) => {
                durationS += durationMultipliers[arr.length]['' + i] * parseInt(v);
              });
            }

            // Extraire l'ID de la vidéo depuis le lien
            const videoId = item.link.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/)?.[1];

            results.video.push({
              authorName: item.channel || 'Unknown',
              authorAvatar: '',
              videoId: videoId,
              url: item.link,
              thumbnail: item.imageUrl || `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
              title: item.title || '',
              description: '',
              publishedTime: '',
              durationH: item.duration || '0:00',
              durationS: durationS,
              duration: item.duration || '0:00',
              viewH: '0',
              view: '0',
              type: 'video'
            });
          }
        });
      }

      resolve(results);
    } catch (error) {
      console.error('YouTube search error:', error);
      reject(error);
    }
  });
}

function parseDuration(s) {
  const h = Math.floor(s / 3600);
  const m = Math.floor(s / 60) % 60;
  s = Math.floor(s) % 60;
  return [h, m, s].map(v => v.toString().padStart(2, "0")).join(":");
}

// Alternative YouTube downloader using different API
async function youtubedl(link) {
  try {
    // Try multiple APIs in sequence
    const apis = [
      {
        name: 'y2mate',
        search: async (url) => {
          const response = await fetch("https://www.y2mate.com/mates/analyzeV2/ajax", {
            method: "POST",
            headers: {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
              "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
              "Accept": "*/*",
              "Origin": "https://www.y2mate.com",
              "Referer": "https://www.y2mate.com/",
            },
            body: `k_query=${encodeURIComponent(url)}&k_page=home&hl=en&q_auto=0`
          });
          return await response.json();
        },
        convert: async (vid, k) => {
          const response = await fetch("https://www.y2mate.com/mates/convertV2/index", {
            method: "POST",
            headers: {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
              "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
              "Accept": "*/*",
              "Origin": "https://www.y2mate.com",
              "Referer": "https://www.y2mate.com/",
            },
            body: `vid=${vid}&k=${k}`
          });
          return await response.json();
        }
      }
    ];

    for (const api of apis) {
      try {
        console.log(`Trying ${api.name} API...`);
        const searchResult = await api.search(link);
        
        if (searchResult && searchResult.status === 'ok' && searchResult.links) {
          const result = {
            title: searchResult.title,
            duration: parseDuration(searchResult.t || 0),
            author: searchResult.a || 'Unknown'
          };

          const resultUrl = {
            video: Object.values(searchResult.links.mp4 || {}),
            audio: Object.values(searchResult.links.mp3 || {})
          };

          for (const i in resultUrl) {
            resultUrl[i] = resultUrl[i].map(v => ({
              size: v.size || '0 MB',
              format: v.f || (i === 'audio' ? 'mp3' : 'mp4'),
              quality: v.q || '128kbps',
              download: async () => {
                try {
                  const convertResult = await api.convert(searchResult.vid, v.k);
                  return convertResult.dlink;
                } catch (error) {
                  console.error('Convert error:', error);
                  return null;
                }
              }
            })).sort((a, b) => (parseInt(a.quality) || 0) - (parseInt(b.quality) || 0));
          }

          return { result, resultUrl };
        }
      } catch (apiError) {
        console.error(`${api.name} API failed:`, apiError.message);
        continue;
      }
    }

    // Fallback: return basic info for display purposes
    const videoId = link.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/)?.[1];
    if (videoId) {
      return {
        result: {
          title: 'YouTube Video',
          duration: '00:00',
          author: 'Unknown'
        },
        resultUrl: {
          video: [],
          audio: [{
            size: 'Unknown',
            format: 'mp3',
            quality: '128kbps',
            download: async () => {
              throw new Error('Download service temporarily unavailable. Please try again later.');
            }
          }]
        }
      };
    }

    throw new Error('Invalid YouTube URL or all download services are unavailable');

  } catch (error) {
    console.error('YouTube download error:', error);
    throw error;
  }
}

// Fonction pour obtenir les informations d'une vidéo via la nouvelle API
async function getVideoInfo(url) {
  try {
    const videoId = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/)?.[1];
    if (!videoId) {
      throw new Error('Invalid YouTube URL');
    }

    // D'abord, essayer d'obtenir les infos via l'API Y2mate
    try {
      const y2mateResponse = await fetch("https://www.y2mate.com/mates/analyzeV2/ajax", {
        method: "POST",
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8"
        },
        body: `k_query=${encodeURIComponent(url)}&k_page=home&hl=en&q_auto=0`
      });
      
      if (y2mateResponse.ok) {
        const y2mateData = await y2mateResponse.json();
        if (y2mateData && y2mateData.status === 'ok') {
          return {
            title: y2mateData.title,
            author: { name: y2mateData.a || 'Unknown' },
            lengthSeconds: parseDuration(y2mateData.t || 0),
            viewCount: 'Unknown',
            uploadDate: 'Unknown',
            video_url: url,
            thumbnail: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`
          };
        }
      }
    } catch (y2mateError) {
      console.log('Y2mate info failed, trying search API...');
    }

    // Fallback: utiliser l'API de recherche pour obtenir les infos de la vidéo
    const response = await fetch(`https://api.ypnk.dpdns.org/api/search/youtube?q=${videoId}`, {
      method: "GET",
      headers: {
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    
    // Chercher la vidéo correspondante dans les résultats
    let videoInfo = null;
    if (data && data.status === true && Array.isArray(data.result)) {
      videoInfo = data.result.find(item => item.link && item.link.includes(videoId));
    }

    if (videoInfo) {
      return {
        title: videoInfo.title,
        author: { name: videoInfo.channel || 'Unknown' },
        lengthSeconds: videoInfo.duration || '00:00',
        viewCount: 'Unknown',
        uploadDate: 'Unknown',
        video_url: url,
        thumbnail: videoInfo.imageUrl || `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`
      };
    }

    // Fallback si la vidéo n'est pas trouvée
    return {
      title: 'YouTube Video',
      author: { name: 'Unknown' },
      lengthSeconds: '00:00',
      viewCount: 'Unknown',
      uploadDate: 'Unknown',
      video_url: url,
      thumbnail: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`
    };

  } catch (error) {
    console.error('getInfo error:', error);
    const videoId = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/)?.[1];
    return {
      title: 'YouTube Video',
      author: { name: 'Unknown' },
      lengthSeconds: '00:00',
      viewCount: 'Unknown',
      uploadDate: 'Unknown',
      video_url: url,
      thumbnail: videoId ? `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg` : 'https://via.placeholder.com/480x360?text=YouTube'
    };
  }
}

// Create a youtube object with proper methods
const youtube = {
  search: youtubeSearch,
  download: youtubedl,
  getInfo: getVideoInfo
};

export { youtubedl, youtubeSearch, youtube };
export default youtube;