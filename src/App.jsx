import React, { useEffect, useMemo, useState } from "react";

const PALETTE = [
  { id: 1, name: "Siyah", hex: "#111111" },
  { id: 2, name: "Gri", hex: "#9B9B9B" },
  { id: 3, name: "Koyu Kahve", hex: "#5A3A22" },
  { id: 4, name: "Kahverengi", hex: "#7A5A3A" },
  { id: 5, name: "Bej", hex: "#D9C59E" },
  { id: 6, name: "Şeftali", hex: "#F4A98B" },
  { id: 7, name: "Kırmızı", hex: "#C73434" },
  { id: 8, name: "Kırmızı Turuncu", hex: "#E04B37" },
  { id: 9, name: "Turuncu", hex: "#F47C2C" },
  { id: 10, name: "Sarı Turuncu", hex: "#F7B13B" },
  { id: 11, name: "Sarı", hex: "#F6D94A" },
  { id: 12, name: "Sarı Yeşil", hex: "#C7D94A" },
  { id: 13, name: "Yeşil", hex: "#22C55E" },
  { id: 14, name: "Koyu Yeşil", hex: "#2E7D4F" },
  { id: 15, name: "Su Yeşili", hex: "#33C7A5" },
  { id: 16, name: "Açık Mavi", hex: "#7EC7E6" },
  { id: 17, name: "Mavi", hex: "#3E7BBE" },
  { id: 18, name: "Koyu Mavi", hex: "#39479D" },
  { id: 19, name: "Pembe", hex: "#F58CB5" },
  { id: 20, name: "Mor", hex: "#8B5CF6" },
  { id: 21, name: "Koyu Mor", hex: "#6D3BB8" },
  { id: 22, name: "Macenta / Fuşya", hex: "#E245A3" },
];

const SHAPES = {
  square: { label: "Kare", template: "square_template.svg", cells: "square_cells.json", font: 16 },
  hex: { label: "Altıgen", template: "hex_template.svg", cells: "hex_cells.json", font: 14 },
  circle: { label: "Daire", template: "circle_template.svg", cells: "circle_cells.json", font: 14 },
  triangle: { label: "Üçgen", template: "triangle_template.svg", cells: "triangle_cells.json", font: 12 },
};

const SVG_NS = "http://www.w3.org/2000/svg";
const DEFAULT_DITHER = 0.42;

function hexToRgb(hex) {
  const clean = hex.replace("#", "");
  return {
    r: parseInt(clean.slice(0, 2), 16),
    g: parseInt(clean.slice(2, 4), 16),
    b: parseInt(clean.slice(4, 6), 16),
  };
}

const paletteRgb = PALETTE.map((color) => ({ ...color, rgb: hexToRgb(color.hex) }));

function normalizeFileName(name) {
  return name.toLowerCase().replace(/\s+/g, "").replace(/\(\d+\)/g, "");
}

function clamp255(value) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function isWhitePixel(r, g, b, a = 255) {
  if (a < 16) return true;
  return r > 242 && g > 242 && b > 242;
}

function nearestPaletteColor(r, g, b) {
  let best = paletteRgb[0];
  let bestDist = Infinity;
  for (const color of paletteRgb) {
    const dr = r - color.rgb.r;
    const dg = g - color.rgb.g;
    const db = b - color.rgb.b;
    const dist = dr * dr + dg * dg + db * db;
    if (dist < bestDist) {
      bestDist = dist;
      best = color;
    }
  }
  return best;
}

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function getViewBox(svgText) {
  const match = svgText.match(/viewBox=["']([^"']+)["']/i);
  if (!match) return { minX: 0, minY: 0, width: 1555, height: 2000 };
  const [minX, minY, width, height] = match[1].trim().split(/\s+/).map(Number);
  return { minX, minY, width, height };
}

function getBounds(cells) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  cells.forEach((cell) => {
    const [x, y, w, h] = cell.bbox;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + w);
    maxY = Math.max(maxY, y + h);
  });
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

