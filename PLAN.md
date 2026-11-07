# Stadt Land Fluss Extrem – Plan

Stand: 8.11.2026 (Phase 1 bis 5 umgesetzt, Rückmeldungen vom 7. und 8.11. eingearbeitet, 366 Tests in drei Browser-Projekten grün, `npm run check:sw` grün; offen nur die Punkte unter „Offen“).

## Ziel

Partyspiel für ein geteiltes Handy: 1 bis 5 Teams spielen reihum gegen die Uhr, das Handy
ersetzt Karten, Würfel und Spielbrett. Rein statische Web-App nach dem Vorbild von
[One Clue](https://github.com/pa-ssch/one-clue): `public/` mit HTML/CSS/JS ohne Build-Schritt,
Skizzen-Look, PWA mit Service Worker, CSP, Playwright-Tests in drei Projekten, CI mit Deploy
auf GitHub Pages, Live-Prüfung. Spiel-Setup, Punktestand und Wiederaufnahme nach dem Vorbild
von [Level 100](https://github.com/pa-ssch/level-100).

Qualitätsmaßstab: alles, was in One Clue geprüft wird, wird hier auch geprüft; dazu die
Spiellogik dieses Spiels.

## Befund (Ausgangslage)

- Leeres Verzeichnis, kein Git, nur die Aufgabenstellung (`stadt-land-fluss-extrem-prompt.md`).
- Node 22.11, npm 11, Playwright-Browser (Chromium, WebKit) sind lokal installiert.
- One Clue liefert: `style.css`, Ansichten-Mechanik, `fitWord`, Wake Lock, Install-Hinweis,
  `sw.js` + `scripts/check-sw-version.js`, Playwright-Konfigurationen, Tests, Workflows,
  Dependabot, Impressum, Schriftdateien mit OFL-Lizenz, README-Gliederung.
- Level 100 liefert: Muster für `PLAN.md`, Abgrenzungssatz, `SECURITY.md`, SEO-Grundlagen
  (Description, Canonical, Open Graph, `robots.txt`), Validierung des Spielstands.

## Entscheidungen

1. **Name und Adressen.** Titel „Stadt Land Fluss Extrem“, Kurzname „SLF Extrem“.
   Domain-Platzhalter `slfx.9xb.de` (CNAME, Canonical, Open Graph, robots.txt), Kontakt
   `slfx@9xb.de` nach dem Muster `1clue@9xb.de`. Beides steht an wenigen Stellen und wird
   getauscht, sobald Repo-Name und Domain feststehen.
2. **Konstanten an einer Stelle.** `public/rules.js` (globale Variable `RULES`) enthält alle
   Zahlen: Teamgrenzen, Namenslänge, Zielpunkte, Buchstabengewichte, Modi mit Zeit, Punkten,
   Gewicht und Text, Kategorien je Runde, Walzen-Zeiten. Die Tests lesen dieselbe Datei
   (wie `categories.js` in One Clue), die README dokumentiert sie.
3. **Buchstabenwalze.** Ergebnis wird beim Tipp auf „Stopp“ (oder beim Auto-Stopp) mit einem
   einzigen `Math.random()`-Aufruf gewichtet gezogen, unabhängig von der Walzenposition.
   Danach läuft die Walze aus: Start mit dem Drehtempo, Strecke bis zum Ziel um ganze
   Umdrehungen verlängert, bis sie zur zufälligen Dauer passt, monoton abbremsend bis zum
   Ergebnis. Q, X und Y haben Gewicht 0 und stehen nicht auf der Walze (Konstante, bei
   Bedarf wieder einschaltbar). Der Buchstabe der Vorrunde ist ausgeschlossen.
4. **Moduswalze.** Rückmeldung vom 7.11.2026: Beide Walzen sitzen in einem Kasten, laufen
   von selbst an, sobald die Ansicht erscheint, und beim Tipp auf „Stopp“ werden Buchstabe
   und Modus zusammen gezogen; beide laufen gleich lang aus und halten gemeinsam. Danach
   zeigt die Ansicht Buchstabe, Modus und Zeit mit Erklärung und einem Button „Los“, erst
   der startet den Countdown (Annahme: das Team soll den Modus lesen können, bevor die
   Zeit läuft). „Alle raten mit“ ist bei einem Team nicht auf der Walze.
5. **Spielstand** in `slfx-game` (`v: 1`): Teams mit Punkten, Zielpunkte, gewählte Decks,
   aktives Team, Rundenzähler, letzter Buchstabe, Phase (`turn`, `wheel`, `play`, `score`,
   `end`) und die laufende Runde (Buchstabe, Modus, acht Kategorien, Markierungen, Endzeit
   als Zeitstempel, bei „Alle raten mit“ Position und Vergaben). Jede Änderung wird sofort
   gespeichert; jeder Lesezugriff validiert streng, Müll ergibt „kein Spiel“.
6. **Neuladen.** Phase `turn` → Startseite mit „Weiterspielen“, dann Rundenstart desselben
   Teams. Phase `wheel` → Walze neu drehen. Phase `ready` (Walzen fertig, „Los“ noch nicht
   getippt) → Walzen stehen auf dem Ergebnis, „Los“ sichtbar. Phase `play` → ohne Umweg
   über die Startseite direkt zurück in die Runde (die Zeit läuft ja): Timer mit Restzeit
   und Markierungen, „Alle raten mit“ beim aktuellen Begriff; ist die Zeit abgelaufen, zur
   Punkteansicht. Phase `score` → Punkte erneut bestätigen, eine Korrektur bleibt
   erhalten. Punkte gehen nie verloren. Beim Laden wird der bereinigte Spielstand
   zurückgeschrieben, damit der Speicher immer gültig ist.
7. **Spielende.** Nach jeder bestätigten Runde: Hat ein Team die Zielpunkte und haben alle
   Teams gleich oft gespielt (Rundenzähler teilbar durch Teamanzahl), ist Schluss.
   Gleichstand = geteilter Sieg. „Nochmal mit denselben Teams“ setzt Punkte und Zähler
   zurück, Team 1 beginnt.
8. **Kategorien ohne Wiederholung.** `slfx-used` wie in One Clue. Reichen die ungezeigten
   Kategorien der Auswahl nicht mehr für acht, werden die restlichen genommen und der
   Merker für die Auswahl zurückgesetzt; innerhalb einer Runde gibt es keine Doppelten.
9. **Rückfragen** (Spiel abbrechen, neues Spiel bei laufendem Spiel) als eigene Ansicht im
   Skizzen-Look statt `window.confirm`, damit sie testbar und gestaltbar sind. Der Eck-Button
   führt zur Startseite, ohne den Spielstand zu löschen (dort „Weiterspielen“).
10. **Timer-Ende.** Vibration, Kacheln eingefroren, „Zeit!“ statt Timer, Button „Weiter“
    zur Punkteansicht. Die letzten 5 Sekunden sind invertiert hervorgehoben. Rückmeldung
    vom 7.11.2026: Während der Runde gibt es einen Button „Fertig“, der die Runde vor Ablauf
    der Zeit beendet und direkt zur Punkteansicht führt.
11. **Layout der Runde.** Hochformat: Buchstabe und Timer oben, Kacheln als Raster 2×4
    darunter. Querformat: Buchstabe und Timer links, Kacheln 2×4 rechts. Kacheln füllen den
    Rest der Ansicht innerhalb der Safe Area; die Kacheltexte werden per JS so verkleinert,
    dass sie in die Kachel passen (mindestens 44 px hoch).
12. **SEO** wie Level 100, aber ohne Sprachen: Description, Canonical, Open Graph mit
    `icons/og-image.png`, `robots.txt`. Keine Sitemap (eine Seite).
13. **Rechtliches.** Eigener Name, eigene Kategorie- und Modustexte, Abgrenzungssatz in
    README und Impressum (keine Verbindung zu „Stadt Land Vollpfosten“, Denkriesen oder
    anderen Rechteinhabern; die Mechanik Stadt-Land-Fluss ist gemeinfrei).
14. **Vorgehen.** Node nur für Tests. Nach jeder Phase `npm test` und `npm run check:sw`
    grün, Commit auf Deutsch. Die Aufgabenstellung `stadt-land-fluss-extrem-prompt.md` bleibt
    unversioniert.

## Werte (Vorschlag aus der Aufgabe, alles in `public/rules.js`)

| Konstante | Wert |
| --- | --- |
| Teams | 1 bis 5, Standardname „Team n“, Name höchstens 20 Zeichen |
| Zielpunkte | Vorgabe 100, Schritt 10, mindestens 5, höchstens 500 (Rückmeldung vom 7.11.2026) |
| Kategorien je Runde | 8 |
| Normal | 40 s, 1 Punkt je Begriff, Gewicht 5 (Rückmeldung vom 7.11.2026, vorher 60 s) |
| Gemütlich / Schnell / Blitz | 60 s / 20 s / 15 s, 1 Punkt je Begriff, Gewicht 2 / 2 / 1 („Doppelt“ entfällt) |
| Alles oder nichts | 80 s, alle acht = 8 Punkte, sonst 0, am Ende 0 oder 8 wählbar, Gewicht 2 (Rückmeldung vom 7.11.2026, vorher 10 Punkte ohne Wahl) |
| Alle raten mit | kein Timer, 1 Punkt je Begriff an das schnellste Team, Gewicht 2, ab 2 Teams |
| Buchstaben | A 6, B 8, C 2, D 5, E 5, F 6, G 6, H 7, I 2, J 2, K 8, L 5, M 7, N 3, O 2, P 5, Q 0, R 5, S 10, T 5, U 2, V 3, W 6, X 0, Y 0, Z 3 |
| Walze | läuft von selbst an, Auto-Stopp nach 4 s, Auslauf beider Walzen 2,5 bis 3,5 s, beginnt mit dem Drehtempo und bremst nur ab (Rückmeldung vom 8.11.2026, vorher Ease-out über ganze Umdrehungen mit Tempo-Sprung) |
| Countdown | 3 s |
| Hervorhebung | letzte 5 s |

## Phasen

### Phase 1 – Skelett aus One Clue

- [x] `PLAN.md`
- [x] Git-Repo, `.gitignore`, `LICENSE` (MIT), `SECURITY.md`, `package.json`, Playwright-Konfigurationen, `scripts/check-sw-version.js`, Workflows, Dependabot
- [x] `public/`: `style.css` (übernommen und erweitert), Schriften mit OFL, Icons (SVG, PNG 192/512/180, OG-Bild), `manifest.webmanifest`, `sw.js`, `robots.txt`, `CNAME`
- [x] `public/impressum.html` aus One Clue angepasst (Name, Kontakt, Local-Storage-Einträge, Abgrenzung)

### Phase 2 – Inhalte und Konstanten

- [x] `public/rules.js` mit allen Werten
- [x] `public/decks.js`: Normal (≥ 150), NSFW (≥ 40), Weihnachten (≥ 40), `DEFAULT_ON = ["Normal"]`

### Phase 3 – Spiellogik

- [x] Startseite (Weiterspielen / Neues Spiel / Wie geht das? / Impressum / Install-Hinweis)
- [x] Spiel anlegen (Teams, Namen, Zielpunkte, Speichern)
- [x] Punkteleiste, Rundenstart mit Deck-Auswahl je Runde (Rückmeldung vom 8.11.2026, vorher beim Anlegen), Rückfragen
- [x] Buchstabenwalze und Moduswalze (inkl. Reduced Motion und Auto-Stopp)
- [x] Countdown, Runde mit Timer und Kacheln, Wake Lock, Vibration
- [x] Modi Normal, Gemütlich, Schnell, Blitz, Alles oder nichts, Alle raten mit
- [x] Punkteansicht mit Korrektur, Spielende mit Rangliste
- [x] Wiederaufnahme nach Neuladen, robuste Speicherung

### Phase 4 – Tests

- [x] Spiel anlegen, Persistenz
- [x] Walzen (deterministisch mit gemocktem `Math.random`), Gewichte, kein Buchstabe doppelt, Reduced Motion, Auto-Stopp
- [x] Modus-Logik, Kacheln, Punkte, Punkteleiste, Spielende, Gleichstand
- [x] Neuladen, kaputter Speicher, keine Wiederholung der Kategorien
- [x] Layout (Hoch/Quer, Safe Area, Kacheln passen), axe-core
- [x] Übernommen aus One Clue: Offline, Verweise, Impressum, CSP, Sicherheitsregeln, Install-Hinweis, Datenqualität, Live-Prüfung

### Phase 5 – Doku und Abschluss

- [x] README (Spielregeln, Werte, Aufbau, Deck ergänzen, Entwickeln/Testen, Live-Prüfung, Veröffentlichung, Abgrenzung, Lizenz)
- [x] `PLAN.md` mit Stand und Datum

## Offen (von außen zu liefern)

- [ ] Repo-Name und Domain; dann `public/CNAME`, Canonical/Open Graph in `index.html`, `robots.txt`, `playwright.live.config.js`, README, Impressum und `SECURITY.md` anpassen.
- [ ] Postfach `slfx@9xb.de` anlegen oder Adresse ändern.
- [ ] Punkte- und Zeitwerte nach den ersten Spielabenden in `public/rules.js` nachjustieren.
- [ ] Auf echten Geräten gegenprüfen (Wake Lock, Vibration, Safe Area, Walzen-Animation auf schwachen Handys).
- [ ] GitHub-Repo anlegen, Pages aktivieren, DNS; danach `npm run test:live` und der Workflow „Live-Check“.

## Annahmen, die beim Bau getroffen wurden

- Nach der Moduswalze startet der Countdown erst mit „Los“, damit das Team Modus und Zeit
  lesen kann.
- Q, X und Y haben Gewicht 0 (Konstante in `rules.js`), sie stehen nicht auf der Walze.
- „Nochmal mit denselben Teams“ beginnt wieder mit Team 1.
- Nach „Alles oder nichts“ springt der Stepper nur zwischen 0 und 8 (Rückmeldung vom
  7.11.2026); nach „Alle raten mit“ gibt es keinen Stepper, nur die Zusammenfassung der
  schon vergebenen Punkte.
- Der Stepper in der Punkteansicht zählt Begriffe (0 bis 8), die Punkte ergeben sich aus
  dem Modus.
- Die Zeitvarianten (Gemütlich, Schnell, Blitz) geben wie Normal einen Punkt je Begriff;
  die Namen sind eigene Wahl, die Gewichte ein Vorschlag.
- Beendetes Spiel: Startseite zeigt „Neues Spiel“ ohne Rückfrage, das Anlegen ist mit den
  alten Teams und dem Ziel vorbelegt.
- Rückfragen laufen über ein `<dialog>` im Skizzen-Look (mit `window.confirm` als
  Fallback für sehr alte Browser).
- Die Decks werden je Runde am Rundenstart gewählt, Vorbelegung immer `DEFAULT_ON`, nichts
  wird gemerkt (Rückmeldung vom 8.11.2026); `game.decks` hält die Auswahl der laufenden Runde.
  Der Local-Storage-Eintrag `slfx-decks` ist damit entfallen.
- Kacheltexte: größtmögliche Schrift per Intervallhalbierung, Umbruch nur an Leerzeichen,
  Markieren ändert weder Schriftschnitt noch Rahmenbreite (Rückmeldung vom 8.11.2026).
- Die Aufgabenstellung `stadt-land-fluss-extrem-prompt.md` liegt unversioniert im Ordner.
