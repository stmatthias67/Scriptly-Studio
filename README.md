# Scriptly Studio
 
Ein deutschsprachiges, lokal speicherndes Papier- und Handschriftatelier. React 19, TypeScript und Vite; die vorhandene Express/tRPC/Drizzle-Infrastruktur bleibt als kompatible Grundlage für spätere Serverfunktionen erhalten, wird von der Anwendung jedoch nicht benötigt. Es gibt keine Anmeldung oder vorgetäuschte Cloud-Synchronisierung.

## Starten

Node.js 22 oder neuer und pnpm 10.18.0 verwenden. `pnpm install --frozen-lockfile` installiert die gebundenen Abhängigkeiten. `pnpm dev:static` startet das Studio auf Port 3000. Der Port kann außerhalb der verwalteten Vorschau mit der Umgebungsvariable `PORT` gesetzt werden.

`pnpm build:static` erzeugt die statische Website unter `dist/public`. `pnpm check` führt die TypeScript-Prüfung aus; `pnpm test` startet alle 25 Modul- und Infrastrukturtests. Für einen lokalen Produktionsblick nach dem Build: `pnpm exec vite preview --host 0.0.0.0 --port 3000 --strictPort`.

Die unveränderten Befehle `pnpm dev`, `pnpm build` und `pnpm start` beziehen sich auf die vorbereitete Express-Infrastruktur. Für diese lokale Anwendung sind die statischen Befehle empfohlen; Server- und Datenbankdienste sind nicht aktiviert.

## Dokumente automatisch auf Papier setzen

Über „Neues Dokument“ öffnet sich zuerst der blattfreie Generator. Dort werden Dokumentname, kompletter Text, Handschrift, Schriftfarbe, Größe und Papier ausgewählt. „Generieren“ erstellt daraus ein oder mehrere Dokumentseiten und öffnet anschließend den bestehenden Editor. Bei linierten Blättern wird die Textzeilenhöhe aus dem echten Linienabstand berechnet; Textposition und Zeilenhöhe werden so gesetzt, dass jede Zeile auf der ausgewählten Linie sitzt. Der Export nutzt denselben Renderer und erzeugt eine PDF, die in GoodNotes importiert werden kann.

## Bedienung

Unter „Schrift erstellen“ lassen sich 90 Groß-/Kleinbuchstaben, Zahlen, deutsche Sonderzeichen, Satzzeichen und Symbole zeichnen. Maus, Finger und Stift werden über Pointer-Ereignisse unterstützt. Stift, Strichradierer, Hilfslinien und Rückgängig/Wiederholen sind echte Zeichenwerkzeuge. Pro Zeichen sind bis zu drei Varianten möglich. Striche werden nach jeder Geste gespeichert; Schriftname und Metriken ebenfalls automatisch. Der OTF-Download erstellt eine echte, installierbare OpenType-Schrift mit geschlossenen Konturen und Unicode-Zuordnung. Fehlende Zeichen sind ausdrücklich sichtbar. Die erste Variante wird in die OTF-Datei geschrieben; die veränderliche Mischung weiterer Varianten steht in der Schriftprobe zur Verfügung, nicht im Dokumenteditor oder als OpenType-Kontextfunktion.

Dokumente bestehen aus getrennten Seiten mit frei beweglichen und skalierbaren Texten, Bildern und Formelementen. Texte, Überschriften, Listen, Checklisten und Daten können hinzugefügt werden. Die Eigenschaften enthalten Schrift, Farbe, Größe, Abstände, Ausrichtung, Fett/Kursiv, Rotation, Position und Größe. Seiten lassen sich hinzufügen, kopieren, löschen und umsortieren. Überlauf wird anhand tatsächlicher Browser-Schriftmaße angezeigt und kann manuell auf eine neue Seite fortgesetzt werden; es gibt keinen automatischen seitenübergreifenden Textfluss.

Im Papierstudio stehen elf Papiertypen, A4, A5, Letter, Hoch-/Querformat und eigene Formate von 50 bis 600 mm zur Verfügung. Farben, Linien-/Rasterabstände, Stärke, Ränder, Kopf-/Fußzeilen, Umrandung, Papierstruktur und Seitennummern sind einstellbar. Eigene Kombinationen können als Vorlagen gespeichert, bearbeitet, kopiert, gelöscht und favorisiert werden. Vorlagen lassen sich auf einzelne oder alle Dokumentseiten anwenden.

