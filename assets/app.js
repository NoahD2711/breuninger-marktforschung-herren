const COMPETITORS = [
  { id: "mytheresa", name: "Mytheresa Herren", color: "var(--c1)", limited: false },
  { id: "engelhorn", name: "Engelhorn Herren Luxury", color: "var(--c2)", limited: false },
  { id: "lodenfrey", name: "LODENFREY Herren", color: "var(--c3)", limited: false },
  { id: "kadewe", name: "KaDeWe Herrenmode", color: "var(--c4)", limited: true },
  { id: "zalando", name: "Zalando Designer Herren", color: "var(--c5)", limited: false },
  { id: "peekcloppenburg", name: "Peek & Cloppenburg Herren", color: "var(--c6)", limited: false },
];

const STUDY_START = new Date("2026-08-31T00:00:00+02:00");

async function loadJSON(path) {
  const res = await fetch(path, { cache: "no-store" });
  if (!res.ok) throw new Error(`Konnte ${path} nicht laden (${res.status})`);
  return res.json();
}

function byId(id) {
  return document.getElementById(id);
}

function formatDate(iso) {
  if (!iso) return "–";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function competitorMeta(id) {
  return COMPETITORS.find((c) => c.id === id) || { id, name: id, color: "var(--text-tertiary)", limited: false };
}

/* ---------------------------------------------------------------------
   Haupt-Ladevorgang
   ------------------------------------------------------------------- */
async function loadDashboard() {
  let manifest;
  try {
    manifest = await loadJSON("data/manifest.json");
  } catch (err) {
    renderFatalEmptyState(err);
    return;
  }

  if (!manifest.weeks || manifest.weeks.length === 0) {
    renderFatalEmptyState(null);
    return;
  }

  // manifest führt neueste Woche zuerst — für Trends brauchen wir chronologisch (älteste zuerst)
  const weeksDesc = await Promise.all(manifest.weeks.map((w) => loadJSON(w.file)));
  const weeksAsc = [...weeksDesc].reverse();
  const latest = weeksDesc[0];

  renderHeader(latest, weeksDesc.length);
  renderKpiTiles(weeksAsc);
  renderCompetitorGrid(latest, weeksAsc);
  renderTrendChart(weeksAsc);
  renderPriceRadar(latest);
  renderNewArrivalsFeed(latest);
  renderRawDataLinks(manifest.weeks);
  initScrollReveal();
}

function renderFatalEmptyState(err) {
  byId("app").innerHTML = `
    <section>
      <div class="wrap">
        <div class="empty-state">
          <p><strong>Noch keine Daten vorhanden.</strong></p>
          <p>Der erste automatische Wochenlauf steht noch bevor. Sobald der erste Snapshot unter <code>data/</code> liegt, füllt sich dieses Dashboard von selbst.</p>
          ${err ? `<p class="section-note">(${err.message})</p>` : ""}
        </div>
      </div>
    </section>`;
}

/* ---------------------------------------------------------------------
   Header
   ------------------------------------------------------------------- */
function renderHeader(latest, weekCount) {
  byId("last-update").textContent = `KW ${latest.week.split("-W")[1]} · ${formatDate(latest.week_start_date)}`;
  byId("week-count").textContent = weekCount;

  const daysLeft = Math.ceil((STUDY_START - new Date()) / (1000 * 60 * 60 * 24));
  const chip = byId("countdown-chip");
  if (daysLeft > 0) {
    chip.textContent = `${daysLeft} Tage bis Studienstart`;
  } else {
    chip.textContent = "Studium läuft";
  }
}

/* ---------------------------------------------------------------------
   KPI-Kacheln
   ------------------------------------------------------------------- */
function renderKpiTiles(weeksAsc) {
  const el = byId("kpi-grid");
  const latest = weeksAsc[weeksAsc.length - 1];

  const trackableIds = new Set(COMPETITORS.filter((m) => !m.limited).map((m) => m.id));
  const soldOutSeries = weeksAsc.map((w) =>
    w.competitors.filter((c) => trackableIds.has(c.id)).reduce((sum, c) => sum + (c.sold_out_count || 0), 0)
  );
  const newArrivalsSeries = weeksAsc.map((w) =>
    w.competitors.reduce((sum, c) => sum + (c.new_arrivals ? c.new_arrivals.length : 0), 0)
  );
  const assortmentSeries = weeksAsc.map((w) =>
    w.competitors.reduce((sum, c) => sum + (Number(c.assortment_size_signal) || 0), 0)
  );

  const latestSoldOut = soldOutSeries[soldOutSeries.length - 1];
  const latestNewArrivals = newArrivalsSeries[newArrivalsSeries.length - 1];

  el.innerHTML = `
    <div class="kpi-tile is-disabled reveal">
      <span class="kpi-label">Open-to-Buy</span>
      <span class="badge badge-unavailable">Nicht verfügbar</span>
      <span class="kpi-value">—</span>
      <span class="kpi-sub">Interne Budgetkennzahl, aus öffentlichen Wettbewerber-Daten nicht ableitbar.</span>
    </div>

    <div class="kpi-tile is-disabled reveal">
      <span class="kpi-label">Kalkulationsspanne / Marge</span>
      <span class="badge badge-unavailable">Nicht verfügbar</span>
      <span class="kpi-value">—</span>
      <span class="kpi-sub">Erfordert interne Einkaufspreise. Siehe Preis-Radar für einen sehr groben Rabatttiefe-Hinweis.</span>
    </div>

    <div class="kpi-tile reveal">
      <span class="kpi-label">Sell-Through-Proxy</span>
      <span class="badge badge-proxy">Proxy</span>
      <span class="kpi-value">${latestSoldOut}</span>
      <span class="kpi-sub">Artikel diese Woche neu als „Sold out" markiert (alle Wettbewerber)</span>
      ${sparkline(soldOutSeries, "var(--negative)")}
    </div>

    <div class="kpi-tile reveal">
      <span class="kpi-label">Neuheiten-Frequenz</span>
      <span class="badge badge-proxy">Proxy</span>
      <span class="kpi-value">${latestNewArrivals}</span>
      <span class="kpi-sub">Neu gelistete Artikel diese Woche (alle Wettbewerber, Stock-Turn-Näherung)</span>
      ${sparkline(newArrivalsSeries, "var(--accent)")}
    </div>

    <div class="kpi-tile reveal">
      <span class="kpi-label">Sortimentsbreite (NOS-Signal)</span>
      <span class="badge badge-proxy">Proxy</span>
      <span class="kpi-value">${assortmentSeries[assortmentSeries.length - 1] || "–"}</span>
      <span class="kpi-sub">Summe gemeldeter Artikelzahlen über beobachtete Kategorien hinweg</span>
      ${sparkline(assortmentSeries, "var(--positive)")}
    </div>
  `;
}

function sparkline(series, color) {
  if (!series || series.every((v) => !v)) return "";
  const w = 160;
  const h = 32;
  const max = Math.max(...series, 1);
  const min = Math.min(...series, 0);
  const range = max - min || 1;
  const step = series.length > 1 ? w / (series.length - 1) : w;
  const points = series
    .map((v, i) => `${(i * step).toFixed(1)},${(h - ((v - min) / range) * h).toFixed(1)}`)
    .join(" ");
  return `<svg class="sparkline" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true">
    <polyline points="${points}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />
  </svg>`;
}

/* ---------------------------------------------------------------------
   Wettbewerber-Grid
   ------------------------------------------------------------------- */
function renderCompetitorGrid(latest, weeksAsc) {
  const el = byId("competitor-grid");
  el.innerHTML = COMPETITORS.map((meta) => {
    const current = latest.competitors.find((c) => c.id === meta.id) || {};
    const series = weeksAsc.map((w) => {
      const c = w.competitors.find((x) => x.id === meta.id);
      return c && c.new_arrivals ? c.new_arrivals.length : 0;
    });

    if (meta.limited || current.notes?.includes("Kein Online-Shop")) {
      return `
        <article class="competitor-card is-limited reveal" style="--c-color:${meta.color}">
          <div class="competitor-card-head">
            <div>
              <h3>${meta.name}</h3>
              <a class="ext-link" href="${current.monitor_url || "#"}" target="_blank" rel="noopener">Quelle ansehen ↗</a>
            </div>
          </div>
          <p class="limited-note">${current.notes || "Kein Online-Shop verfügbar — nur redaktionelle/Pop-up-Signale, keine Preis- oder Sortimentsdaten."}</p>
        </article>`;
    }

    const newCount = current.new_arrivals ? current.new_arrivals.length : 0;
    const soldOut = current.sold_out_count ?? 0;
    const assortment = current.assortment_size_signal ?? "–";

    return `
      <article class="competitor-card reveal" style="--c-color:${meta.color}">
        <div class="competitor-card-head">
          <div>
            <h3>${meta.name}</h3>
            <a class="ext-link" href="${current.monitor_url || "#"}" target="_blank" rel="noopener">Quelle ansehen ↗</a>
          </div>
        </div>
        <div class="competitor-stats">
          <div class="stat">
            <span class="stat-value">${newCount}</span>
            <span class="stat-label">Neu</span>
          </div>
          <div class="stat">
            <span class="stat-value">${soldOut}</span>
            <span class="stat-label">Sold out</span>
          </div>
          <div class="stat">
            <span class="stat-value">${assortment}</span>
            <span class="stat-label">Sortiment</span>
          </div>
        </div>
        <div class="trend">${sparkline(series, meta.color.startsWith("var") ? getComputedColor(meta.color) : meta.color)}</div>
        ${current.email_found === false ? '<p class="section-note">Keine Monitor-Mail diese Woche gefunden.</p>' : ""}
      </article>`;
  }).join("");
}

function getComputedColor(varExpr) {
  const match = varExpr.match(/var\((--[a-z0-9-]+)\)/i);
  if (!match) return "#c9a24a";
  return getComputedStyle(document.documentElement).getPropertyValue(match[1]).trim() || "#c9a24a";
}

/* ---------------------------------------------------------------------
   Wochentrend-Chart (Neuheiten pro Woche, je Wettbewerber)
   ------------------------------------------------------------------- */
let hiddenCompetitors = new Set();

function renderTrendChart(weeksAsc) {
  const legendEl = byId("trend-legend");
  legendEl.innerHTML = COMPETITORS.map(
    (m) => `
    <button type="button" class="legend-item" data-id="${m.id}">
      <span class="legend-dot" style="background:${m.color}"></span>${m.name}
    </button>`
  ).join("");

  legendEl.querySelectorAll(".legend-item").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.id;
      if (hiddenCompetitors.has(id)) hiddenCompetitors.delete(id);
      else hiddenCompetitors.add(id);
      btn.classList.toggle("is-off");
      drawTrendSvg(weeksAsc);
    });
  });

  drawTrendSvg(weeksAsc);
}

