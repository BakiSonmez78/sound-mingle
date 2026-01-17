# Render.com Deployment Guide - SoundMingle

## Adım 1: Render Hesabı Oluştur
1. https://render.com adresine git
2. "Get Started" tıkla
3. GitHub ile giriş yap

## Adım 2: Yeni Web Service Oluştur
1. Dashboard'da **"New +"** butonuna tıkla
2. **"Web Service"** seç
3. **"Connect GitHub"** de (ilk seferinde izin isteyecek)

## Adım 3: Repository Seç
1. Listeden **"BakiSonmez78/sound-mingle"** repo'sunu bul
2. Yanındaki **"Connect"** butonuna tıkla

## Adım 4: Ayarları Yap
Şu bilgileri gir:

- **Name**: `sound-mingle` (veya istediğin isim)
- **Region**: `Frankfurt` (Avrupa için en yakın)
- **Branch**: `main`
- **Root Directory**: (boş bırak)
- **Runtime**: `Node`
- **Build Command**: 
  ```
  npm install && npm run build
  ```
- **Start Command**: 
  ```
  npm start
  ```
- **Instance Type**: `Free` seç

## Adım 5: Environment Variables (Opsiyonel)
"Advanced" kısmında şunları ekleyebilirsin:
- `NODE_ENV` = `production`
- `PORT` = `10000` (Render otomatik set eder ama ekleyebilirsin)

## Adım 6: Deploy Et!
1. **"Create Web Service"** butonuna tıkla
2. Deploy başlayacak (5-10 dakika sürer)
3. Logları izle, hata varsa göreceksin

## Adım 7: URL'yi Al
Deploy bitince Render sana bir URL verecek:
```
https://sound-mingle-xxxx.onrender.com
```

## Adım 8: Spotify Ayarları
1. https://developer.spotify.com/dashboard adresine git
2. Uygulamana tıkla
3. "Settings" → "Redirect URIs"
4. Şunu ekle:
   ```
   https://sound-mingle-xxxx.onrender.com/callback
   ```
5. "Save" tıkla

## Adım 9: Test Et!
Render URL'sini aç ve Spotify ile giriş yap!

---

## Sorun Giderme

### Build Hatası Alırsan:
- Render loglarını kontrol et
- `npm install` başarılı mı?
- `npm run build` çalışıyor mu?

### Socket.io Çalışmıyorsa:
- Render'ın WebSocket desteği var, sorun olmaz
- CORS ayarları `server.js`'de zaten var

### Spotify Login Çalışmıyorsa:
- Redirect URI'yi doğru ekledin mi?
- `https://` ile başlıyor mu? (http değil!)

---

## Not
Render'ın free tier'ı 15 dakika inaktiviteden sonra uyur. 
İlk açılış 30-60 saniye sürebilir (cold start).
