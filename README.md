# Stadt Land Fluss Extrem

Partyspiel für ein geteiltes Handy: Teams spielen reihum gegen die Uhr, das Handy
ersetzt Karten, Würfel und Spielbrett. Läuft direkt im Browser, ohne App, ohne
Anmeldung, auch offline.

**Spielen:** [slfx.9xb.de](https://slfx.9xb.de)

Stadt Land Fluss Extrem ist ein eigenständiges, nicht kommerzielles Projekt
und steht in keiner Verbindung zu „Stadt Land Fluss“ und „Stadt Land Fluss
Extreme“ von Schmidt Spiele, „Stadt Land Vollpfosten“ von Denkriesen,
„Scattergories“ von Hasbro, „Stadt Land BOOM!“ vom moses. Verlag oder anderen
Anbietern von Stadt-Land-Fluss-Spielen und deren Rechteinhabern. Kategorien,
Modi, Design und Oberfläche sind eigene Arbeit. „Stadt, Land, Fluss“ ist ein
seit Generationen gespielter Klassiker, an dem nach den Feststellungen des
Landgerichts Berlin und des Kammergerichts Berlin (2013) niemand Markenrechte
erwerben kann.

## So geht's

1. **Ein Handy, 1 bis 5 Teams.** Unter „Neues Spiel“ Teams benennen und
   Zielpunkte wählen (Vorgabe 100, Schritte von 10). Ein Team allein spielt
   kooperativ und sammelt Punkte.
2. **Handy weitergeben.** Das Team, das dran ist, hakt die **Decks** für seine
   Runde an (vorangehakt ist immer nur „Normal“) und tippt auf „Bereit“. Die
   beiden Walzen in einem Kasten laufen sofort los; ein Tipp auf **Stopp**
   liefert Buchstaben und Modus mit Zeit, beide Walzen laufen gemeinsam aus.
3. **Runde.** Nach „Los“ und einem Countdown erscheinen acht Kategorien als
   Kacheln. Das Team ruft zu jeder einen Begriff, der mit dem Buchstaben beginnt,
   und tippt die geschafften Kacheln an. Die anderen Teams passen auf. Die
   letzten fünf Sekunden sind hervorgehoben, am Ende vibriert das Handy und die
   Kacheln frieren ein. Wer vorher durch ist, tippt auf **Fertig**.
4. **Punkte.** Das Handy belegt die Punkte aus den Kacheln vor. Nach Diskussion
   lässt sich die Zahl mit Plus und Minus korrigieren, dann „Punkte eintragen“.
   Die Punkteleiste oben ist auf allen Spiel-Ansichten zu sehen.
5. **Spielende.** Erreicht ein Team die Zielpunkte, wird der Durchgang zu Ende
   gespielt, bis alle Teams gleich oft dran waren. Dann gibt es eine Rangliste,
   Gleichstand ist ein geteilter Sieg. „Nochmal mit denselben Teams“ oder
   „Neues Spiel“.

Der runde Pfeil oben rechts führt mit Rückfrage zur Startseite; das Spiel bleibt
gespeichert und lässt sich dort mit „Weiterspielen“ fortsetzen. Auch ein
Neuladen der Seite führt zurück in die laufende Runde (mit Restzeit und
Markierungen) oder zum Rundenstart desselben Teams. Punkte gehen nie verloren.

### Modi

| Modus | Zeit | Punkte | Gewicht |
| --- | --- | --- | --- |
| Normal | 40 s | 1 je geschafftem Begriff | 5 |
| Gemütlich | 60 s | 1 je geschafftem Begriff | 2 |
| Schnell | 20 s | 1 je geschafftem Begriff | 2 |
| Blitz | 15 s | 1 je geschafftem Begriff | 1 |
| Alles oder nichts | 80 s | alle acht in der Zeit: 8 Punkte, der Timer stoppt sofort; sonst 0. Am Ende wählbar: 0 oder 8 | 2 |
| Alle raten mit | kein Timer | Begriffe nacheinander einzeln groß, das schnellste Team ruft und bekommt per Tipp auf seinen Namen 1 Punkt, „Überspringen“ bei Einigkeit | 2, erst ab 2 Teams |

### Walze

Die Walzen laufen von selbst an, sobald die Ansicht erscheint. Beim Tipp auf
„Stopp“ (oder nach 4 Sekunden von selbst) werden Buchstabe und Modus in diesem
Moment mit je einem Zufallswert gezogen, unabhängig davon, wo die Walzen gerade
stehen. Danach laufen beide gleich lang aus: Der Auslauf beginnt genau mit dem
Tempo des Drehens und wird nur langsamer, nie schneller; die Strecke bis zum
Ergebnis wird um ganze Umdrehungen verlängert, bis sie zur zufälligen Dauer
passt. Beide Walzen halten gemeinsam auf dem Ergebnis. Der Zeitpunkt des
Tippens kann das Ergebnis also nicht beeinflussen. Häufige Anfangsbuchstaben kommen öfter,
Q, X und Y stehen nicht auf der Walze, und der Buchstabe der Vorrunde ist
ausgeschlossen. Bei `prefers-reduced-motion` gibt es keine Animation, das
Ergebnis steht sofort.

### Alle Werte

Alle Zahlen stehen in `public/rules.js` (Objekt `RULES`) und werden von den
Tests aus derselben Datei gelesen:

| Konstante | Wert |
| --- | --- |
| `MIN_TEAMS`, `MAX_TEAMS` | 1, 5 |
| `MAX_NAME_LENGTH` | 20 Zeichen, getrimmt; leer ergibt „Team n“ |
| `DEFAULT_TARGET`, `MIN_TARGET`, `MAX_TARGET`, `TARGET_STEP` | 100, 5, 500, 10 (je Runde gibt es bis zu 8 Punkte) |
| `CATEGORIES_PER_ROUND` | 8 |
| `COUNTDOWN_SECONDS`, `URGENT_SECONDS` | 3, 5 |
| `LETTER_WEIGHTS` | A 6, B 8, C 2, D 5, E 5, F 6, G 6, H 7, I 2, J 2, K 8, L 5, M 7, N 3, O 2, P 5, Q 0, R 5, S 10, T 5, U 2, V 3, W 6, X 0, Y 0, Z 3 (0 = nicht auf der Walze) |
| `WHEEL.AUTO_STOP_MS` | 4000 |
| `WHEEL.MIN_RUNOUT_MS`, `MAX_RUNOUT_MS` | 2500 bis 3500 ms Auslauf, für beide Walzen gleich (mindestens 1,5 × Zellen ÷ `SPEED`, damit die Strecke zum Tempo passt) |
| `WHEEL.SPEED` | 14 Zellen je Sekunde beim Drehen, zugleich das Starttempo des Auslaufs |
| `MODES` | Name, Sekunden, Punkte bzw. Bonus, Gewicht, Mindestteams, Erklärungstext je Modus (siehe oben) |

## Aufbau

Statische Seite ohne Build-Schritt und ohne Bibliotheken. Alles, was
veröffentlicht wird, liegt in `public/`:

```
public/
├── index.html            die Seite (alle Ansichten)
├── style.css             Gestaltung (Skizzen-Look wie One Clue)
├── app.js                Spiellogik: Speicher, Walzen, Modi, Timer, Punkte
├── rules.js              alle Zahlen: Zeiten, Punkte, Gewichte, Grenzen
├── decks.js              die Decks mit ihren Kategorien
├── impressum.html        Impressum, Haftungsausschluss, Datenschutzerklärung
├── sw.js                 Offline-Betrieb (Service Worker)
├── manifest.webmanifest  Web-App-Manifest für den Home-Screen
├── robots.txt            Crawler willkommen
├── icons/                Favicon, Home-Screen-Icons, Vorschaubild für Links
├── fonts/                Handschrift „Patrick Hand“ (OFL) für Geräte ohne passende Systemschrift
└── CNAME                 die Domain für GitHub Pages
```

Alles außerhalb von `public/` (`test/`, `scripts/`, `.github/`, `package.json`,
`playwright.config.js`, `playwright.live.config.js`) ist Test- und
Deploy-Werkzeug. Die App selbst braucht davon nichts. Der Fahrplan steht in
[PLAN.md](PLAN.md).

Das Spiel liegt im `localStorage` des Handys unter drei Einträgen:
`slfx-game` (laufendes Spiel: Teams, Punkte, Ziel, Phase, aktuelle Runde samt
Deck-Auswahl), `slfx-used` (bereits gezeigte Kategorien) und `slfx-install`
(nur nach „Nein, danke“ beim Install-Hinweis). Jeder Lesezugriff
prüft die Daten streng; kaputte Einträge ergeben „kein Spiel“, eine kaputte Runde
den Rundenstart desselben Teams mit erhaltenen Punkten.

## Deck ergänzen

Alle Kategorien stehen in `public/decks.js` im Objekt `DECKS`:

```js
var DECKS = {
  "Normal":      ["Stadt", "Land", ...],
  "NSFW":        [...],
  "Weihnachten": [...],
  // Neues Deck einfach anhängen:
  "Tiere":       ["Tier mit Fell", "Tier im Wasser", "Tier, das beißt"]
};
```

Mehr ist nicht nötig. Die Checkbox am Rundenstart wird automatisch aus den
Schlüsseln erzeugt, die Reihenfolge im Objekt ist die Anzeige-Reihenfolge.

Hinweise:

- Kategorien sind kurze Nominalphrasen, zu denen es mit jedem gängigen
  Anfangsbuchstaben einen Begriff gibt („Etwas, das man im Keller findet“).
  Eigene Texte, keine Übernahmen aus kommerziellen Spielen. Der Test
  „Datenqualität“ prüft Mindestgrößen (Normal 150, andere 40), Duplikate,
  Leerzeichen, Großschreibung und Länge.
- Die Decks werden **jede Runde neu** gewählt, auf der Ansicht „Team X ist
  dran“. Vorangehakt sind jedes Mal nur die Decks aus der Liste `DEFAULT_ON` am
  Anfang von `public/decks.js` (aktuell nur „Normal“); die Auswahl wird nicht
  gemerkt. Jedes andere Deck, auch ein neu ergänztes, muss bewusst für die Runde
  dazugeschaltet werden. Mindestens ein Deck muss ausgewählt sein.
- Bereits gezeigte Kategorien merkt sich jedes Handy ebenfalls im
  `localStorage`. Reichen die ungezeigten Kategorien der Auswahl nicht mehr für
  eine Runde, werden die restlichen genommen und der Merker für diese Auswahl
  zurückgesetzt; innerhalb einer Runde gibt es keine Doppelten. Unter den Decks
  steht, wie viele Kategorien die Auswahl enthält und wie viele davon auf
  diesem Handy noch nicht gezeigt wurden.
- Auf der Startseite erscheint ein Hinweis „App hinzufügen“, damit das Spiel
  offline läuft. Auf Android/Chrome öffnet der Button den echten Install-Dialog
  des Browsers (`beforeinstallprompt`). iOS bietet dafür keine Schnittstelle,
  dort steht nur die Anleitung „Teilen → Zum Home-Bildschirm“. Der Hinweis
  kommt nicht in der installierten App (Standalone-Modus), nicht nach „Nein,
  danke“ und nicht im flachen Querformat.
- Nach jeder Änderung an einer Datei in `public/` die `VERSION` in
  `public/sw.js` hochzählen, damit Handys mit zwischengespeicherter Version die
  neue Fassung beim nächsten Aufruf übernehmen. Die CI lehnt Änderungen ohne
  hochgezählte `VERSION` ab; `npm run check:sw` prüft das lokal gegen
  `origin/main`.

## Entwickeln und testen

Node wird nur für die Tests gebraucht, die App selbst läuft ohne.

```sh
npm install                              # einmalig: Test-Werkzeuge
npx playwright install chromium webkit   # einmalig: Test-Browser (Chrome- und Safari-Engine)

npm run dev           # lokaler Server auf http://127.0.0.1:8765, öffnet den Browser
npm test              # alle Browser-Tests (Handy-Chrome, Handy-Safari, Desktop)
npm run test:ui       # Tests interaktiv im Playwright-Fenster
npm run test:report   # letzten HTML-Report öffnen
npm run test:live     # veröffentlichte Seite prüfen (braucht Internet, siehe unten)
npm run check:sw      # wurde VERSION in sw.js nach Änderungen in public/ hochgezählt?
```

Die Tests in `test/` laufen in drei Projekten (Pixel 7, iPhone 13, Desktop Chrome):

- `app.test.js`: Startseite, Anleitung, Spiel anlegen (Teamanzahl, Namen,
  Zielpunkte), Rundenstart mit Deck-Auswahl je Runde (Vorauswahl ohne Merken,
  Wechsel zwischen Runden), Punkteleiste, Rückfragen.
- `wheel.test.js`: Walzen mit gemocktem `Math.random`: laufen beim Betreten von
  selbst an, Ergebnis unabhängig vom Stopp-Zeitpunkt, beide halten gemeinsam auf
  dem Ergebnis, Auto-Stopp, Reduced-Motion-Pfad, Gewichte der Buchstaben und Modi,
  kein Buchstabe doppelt in Folge, bei einem Team kein „Alle raten mit“.
- `play.test.js`: Countdown, Kacheln, Timer mit Hervorhebung und Vibration,
  „Fertig“ vor Ablauf der Zeit, jede Modus-Logik inklusive
  Alles-oder-nichts-Abbruch und Alle-raten-mit-Vergabe, Punkte vorbelegen und korrigieren, Spielende mit
  vollem Durchgang, Gleichstand, ein Team, „Nochmal“.
- `persist.test.js`: Neuladen in jeder Phase, kaputter Local Storage je
  Eintrag, kaputte Runde ohne Punktverlust, keine Wiederholung der Kategorien.
- `layout.test.js`: Hoch- und Querformat, Drehung, Safe Area, Kacheltexte so
  groß wie möglich ohne Umbruch im Wort und ohne Layoutsprung beim Abhaken,
  Begriffe passen, Touch-Ziele, Barrierefreiheit (axe-core) auf jeder Ansicht.
- `quality.test.js`: Markup, SEO (Canonical, Open Graph, robots.txt),
  Manifest, reduzierte Bewegung, Impressum, Offline-Betrieb, interne Verweise,
  Datenqualität der Decks und Regeln.
- `security.test.js`: Während eines kompletten Spieldurchlaufs verlässt kein
  Request die eigene Adresse, es entstehen keine Cookies, und im Browser liegen
  genau die genannten Local-Storage-Einträge. Im Quelltext sind `innerHTML`,
  `eval` und ähnliche Sinks, Inline-Skripte und externe Adressen (außer in der
  Datenschutzerklärung und der eigenen Adresse für SEO) verboten.
- `install.test.js`: Hinweis „App hinzufügen“ auf Android (simuliertes
  `beforeinstallprompt`), iOS-Anleitung auf Safari, nichts im Standalone-Modus,
  nichts mehr nach „Nein, danke“.

## Live-Prüfung

`npm run test:live` prüft die veröffentlichte Seite unter
[slfx.9xb.de](https://slfx.9xb.de) (andere Adresse: `LIVE_URL=https://...`):

- HTTP leitet dauerhaft auf HTTPS um, das Zertifikat ist vertrauenswürdig und
  noch mindestens 14 Tage gültig, es werden keine Cookies gesetzt.
- Jede Datei aus `public/` wird live byte-identisch ausgeliefert. Nach einem
  Deploy wird bis zu `LIVE_WAIT_MS` Millisekunden (Standard 30 Sekunden) auf den
  neuen Stand gewartet, weil der CDN-Cache kurz nachhängen kann. Lokal schlägt
  die Prüfung erwartungsgemäß fehl, solange eigene Änderungen noch nicht
  veröffentlicht sind.
- Das Spiel lädt live ohne Fehler, kein Request verlässt die Adresse, „Neues
  Spiel“ öffnet das Anlegen.

Die Prüfung läuft automatisch nach jedem Deploy, jede Nacht und auf Knopfdruck
über den Workflow `.github/workflows/live-check.yml` (Actions, „Live-Check“,
„Run workflow“).

## Veröffentlichung

Der Workflow in `.github/workflows/ci.yml` läuft bei jedem Push und Pull
Request. Bei einem Push auf `main` wird nach bestandenen Tests der Ordner
`public/` automatisch auf GitHub Pages veröffentlicht. Schlägt ein Test fehl
oder wurde `VERSION` in `public/sw.js` nicht hochgezählt, wird nicht deployt.
Nach dem Deploy läuft die Live-Prüfung gegen die veröffentlichte Seite.

Die verwendeten GitHub Actions sind auf Commit-SHAs festgenagelt, damit ein
kompromittiertes Action-Release nicht unbemerkt etwas anderes veröffentlichen
kann. Dependabot (`.github/dependabot.yml`) hält die SHAs und die
Test-Werkzeuge wöchentlich aktuell.

Die Domain `slfx.9xb.de` steht in `public/CNAME`, `index.html` (Canonical, Open
Graph), `robots.txt`, `playwright.live.config.js` und dieser README; die
Kontaktadresse `slfx@9xb.de` in `impressum.html`, `SECURITY.md` und dieser README.

## Lizenz

[MIT](LICENSE)