function applyOrderedDither(data, width, height, strength = DEFAULT_DITHER) {
  const bayer4 = [
    [0, 8, 2, 10],
    [12, 4, 14, 6],
    [3, 11, 1, 9],
    [15, 7, 13, 5],
  ];
  const amount = strength * 48;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const r0 = data[i];
      const g0 = data[i + 1];
      const b0 = data[i + 2];
      const a = data[i + 3];

      if (isWhitePixel(r0, g0, b0, a)) {
        data[i] = 255;
        data[i + 1] = 255;
        data[i + 2] = 255;
        data[i + 3] = 255;
        continue;
      }

      const threshold = ((bayer4[y % 4][x % 4] + 0.5) / 16 - 0.5) * amount;
      const nearest = nearestPaletteColor(
        clamp255(r0 + threshold),
        clamp255(g0 + threshold),
        clamp255(b0 + threshold)
      );
      data[i] = nearest.rgb.r;
      data[i + 1] = nearest.rgb.g;
      data[i + 2] = nearest.rgb.b;
      data[i + 3] = 255;
    }
  }
}

function getDominantColor(raw, width, bbox) {
  const [x, y, w, h] = bbox.map(Math.round);
  const counts = new Map();
  let total = 0;
  let white = 0;

  for (let py = y; py < y + h; py++) {
    for (let px = x; px < x + w; px++) {
      const i = (py * width + px) * 4;
      const r = raw[i];
      const g = raw[i + 1];
      const b = raw[i + 2];
      const a = raw[i + 3];
      total++;
      if (isWhitePixel(r, g, b, a)) {
        white++;
        continue;
      }
      const color = nearestPaletteColor(r, g, b);
      counts.set(color.id, (counts.get(color.id) || 0) + 1);
    }
  }

  if (!total || white / total >= 0.58) return null;

  let bestId = null;
  let bestCount = -1;
  counts.forEach((count, id) => {
    if (count > bestCount) {
      bestCount = count;
      bestId = id;
    }
  });
  return PALETTE.find((color) => color.id === bestId) || null;
}

async function loadTemplate(shape, templateFiles) {
  const config = SHAPES[shape];
  const templateKey = normalizeFileName(config.template);
  const cellsKey = normalizeFileName(config.cells);
  const svgFile = templateFiles[templateKey];
  const jsonFile = templateFiles[cellsKey];

  let svgText;
  let cells;

  if (svgFile && jsonFile) {
    svgText = await readFileAsText(svgFile);
    cells = JSON.parse(await readFileAsText(jsonFile));
  } else {
    const [svgResponse, jsonResponse] = await Promise.all([
      fetch(`/templates/${config.template}`),
      fetch(`/templates/${config.cells}`),
    ]);
    if (!svgResponse.ok || !jsonResponse.ok) {
      throw new Error(`${config.label} için ${config.template} ve ${config.cells} bulunamadı. Dosyaları yükle veya public/templates klasörüne koy.`);
    }
    svgText = await svgResponse.text();
    cells = await jsonResponse.json();
  }

  return {
    shape,
    label: config.label,
    font: config.font,
    svgText,
    cells,
    viewBox: getViewBox(svgText),
    bounds: getBounds(cells),
  };
}

async function processImage(file, template) {
  const originalSrc = await readFileAsDataUrl(file);
  const img = await loadImage(originalSrc);
  const { width, height } = template.viewBox;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas context oluşturulamadı.");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  const target = template.bounds;
  const ratio = Math.max(target.width / img.naturalWidth, target.height / img.naturalHeight);
  const drawW = img.naturalWidth * ratio;
  const drawH = img.naturalHeight * ratio;
  const drawX = target.x + (target.width - drawW) / 2;
  const drawY = target.y + (target.height - drawH) / 2;

  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(img, drawX, drawY, drawW, drawH);

  const imageData = ctx.getImageData(0, 0, width, height);
  applyOrderedDither(imageData.data, width, height, DEFAULT_DITHER);
  ctx.putImageData(imageData, 0, 0);

  const raw = ctx.getImageData(0, 0, width, height).data;
  const cellResults = new Map();
  const used = new Map();

  template.cells.forEach((cell) => {
    const color = getDominantColor(raw, width, cell.bbox);
    cellResults.set(cell.id, color);
    if (color) used.set(color.id, color);
  });

  return {
    originalSrc,
    cellResults,
    used: Array.from(used.values()).sort((a, b) => a.id - b.id),
  };
}

