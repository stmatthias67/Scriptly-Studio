# Scriptly Studio – Abschlussbericht

## Ausgangslage und ersetzter Code

Im zugänglichen Projektbereich lag kein Quellcode der früheren Scriptly-Anwendung vor. Deshalb wurde eine neue lauffähige Umsetzung aufgebaut, nicht ein unbekannter alter Projektstand verändert. Die bereitgestellte Beispieloberfläche mit `Home`, `ComponentShowcase`, alten Dashboard-, Chat-, Karten- und Dialogkomponenten wurde entfernt. React-Einstieg, App-Navigation, Hauptstyles und Fehlerseite wurden neu umgesetzt. Vite, TypeScript, bestehende UI-Bibliotheken und die vorbereitete Server-Infrastruktur blieben erhalten. Das Studio selbst arbeitet ohne Backend oder Anmeldung.

## Neue Module und Funktionen

Die Anwendung ist in `client/src/studio/` aufgeteilt: Datenmodelle, IndexedDB-Speicherung, Zustand/Autosave, Übersicht, Dokumentensammlung, Zeichenstudio, echte OTF-Erzeugung, mehrseitiger Editor, gemeinsamer Seitenrenderer, PDF-/Bildexport, Papierstudio, Vorlagen und Einstellungen. Deutsche Texte liegen in zentralen Sprachmodulen. Die Oberfläche bietet mobile Navigation, Hell/Dunkel, Akzentfarbe, Dichte, Seitenleistenverhalten und Dokumentstandards.

Der Kern ist funktional: 90 Zeichenslots einschließlich Umlauten und ß; Maus-/Touch-/Stiftzeichnung, Stärke, Strichradierer, Undo/Redo, Hilfslinien, individuelle Bearbeitung, Schriftmetriken, Zeichenvarianten und installierbare OTF-Dateien. Dokumente unterstützen mehrere Seiten, Textblöcke, Überschriften, Listen, Checklisten, Bilder und Formen, Auswahl, Verschieben, Skalieren, Formatieren und Seitenverwaltung. Elf Papiertypen, A4/A5/Letter/eigene Millimetermaße, Farb- und Rasterdetails, Kopf-/Fußzeilen, Textur und Seitennummern sind integriert. Vorlagen und Dokumente lassen sich verwalten, duplizieren, favorisieren und mit Bestätigung löschen. Lokales Autosave, geprüfte Sicherungen und Wiederherstellung sind implementiert.

## Bewusst begrenzte Erweiterungen

OTF-Dateien enthalten die erste Variante jedes Zeichens. Weitere Varianten werden in der Schriftprobe verteilt, nicht im Dokumenteditor oder Dokumentexport; automatische OpenType-Kontextvarianten/Ligaturen fehlen. Textüberlauf wird angezeigt und kann manuell auf eine neue Seite fortgesetzt werden; es gibt keinen automatischen seitenübergreifenden Textfluss.

PDFs bewahren Papiermaße und Darstellung, sind aber rasterisiert: kein auswählbarer Vektortext und kein PDF-Import zur nachträglichen Bearbeitung. GoodNotes erhält eine normale PDF, kein proprietäres Projekt. Ein tatsächlicher Import in der GoodNotes-App war hier nicht verfügbar. Eigene Papierlayouts basieren auf den angebotenen Parametern und freien Dokumentelementen, nicht auf einem gesonderten beliebigen Vorlagen-Layereditor. Cloud-Konten und geräteübergreifende Synchronisierung wurden bewusst nicht vorgetäuscht.

## Abhängigkeiten und Start

Neu hinzugefügt: `idb` 8.0.4, `opentype.js` 2.0.0, `jspdf` 4.2.1 und lokale Fontsource-Schriften Manrope/Lora/Caveat 5.3.0. Tests nutzen `@types/opentype.js` 1.3.10, `fake-indexeddb` 6.2.6 und Playwright 1.64.1. pnpm 10.18.0 und die Lockdatei binden die Installation. PDF-Code wird erst beim Export geladen; die Fontbibliothek wird separat ausgeliefert. Der Produktionsbuild enthält kein Bundle über 500 kB.

Start: `pnpm install --frozen-lockfile`, danach `pnpm dev:static`. Build: `pnpm build:static`. Prüfung: `pnpm check` und `pnpm test`. Weitere Nutzungs- und Entwicklerhinweise stehen in `README.md`.

## Nachgewiesene Ergebnisse

TypeScript-Prüfung und Produktionsbuild erfolgreich; **25 von 25 Modultests bestanden**. Beide reproduzierbaren Browserabläufe für Zeichnungen, Undo/Redo, Wiederöffnen, Textformatierung, Seitenreihenfolge, Vorlagenverwaltung, Sicherungen, mobile Navigation und Fehlerfälle sind bestanden. Ein unabhängiger read-only Integrationsprüfer wurde eingesetzt; bestätigte Probleme wurden behoben.

Auch der tatsächlich gebaute Produktionsstand wurde geprüft: deutscher Leerdaten-Start, Textbearbeitung, dynamischer PDF-Download, Kontrast bei frei gewählter weißer Akzentfarbe und die deutsche Fehlerseite sind bestanden.

Die OTF-Datei wurde unabhängig mit FontTools gelesen. PDF: zwei A4-Seiten, außerdem eine gemischte PDF mit A5 quer **210 × 148 mm** und einer eigenen Seite **160 × 240 mm**, unabhängig mit `pdfinfo` nachgemessen. PNG/JPEG-Dateien wurden mit Pillow validiert. Die mobile Ansicht wurde bei 390 px ohne horizontales Dokumentüberlaufen geprüft. Defekte Bilddaten verhindern einen scheinbar vollständigen Export; ein simulierter IndexedDB-Speicherfehler erzeugt den sichtbaren Fehlerstatus.

**Wichtig:** Alle Nutzerdaten bleiben an diesen Browser und den Website-Ursprung gebunden. Regelmäßig Sicherungen herunterladen; gelöschte Browserdaten oder ein anderes Gerät enthalten diese Arbeit nicht. Sicherungsimporte sind auf 30 MB, Bildimporte auf 5 MB, Renderseiten auf 16 Millionen Pixel begrenzt.
