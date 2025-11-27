
import { GoogleGenAI } from "@google/genai";

// Vercel Serverless Function Handler
export default async function handler(req, res) {
  // 1. CORS Handling
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // --- STRATEGI KEY POOL (KOLAM KUNCI) ---
    // Mengumpulkan semua API Key yang tersedia di Environment Variables secara dinamis.
    // Mendukung penamaan: API_KEY, API_KEY_1, API_KEY_2 ... sampai API_KEY_50
    const allKeys = [];
    
    // Cek kunci utama
    if (process.env.API_KEY && !process.env.API_KEY.includes('TEMPEL')) {
      allKeys.push(process.env.API_KEY);
    }

    // Cek kunci tambahan (Looping otomatis)
    for (let i = 1; i <= 50; i++) {
      const keyName = `API_KEY_${i}`;
      const keyVal = process.env[keyName];
      if (keyVal && keyVal.length > 10) {
        allKeys.push(keyVal);
      }
    }

    if (allKeys.length === 0) {
      return res.status(500).json({ error: 'Server API Keys not configured properly.' });
    }

    const { model, contents, config } = req.body;
    const modelId = model || 'gemini-2.5-flash';

    // --- RANDOM LOAD BALANCING ---
    // Acak urutan kunci agar beban terbagi rata.
    // Algoritma Fisher-Yates Shuffle
    let shuffledKeys = [...allKeys];
    for (let i = shuffledKeys.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffledKeys[i], shuffledKeys[j]] = [shuffledKeys[j], shuffledKeys[i]];
    }

    // --- FAILOVER STRATEGY ---
    // Coba gunakan kunci satu per satu. Jika kunci A limit (429), pindah ke B.
    // Mencoba maksimal 3 kunci berbeda per request untuk menjaga latensi tetap rendah.
    const attempts = Math.min(3, shuffledKeys.length);
    let lastError = null;

    for (let i = 0; i < attempts; i++) {
      const currentKey = shuffledKeys[i];
      try {
        const ai = new GoogleGenAI({ apiKey: currentKey });
        const response = await ai.models.generateContent({
          model: modelId,
          contents: contents,
          config: config
        });
        
        // Jika sukses, langsung return dan hentikan loop
        return res.status(200).json(response);
      
      } catch (error) {
        console.warn(`Attempt ${i+1} with Key ending in ...${currentKey.slice(-4)} failed: ${error.message}`);
        lastError = error;

        // Cek tipe error
        const isRateLimit = error.status === 429 || error.toString().includes('429') || error.toString().includes('Too Many Requests') || error.toString().includes('Quota');
        const isServerOverload = error.status === 503 || error.toString().includes('503');
        
        // Jika error BUKAN karena kuota/server (misal: Bad Request/Safety Filter), jangan retry, langsung error ke user.
        // Kita hanya retry jika masalahnya adalah traffic/kuota.
        if (!isRateLimit && !isServerOverload) {
           return res.status(error.status || 500).json({
             error: error.message || 'AI Processing Error',
             details: 'Terjadi kesalahan pada input atau filter keamanan AI.'
           });
        }
        
        // Jika ini percobaan terakhir dan masih gagal
        if (i === attempts - 1) {
          throw error;
        }
        // Jika belum terakhir, loop akan berlanjut ke kunci berikutnya...
      }
    }

    // Jika loop selesai tanpa return sukses (semua kunci dicoba gagal)
    return res.status(429).json({ 
      error: 'Server Busy',
      details: 'Sistem sedang sangat sibuk. Silakan coba lagi beberapa saat lagi.'
    });

  } catch (error) {
    console.error("Final Serverless Error:", error);
    return res.status(error.status || 500).json({ 
      error: 'Service Unavailable', 
      details: 'Gagal memproses permintaan setelah beberapa percobaan. Server sedang padat.' 
    });
  }
}
