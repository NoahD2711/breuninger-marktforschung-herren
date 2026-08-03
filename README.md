# Breuninger Marktforschung Herren

Automatisiertes wöchentliches Wettbewerbs-Dashboard für Herrenmode — gebaut als Vorbereitung auf den Wechsel in den Einkauf (Buying/Category Management) bei Breuninger, Studienstart 31.08.2026 an der DHBW Heilbronn.

**Live-Dashboard:** wird nach Aktivierung von GitHub Pages hier ergänzt.

## Beobachtete Wettbewerber

| Wettbewerber | Ziel-URL |
|---|---|
| Mytheresa Herren | https://www.mytheresa.com/de-de/men/new-arrivals/current-week |
| Engelhorn Herren Luxury | https://www.engelhorn.de/de-de/herren/luxury/bekleidung/ |
| LODENFREY Herren | https://www.lodenfrey.com/Herren/ |
| KaDeWe Herrenmode* | https://www.kadewe.de/ |
| Zalando Designer Herren | https://www.zalando.de/premium-herrenbekleidung/ |
| Peek & Cloppenburg Herren | https://www.peek-cloppenburg.de/de/herren/bekleidung |

\* KaDeWe/Oberpollinger betreiben aktuell keinen funktionierenden Online-Shop. Hier werden nur redaktionelle Signale beobachtet, keine Preis-/Sortimentsdaten.

## Wie es funktioniert

1. Sechs Firecrawl-Monitore prüfen jeden Sonntag 21:00 (Europe/Berlin) die Kategorieseiten der Wettbewerber und mailen Änderungen.
2. Eine wöchentliche Cloud-Routine (Montag 06:00 Berlin) liest diese Mails, verdichtet die Änderungen zu einem neuen Snapshot unter `data/`, aktualisiert `data/manifest.json` und pusht.
3. `index.html` lädt die Snapshots zur Laufzeit per `fetch()` — kein Build-Schritt, reines Vanilla HTML/CSS/JS.

## Struktur

```
index.html            Dashboard (statisch, wird nicht automatisch verändert)
assets/style.css      Design-Tokens + Styles
assets/app.js         Lade- und Render-Logik
assets/fonts/         Lokal gehostete Schriften (Space Grotesk, IBM Plex Sans)
data/manifest.json    Index aller Wochen-Snapshots
data/YYYY-Www.json    Ein Snapshot pro Kalenderwoche
```

## Einschränkung

Alle Kennzahlen mit „Proxy"-Badge sind externe Näherungen (Sell-Through, Stock-Turn, NOS), keine echten internen Breuninger-Zahlen. Open-to-Buy und Kalkulationsspanne sind aus öffentlichen Wettbewerber-Daten grundsätzlich nicht ableitbar und werden entsprechend gekennzeichnet, nicht simuliert.

Privates Projekt, nur öffentlich einsehbare Daten.
