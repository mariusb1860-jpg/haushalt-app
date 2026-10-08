# Haushalt

Kleine Web-App (PWA) für Haushaltsaufgaben: Was heute dran ist, abhaken, fertig.

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
- `tests/`: automatische Tests für `tasks.js`