function parseSvg(svgText) {
  return new DOMParser().parseFromString(svgText, "image/svg+xml");
}

function serializeSvg(doc) {
  return new XMLSerializer().serializeToString(doc);
}

function setBlackSvgBackground(doc, svg, viewBox) {
  const background = doc.getElementById("background");
  if (background) {
    background.setAttribute("fill", "#000000");
    return;
  }

  const rect = doc.createElementNS(SVG_NS, "rect");
  rect.setAttribute("id", "background");
  rect.setAttribute("x", String(viewBox.minX));
  rect.setAttribute("y", String(viewBox.minY));
  rect.setAttribute("width", String(viewBox.width));
  rect.setAttribute("height", String(viewBox.height));
  rect.setAttribute("fill", "#000000");
  svg.insertBefore(rect, svg.firstChild);
}

function makePatternSvg(template, result, mode) {
  const doc = parseSvg(template.svgText);
  const svg = doc.documentElement;

  setBlackSvgBackground(doc, svg, template.viewBox);

  template.cells.forEach((cell) => {
    const el = doc.getElementById(cell.id);
    const color = result.cellResults.get(cell.id);
    if (!el) return;
    el.setAttribute("fill", mode === "colored" && color ? color.hex : "#ffffff");
  });

  if (mode === "numbers") {
    const group = doc.createElementNS(SVG_NS, "g");
    group.setAttribute("id", "renkatlas_numbers");
    group.setAttribute("font-family", "Arial, sans-serif");
    group.setAttribute("font-weight", "700");
    group.setAttribute("font-size", String(template.font));
    group.setAttribute("fill", "#555555");
    group.setAttribute("text-anchor", "middle");
    group.setAttribute("dominant-baseline", "middle");

    template.cells.forEach((cell) => {
      const color = result.cellResults.get(cell.id);
      if (!color) return;
      const text = doc.createElementNS(SVG_NS, "text");
      text.setAttribute("x", String(cell.cx));
      text.setAttribute("y", String(cell.cy + 1));
      text.textContent = String(color.id);
      group.appendChild(text);
    });

    svg.appendChild(group);
  }

  return serializeSvg(doc);
}

function makeOriginalSvg(template, result) {
  const { width, height } = template.viewBox;
  const { x, y, width: w, height: h } = template.bounds;
  const clipId = `clip_${template.shape}`;
  return `
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${width} ${height}">
  <rect width="${width}" height="${height}" fill="#000000"/>
  <defs><clipPath id="${clipId}"><rect x="${x}" y="${y}" width="${w}" height="${h}"/></clipPath></defs>
  <image href="${result.originalSrc}" x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid slice" clip-path="url(#${clipId})"/>
</svg>`;
}

function makePaletteSvg(template, used) {
  const { width, height } = template.viewBox;
  const cols = 4;
  const itemW = 230;
  const itemH = 185;
  const gapX = 70;
  const gapY = 95;
  const rows = Math.ceil(used.length / cols);
  const totalW = cols * itemW + (cols - 1) * gapX;
  const totalH = rows * itemH + Math.max(0, rows - 1) * gapY;
  const startX = (width - totalW) / 2;
  const startY = Math.max(100, (height - totalH) / 2);

  const items = used.map((color, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = startX + col * (itemW + gapX);
    const y = startY + row * (itemH + gapY);
    const cx = x + itemW / 2;
    const cy = y + 58;
    const s = 34;
    const tests = [
      [cx - 54, cy],
      [cx, cy - 54],
      [cx + 54, cy],
      [cx, cy + 54],
    ];
    const testRects = tests.map(([tx, ty]) => `<rect x="${tx - s / 2}" y="${ty - s / 2}" width="${s}" height="${s}" rx="5" fill="#ffffff" stroke="${color.hex}" stroke-width="4"/>`).join("");
    return `
      <g>
        ${testRects}
        <rect x="${cx - s / 2}" y="${cy - s / 2}" width="${s}" height="${s}" rx="5" fill="${color.hex}" stroke="#ffffff" stroke-width="3"/>
        <text x="${cx}" y="${cy + 1}" text-anchor="middle" dominant-baseline="middle" font-family="Arial" font-weight="900" font-size="15" fill="#ffffff">${color.id}</text>
        <text x="${cx}" y="${y + 150}" text-anchor="middle" dominant-baseline="middle" font-family="Arial" font-weight="900" font-size="24" fill="#ffffff">${color.name}</text>
      </g>`;
  }).join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}"><rect width="${width}" height="${height}" fill="#000000"/>${items}</svg>`;
}

