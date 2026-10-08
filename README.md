# Haushalt

Kleine Web-App (PWA) für Haushaltsaufgaben: Was heute dran ist, abhaken, fertig.

## Online

https://mariusb1860-jpg.github.io/haushalt-app/

Auf dem Android-Handy in Chrome öffnen, Menü (⋮) → „App installieren“ bzw. „Zum Startbildschirm hinzufügen“.

## Am PC starten

```
python -m http.server 8000 --bind 127.0.0.1
```

Dann im Browser `http://127.0.0.1:8000` öffnen.
Zum Testen eines anderen Tages: `http://127.0.0.1:8000/?today=2026-10-15`.

## Tests

```
node --test
```

## Dateien

- `index.html`: Grundgerüst der Seite
- `style.css`: Aussehen
- `tasks.js`: Rechenlogik (wann ist eine Aufgabe fällig)
- `app.js`: Anzeige, Abhaken, Speichern im Browser (`localStorage`)
- `reward.js`: Belohnungsbild, nur auf dem Gerät gespeichert (IndexedDB), nie hochgeladen
- `manifest.webmanifest`: Name, Icon, Farben, damit sich die Seite als App installieren lässt
- `sw.js`: Service Worker, hält eine Kopie der App für den Offline-Betrieb
- `icons/`: App-Icons
- `push.js`: Erinnerungen einschalten, Stand („so viele offen“) an den Push-Server melden
- `tests/`: automatische Tests für `tasks.js`
- `push-server/`: kleiner Server (Cloudflare Worker) für die Erinnerungen

## Erinnerungen (Push)

Um 20:30 und 22:30 Uhr (Berlin) schickt der Push-Server eine Nachricht, wenn heute noch Aufgaben offen sind.

- Die App meldet dem Server nur Datum und Anzahl offener Aufgaben. Keine Aufgabennamen, kein Bild.
- Der Server merkt sich das Push-Abo des Handys und einen Schlüssel (nur als Hash). Wer den Schlüssel nicht hat, kann nichts ändern.
- Die Nachricht hat keinen Inhalt; den Text wählt der Service Worker auf dem Handy (`sw.js`).

Einrichten (einmalig, im Ordner `push-server`):

```
npm install
npx wrangler login
npx wrangler kv namespace create STATE --update-config
npx wrangler secret put VAPID_PRIVATE_KEY
npx wrangler deploy
```

Danach die Worker-Adresse in `push.js` (`PUSH_SERVER`) eintragen.

Lokal testen: `npx wrangler dev --test-scheduled` (privater Schlüssel in `push-server/.dev.vars`, nicht im Repo).

Schlüssel vergessen (z. B. App neu installiert): `npx wrangler kv key delete keyHash --binding STATE --remote`, danach in der App „Erinnerungen einschalten“.