function drawTrendSvg(weeksAsc) {
  const wrap = byId("trend-chart-wrap");
  const w = 900;
  const h = 280;
  const padL = 32;
  const padB = 24;
  const padT = 12;

  const series = COMPETITORS.filter((m) => !hiddenCompetitors.has(m.id)).map((m) => ({
    meta: m,
    values: weeksAsc.map((wk) => {
      const c = wk.competitors.find((x) => x.id === m.id);
      return c && c.new_arrivals ? c.new_arrivals.length : 0;
    }),
  }));

  const allValues = series.flatMap((s) => s.values);
  const max = Math.max(...allValues, 1);
  const n = weeksAsc.length;
  const stepX = n > 1 ? (w - padL - 16) / (n - 1) : 0;
  const scaleY = (v) => h - padB - (v / max) * (h - padB - padT);

  let gridLines = "";
  for (let i = 0; i <= 4; i++) {
    const y = padT + ((h - padB - padT) / 4) * i;
    const val = Math.round(max - (max / 4) * i);
    gridLines += `<line x1="${padL}" y1="${y}" x2="${w - 8}" y2="${y}" stroke="var(--border)" stroke-width="1" />`;
    gridLines += `<text class="axis-label" x="4" y="${y + 3}">${val}</text>`;
  }

  let xLabels = "";
  weeksAsc.forEach((wk, i) => {
    if (n <= 8 || i % Math.ceil(n / 8) === 0) {
      xLabels += `<text class="axis-label" x="${padL + i * stepX}" y="${h - 6}" text-anchor="middle">${wk.week.split("-W")[1]}</text>`;
    }
  });

  const lines = series
    .map((s) => {
      const points = s.values.map((v, i) => `${(padL + i * stepX).toFixed(1)},${scaleY(v).toFixed(1)}`).join(" ");
      const color = getComputedColor(s.meta.color);
      return `<polyline points="${points}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" />`;
    })
    .join("");

  wrap.innerHTML = `
    <div class="chart-svg-wrap">
      <svg viewBox="0 0 ${w} ${h}" width="100%" role="img" aria-label="Neuheiten pro Woche je Wettbewerber">
        ${gridLines}
        ${lines}
        ${xLabels}
      </svg>
    </div>`;
}