function svgToDataUrl(svg) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function downloadUrl(url, filename) {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function SvgPreview({ svg }) {
  const url = useMemo(() => svgToDataUrl(svg), [svg]);
  return <img src={url} alt="Önizleme" className="w-full max-w-[760px] rounded-xl shadow-2xl" />;
}

export default function RenkAtlasApp() {
  const [templateFiles, setTemplateFiles] = useState({});
  const [shape, setShape] = useState("square");
  const [file, setFile] = useState(null);
  const [view, setView] = useState("numbers");
  const [template, setTemplate] = useState(null);
  const [result, setResult] = useState(null);
  const [downloadLinks, setDownloadLinks] = useState([]);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setError("");
    setStatus(file ? "loading" : "idle");
    setTemplate(null);
    setResult(null);
    setDownloadLinks([]);

    loadTemplate(shape, templateFiles)
      .then(async (loadedTemplate) => {
        if (cancelled) return;
        setTemplate(loadedTemplate);
        if (!file) {
          setStatus("idle");
          return;
        }
        const processed = await processImage(file, loadedTemplate);
        if (cancelled) return;
        setResult(processed);
        setStatus("done");
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err?.message || "Şablon veya görsel işlenemedi.");
        setStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, [shape, file, templateFiles]);

  const outputSvgs = useMemo(() => {
    if (!template || !result) return null;
    return {
      original: makeOriginalSvg(template, result),
      numbers: makePatternSvg(template, result, "numbers"),
      colored: makePatternSvg(template, result, "colored"),
      palette: makePaletteSvg(template, result.used),
    };
  }, [template, result]);

  const currentSvg = useMemo(() => {
    if (!outputSvgs) return "";
    if (view === "original") return outputSvgs.original;
    if (view === "colored") return outputSvgs.colored;
    if (view === "guide") return outputSvgs.palette;
    return outputSvgs.numbers;
  }, [outputSvgs, view]);

  const title = useMemo(() => {
    if (view === "original") return "Orijinal Görsel";
    if (view === "numbers") return "Sayılı Boyama Sayfası";
    if (view === "colored") return "Boyalı Önizleme";
    return "Renk Talimatları";
  }, [view]);

  function handleTemplateFilesUpload(event) {
    const files = Array.from(event.target.files || []);
    const next = {};
    files.forEach((file) => {
      next[normalizeFileName(file.name)] = file;
    });
    setTemplateFiles(next);
  }

  function handleDownloadAll() {
    if (!outputSvgs || !template) return;
    const files = [
      [`01-${template.shape}-orijinal.svg`, outputSvgs.original],
      [`02-${template.shape}-sayilar.svg`, outputSvgs.numbers],
      [`03-${template.shape}-boyali.svg`, outputSvgs.colored],
      [`04-${template.shape}-palet.svg`, outputSvgs.palette],
    ].map(([name, svg]) => ({ name, url: svgToDataUrl(svg) }));

    setDownloadLinks(files);
    files.forEach((file, index) => {
      window.setTimeout(() => downloadUrl(file.url, file.name), index * 250);
    });
  }

  const templateCount = Object.keys(templateFiles).length;

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="mx-auto max-w-6xl px-5 py-6">
        <div className="mb-6 rounded-2xl border border-white/10 bg-white/5 p-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="text-2xl font-black">Renk Atlas - Gizemli Nokta Boyama Kitabı App</h1>
              <p className="mt-1 text-sm text-zinc-300">SVG şablonlu sistem: kare, altıgen, daire, üçgen. Seçili şeklin 4 sayfası indirilebilir.</p>
            </div>
            <div className="flex flex-col gap-2 md:flex-row">
              <label className="inline-flex cursor-pointer items-center justify-center rounded-xl bg-amber-200 px-5 py-3 font-bold text-zinc-950 hover:bg-amber-100">
                Şablonları Yükle
                <input type="file" accept=".svg,.json" multiple className="hidden" onChange={handleTemplateFilesUpload} />
              </label>
              <label className="inline-flex cursor-pointer items-center justify-center rounded-xl bg-white px-5 py-3 font-bold text-zinc-950 hover:bg-zinc-200">
                Görsel Yükle
                <input type="file" accept="image/*" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
              </label>
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-white/10 bg-black/30 p-3 text-sm text-zinc-200">
            Yüklenen şablon dosyası: <b>{templateCount}</b>/8. Canvas içinde çalışırken 8 dosyayı birlikte seç: square/hex/circle/triangle template SVG + cells JSON.
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <div className="rounded-xl bg-black/30 p-4">
              <label className="mb-2 block text-sm font-bold text-zinc-300">Şekil</label>
              <select value={shape} onChange={(e) => setShape(e.target.value)} className="w-full rounded-xl border border-white/10 bg-zinc-900 p-3 text-white outline-none">
                {Object.entries(SHAPES).map(([key, item]) => (
                  <option key={key} value={key}>{item.label}</option>
                ))}
              </select>
            </div>

            <div className="rounded-xl bg-black/30 p-4 md:col-span-2">
              <label className="mb-2 block text-sm font-bold text-zinc-300">Önizleme</label>
              <div className="grid grid-cols-5 gap-2">
                <button onClick={() => setView("original")} className={`rounded-xl p-3 text-sm font-bold ${view === "original" ? "bg-white text-black" : "bg-zinc-900"}`}>Orijinal</button>
                <button onClick={() => setView("numbers")} className={`rounded-xl p-3 text-sm font-bold ${view === "numbers" ? "bg-white text-black" : "bg-zinc-900"}`}>Sayı</button>
                <button onClick={() => setView("colored")} className={`rounded-xl p-3 text-sm font-bold ${view === "colored" ? "bg-white text-black" : "bg-zinc-900"}`}>Boyalı</button>
                <button onClick={() => setView("guide")} className={`rounded-xl p-3 text-sm font-bold ${view === "guide" ? "bg-white text-black" : "bg-zinc-900"}`}>Palet</button>
                <button onClick={handleDownloadAll} disabled={!outputSvgs} className="rounded-xl bg-emerald-400 p-3 text-sm font-black text-black disabled:cursor-not-allowed disabled:opacity-40">İndir</button>
              </div>
            </div>
          </div>
        </div>

        {!file && status !== "error" && (
          <div className="flex min-h-[520px] items-center justify-center rounded-2xl border border-dashed border-white/20 bg-white/[0.03] text-center">
            <div>
              <p className="text-xl font-bold">Başlamak için şablonları ve görseli yükle</p>
              <p className="mt-2 text-zinc-400">Gerçek projede dosyaları public/templates klasörüne koyarsan şablon yükleme gerekmez.</p>
            </div>
          </div>
        )}

        {status === "loading" && <div className="rounded-2xl bg-white/5 p-8 text-center">İşleniyor...</div>}
        {status === "error" && <div className="rounded-2xl border border-red-400/30 bg-red-500/10 p-8 text-center text-red-100">{error}</div>}

        {downloadLinks.length > 0 && (
          <div className="mb-5 grid max-w-[760px] grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-white/5 p-3 md:grid-cols-4">
            {downloadLinks.map((file) => (
              <a key={file.name} href={file.url} download={file.name} className="rounded-xl bg-white px-3 py-3 text-center text-xs font-black text-black hover:bg-zinc-200">
                {file.name}
              </a>
            ))}
          </div>
        )}

        {currentSvg && status === "done" && (
          <div>
            <div className="mb-3 flex max-w-[760px] items-center justify-between">
              <h2 className="text-xl font-black">{title}</h2>
              <span className="text-sm text-zinc-400">{template?.label}</span>
            </div>
            <div className="flex justify-start">
              <SvgPreview svg={currentSvg} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