PDF, PNG und JPEG verwenden denselben Canvas-Renderer wie die Vorschau. PDFs bewahren die Original-Millimetermaße, auch bei verschiedenen Formaten innerhalb eines Dokuments. Die Inhalte sind rasterisiert, nicht als auswählbarer Vektortext gespeichert. 96, 150 und 300 dpi sind wählbar, innerhalb eines Sicherheitslimits von 16 Millionen Pixeln pro Seite. Bei Bildformaten wird jede gewählte Seite einzeln heruntergeladen; manche Browser fragen nach einer Erlaubnis für mehrere Downloads. Beschädigte Bilddaten führen zu einer verständlichen Exportfehlermeldung, nicht zu einem scheinbar vollständigen Download. PDF-Dateien können in GoodNotes importiert werden; es handelt sich nicht um proprietäre GoodNotes-Projektdateien. Ein direkter Import in einer GoodNotes-Installation war in dieser Umgebung nicht verfügbar.

## Speicherung und Datenschutz

IndexedDB speichert Dokumente, Seiten, Elemente, Zeichnungen und Vorlagen. Kleine Oberflächen- und Dokumentstandards liegen in localStorage. Änderungen werden nach 450 ms Schreibpause gespeichert; Fehler sind im Kopfbereich sichtbar und können erneut versucht werden. Daten sind an Browser und Website-Ursprung gebunden. Browserdatenlöschung, privater Modus, ein anderer Browser oder ein anderes Gerät können sie unzugänglich machen. Regelmäßige Sicherungen unter „Einstellungen“ sind daher wichtig.

Sicherungsdateien sind versionierte JSON-Dateien mit Struktur- und Wertevalidierung. Eine Wiederherstellung ersetzt die lokalen Daten nach ausdrücklicher Bestätigung. Importe sind auf 30 MB pro Sicherung und 5 MB pro PNG/JPEG/WebP-Bild begrenzt. Es gibt keinen PDF-Import zum nachträglichen Bearbeiten fremder PDFs.

## Struktur und Anpassung

`client/src/studio/types.ts` bündelt die Modelle. `store.tsx` und `storage.ts` verwalten Zustand und Persistenz. `FontStudio.tsx` und `font-engine.ts` erzeugen Schriften. `Editor.tsx`, `render.ts`, `PaperPreview.tsx` und `ExportDialog.tsx` teilen sich Layout und Ausgabe. `PaperStudio.tsx` und `PaperControls.tsx` gestalten Vorlagen. Deutsche Texte liegen zentral unter `client/src/studio/locales/`; Styling liegt in `index.css` und bereichsspezifischen CSS-Dateien.

Die Wortmarke lässt sich in `studio/components.tsx` austauschen, Titel und Sprachtexte in `locales/app.ts` und `client/index.html`. `client/public/favicon.svg` enthält das austauschbare Markenzeichen; `app.config.ts` enthält das verwaltete Projektlogo. Eine neue Sprache kann über entsprechende Sprachmodule und deren zentralen Import ergänzt werden.

## Browser-Funktionstests

`pnpm exec playwright install chromium` installiert den Testbrowser. Bei laufendem `pnpm dev:static` prüfen `node tests/core-workflow.mjs` und `node tests/edge-workflow.mjs` Zeichnungen, Undo/Redo, Wiederöffnen, Textbearbeitung, Seitenreihenfolge, echte OTF/PDF/PNG/JPEG-Downloads, Hell/Dunkel, mobile Navigation, Vorlagenverwaltung, Sicherungswiederherstellung und simulierte Speicher-/Exportfehler. Testdaten liegen ausschließlich in eigenen isolierten Browserkontexten. Ergebnisse und erzeugte Dateien werden unter `artifacts/` abgelegt und nicht versioniert.

Nach `pnpm build:static` prüft `node tests/production-check.mjs` den gebauten Produktionsstand, den dynamischen PDF-Import, die freie Akzentfarbe und die Fehlerseite. Dafür wird ein kurzlebiger lokaler Prüfserver gestartet und anschließend wieder beendet.
