# Scriptly Studio – Umsetzung

## Ausgangslage

Im ursprünglichen Arbeitsbereich sind nur die Anforderungsdatei und keine verknüpfte Website oder bestehende Anwendung verfügbar. Das neu initialisierte Projekt verwendet React 19, TypeScript 5.9, Vite 7, pnpm 10.18 und eine vorbereitete, nicht aktivierte Express/tRPC-Infrastruktur. Die Beispieloberfläche (`Home`, `App`, Einstiegspunkt und Standard-CSS) wird vollständig ersetzt. Konfiguration, Paketmanager, nützliche UI-Bibliotheken und Infrastruktur bleiben erhalten.

## Architektur

Eine wirklich funktionierende Local-first-Anwendung ohne vorgetäuschte Anmeldung oder Cloud-Synchronisierung. IndexedDB speichert Dokumente, Seiten, Elemente, Vorlagen und Handschriftprojekte, entprellt und mit sichtbarem Speicherstatus; kleine Einstellungen bleiben in localStorage. Datenexport als Sicherung schützt vor Browserdatenlöschung. Client-Routen ermöglichen direktes Öffnen aller Arbeitsbereiche.

`client/src/studio/types.ts` enthält gemeinsame typisierte Modelle; `store.tsx` übernimmt Datenzustand, IndexedDB und Einstellungen. `i18n.ts` bündelt deutsche Oberflächentexte. `components.tsx` enthält zugängliche gemeinsame Bedienelemente. `Dashboard`, `Documents` und `Settings` liefern Übersicht, Verwaltung und Personalisierung. `FontStudio.tsx` und `font-engine.ts` übernehmen Strichdaten, Glyphen und echte OTF-Generierung mit opentype.js. `Editor.tsx`, `render.ts` und `ExportDialog.tsx` teilen sich Seitenlayout und PDF-/PNG-/JPEG-Erzeugung. `PaperStudio.tsx` und `PaperControls.tsx` übernehmen genaue Formate und Vorlagen. Bestehende Start-/Buildkonfiguration bleibt funktionsfähig. Statische Auslieferung mit `pnpm dev:static` und `pnpm build:static`.

## Funktionsumfang

Schriftprojekte mit Zeichengruppen, Maus-/Touch-/Stifteingabe, Stift/Radierer, Undo/Redo, Hilfslinien, persistenten Zeichen, mehreren Varianten, Einstellmöglichkeiten, Vorschau, Warnungen zu fehlenden Zeichen und realen OTF-Dateien. Dokumente mit mehreren Seiten und frei positionierbaren Text-, Bild- und Formelementen; Bearbeitung, Duplizieren, Löschen, Größen-/Abstands-/Farb-/Ausrichtungs-/Rotationssteuerung, Seitenumsortierung und Undo/Redo. Papierstudio mit allen angeforderten Presets, benutzerdefinierten Millimetermaßen, Orientierung, Rändern, Farben und Mustern. Vorlagen verwalten und favorisieren. PDF-/PNG-/JPEG-Export mit Seiteauswahl, echten Dimensionen, Bildauflösung und Fehlermeldungen. GoodNotes-Hinweis: PDF, kein proprietäres GoodNotes-Projekt.

Automatischer Textfluss und typografisch ausgereifte OpenType-Kontextvarianten sind komplexe optionale Erweiterungen. Stattdessen werden Überläufe sichtbar angezeigt; weitere Seiten stehen direkt bereit. OTF exportiert die erste Glyphenvariante; Varianten im eigenen Editor können separat gerendert werden, nur wenn tatsächlich umgesetzt. Keine unimplementierten Bedienelemente oder falschen Downloads.

## Gestaltung – ruhiges Papieratelier

Die vom Nutzer vorgegebene minimalistische, elegante Richtung orientiert sich an zeitgenössischen Schweizer Editorial-Oberflächen mit warmer Materialität. Viel Weißraum, präzise Typografie, eine feste seitliche Navigation und asymmetrisch gewichtete Arbeitsbereiche statt eines gleichförmigen Verwaltungsrasters. Papierweiß und weiche steingraue Flächen halten die Oberfläche ruhig; ein dunkles Salbeigrün (#315c4c) kennzeichnet Handlung und Identität. Dezente Ocker-/Fliedertöne unterscheiden Inhalte, ohne Aufmerksamkeit zu stehlen.

Signatur: schräg angeschnittene Schriftproben auf echten Papiervorschauen, kleine Versal-Abschnittsmarken und eine gekapselte Feder als Markenzeichen. Manrope für die Oberfläche, Lora für redaktionelle Überschriften, Caveat ausschließlich als mitgelieferte Beispielhandschrift, klar von eigenen Fonts unterschieden. Die Wortmarke kombiniert eine eigene Feder-Marke mit `Scriptly` und einer kleinen `STUDIO`-Zeile. Positionierung: das persönliche digitale Papieratelier für Menschen, die ihre eigene Handschrift behalten wollen; ruhig, persönlich, präzise. Sprache: direkt und natürlich, etwa „Deine Gedanken. Deine Handschrift.“ und „Ein leeres Blatt voller Möglichkeiten.“

Interaktionen bleiben kurz und zurückhaltend: 160–220 ms für Fokus, Hover und Panels; kein automatisches Rotieren oder pulsierende Dekoration. Sichtbare Tastaturfokusse und echte Beschriftungen; mobile Navigation und stapelbare Einstellbereiche. Dunkelmodus verändert die Arbeitsoberfläche, nicht die tatsächliche Papierfarbe.
