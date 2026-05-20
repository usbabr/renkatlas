# Renk Atlas - Gizemli Nokta Boyama Kitabı App

Vite + React + JavaScript ile kurulmuş SVG template tabanlı boyama sayfası üretici uygulaması.

## Kurulum

```bash
npm install
```

## Geliştirme

```bash
npm run dev
```

Vite uygulamayı yerel bir adreste başlatır. Terminalde görünen URL'i tarayıcıda aç.

## Build

```bash
npm run build
```

Build çıktısı `dist/` klasörüne yazılır.

## Önizleme

```bash
npm run preview
```

## Template Dosyaları

Uygulama SVG içindeki hücreleri yeniden çizmez. `public/templates/` klasöründeki SVG hücrelerini `id` değerleriyle bulur ve sayı ya da renk uygular.

Aşağıdaki 8 dosyayı `public/templates/` içine koy:

- `square_template.svg`
- `square_cells.json`
- `hex_template.svg`
- `hex_cells.json`
- `circle_template.svg`
- `circle_cells.json`
- `triangle_template.svg`
- `triangle_cells.json`

Dosyalar bu klasörde yoksa uygulamadaki "Şablonları Yükle" butonu fallback olarak aynı 8 dosyayı tarayıcıdan seçmeyi destekler.

## Deploy

1. `npm run build` komutunu çalıştır.
2. Oluşan `dist/` klasörünü statik hosting servisine yükle.
3. Vercel, Netlify veya GitHub Pages gibi servislerde build komutu olarak `npm run build`, publish/output klasörü olarak `dist` kullan.