/* ---------------------------------------------------------------------
   Preis-Radar (Rabatttiefe je Wettbewerber, aktuelle Woche)
   ------------------------------------------------------------------- */
function renderPriceRadar(latest) {
  const wrap = byId("price-radar-wrap");
  const rows = COMPETITORS.filter((m) => !m.limited).map((m) => {
    const c = latest.competitors.find((x) => x.id === m.id) || {};
    const discounts = (c.price_changes || [])
      .filter((p) => p.discount_pct != null)
      .map((p) => Number(p.discount_pct));
    const avg = discounts.length ? discounts.reduce((a, b) => a + b, 0) / discounts.length : null;
    return { meta: m, avg, saleActive: !!c.sale_active };
  });

  const max = Math.max(...rows.map((r) => r.avg || 0), 10);

  wrap.innerHTML = `
    <div class="chart-svg-wrap">
      <svg viewBox="0 0 640 ${rows.length * 40 + 10}" width="100%" role="img" aria-label="Durchschnittliche Sale-Rabatttiefe je Wettbewerber">
        ${rows
          .map((r, i) => {
            const y = i * 40 + 6;
            const barW = r.avg ? (r.avg / max) * 460 : 0;
            const color = getComputedColor(r.meta.color);
            return `
            <text x="0" y="${y + 14}" fill="var(--text-secondary)" font-size="12" font-family="var(--font-body)">${r.meta.name}</text>
            <rect x="150" y="${y}" width="${barW}" height="18" rx="4" fill="${color}" opacity="0.85" />
            <text x="${150 + barW + 8}" y="${y + 14}" fill="var(--text-primary)" font-size="12" font-family="var(--font-body)">${r.avg ? r.avg.toFixed(0) + "%" : "keine Daten"}</text>
          `;
          })
          .join("")}
      </svg>
    </div>
    <p class="section-note" style="margin-top:0.75rem">Rabatttiefe ist ein sehr schwacher Marge-Indiz-Proxy — kein Ersatz für echte Kalkulationsdaten.</p>`;
}

