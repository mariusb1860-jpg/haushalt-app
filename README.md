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
- `tests/`: automatische Tests für `tasks.js`