/* ---------------------------------------------------------------------
   Neuheiten-Feed
   ------------------------------------------------------------------- */
function renderNewArrivalsFeed(latest) {
  const allItems = [];
  latest.competitors.forEach((c) => {
    const meta = competitorMeta(c.id);
    (c.new_arrivals || []).forEach((item) => {
      allItems.push({ ...item, competitorId: c.id, competitorName: meta.name, color: meta.color });
    });
  });

  const filterEl = byId("feed-filter");
  filterEl.innerHTML =
    `<option value="">Alle Wettbewerber</option>` +
    COMPETITORS.map((m) => `<option value="${m.id}">${m.name}</option>`).join("");

  function draw() {
    const filter = filterEl.value;
    const items = filter ? allItems.filter((i) => i.competitorId === filter) : allItems;
    const tbody = byId("feed-tbody");

    if (!items.length) {
      byId("feed-table-wrap").innerHTML = `<div class="empty-state">Keine Neuheiten für diese Auswahl in der aktuellen Woche.</div>`;
      return;
    }

    tbody?.remove();
    byId("feed-table-wrap").innerHTML = `
      <table class="feed-table">
        <thead>
          <tr><th>Wettbewerber</th><th>Marke</th><th>Produkt</th><th>Preis</th><th>Status</th></tr>
        </thead>
        <tbody id="feed-tbody">
          ${items
            .map(
              (i) => `
            <tr>
              <td><span class="competitor-dot" style="background:${i.color}"></span>${i.competitorName}</td>
              <td>${i.brand || "–"}</td>
              <td>${i.product || "–"}</td>
              <td>${i.price_eur != null ? i.price_eur + " €" : "–"}</td>
              <td>${i.sold_out ? "Sold out" : "Verfügbar"}</td>
            </tr>`
            )
            .join("")}
        </tbody>
      </table>`;
  }

  filterEl.addEventListener("change", draw);
  draw();
}

/* ---------------------------------------------------------------------
   Rohdaten-Links (Methodik-Sektion)
   ------------------------------------------------------------------- */
function renderRawDataLinks(weeksMeta) {
  const el = byId("raw-data-list");
  el.innerHTML = weeksMeta
    .map((w) => `<li><a href="${w.file}" target="_blank" rel="noopener">${w.week}</a></li>`)
    .join("");
}

/* ---------------------------------------------------------------------
   Scroll-Reveal
   ------------------------------------------------------------------- */
function initScrollReveal() {
  const items = document.querySelectorAll(".reveal");
  if (!("IntersectionObserver" in window) || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    items.forEach((el) => el.classList.add("is-visible"));
    return;
  }
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.1 }
  );
  items.forEach((el) => observer.observe(el));
}

document.addEventListener("DOMContentLoaded", loadDashboard);
