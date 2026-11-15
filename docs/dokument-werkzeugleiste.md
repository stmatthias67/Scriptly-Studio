# Dokument-Werkzeugleiste (entfernt, für späteren Wiedereinbau)

Diese Leiste stand im Dokument-Editor über der Seite. Sie ist aus der Oberfläche
entfernt; die Beschreibung hier hält fest, was jeder Knopf getan hat, damit die
Funktionen an anderer Stelle wieder eingebaut werden können.

Der vollständige alte Code steht in der Git-Historie: Commit `f781146`,
Datei `client/src/studio/Editor.tsx`, Funktionen `addText`, `textForTool`,
`addGraphic`, `standardElement`, `selectImage` und `importImage` sowie das
Markup `<div className="editor-toolbar">`.

## Gemeinsames Verhalten

- Jeder Knopf fügt der **aktuell geöffneten Seite** ein neues Element hinzu und
  wählt es sofort aus, damit rechts die Eigenschaften erscheinen.
- Der Schritt landet im Rückgängig-Verlauf (Strg/Cmd+Z).
- Neue Elemente rutschen leicht nach unten, damit sie sich nicht genau
  überdecken: Textelemente um 18 px pro vorhandenem Element (Start `x 80`,
  `y 90`), Grafiken um 14 px (Start `x 90`, `y 110`).
- Schrift, Schriftgröße, Farbe und Zeilenhöhe kommen aus den Standardwerten in
  den Einstellungen (`defaultFontId`, `defaultFontSize`, `defaultColor`,
  `defaultLineHeight`).
- Alle Elemente sind danach verschiebbar und in der Größe änderbar (außer sie
  werden fixiert), lassen sich duplizieren (Strg/Cmd+D) und löschen (Entf).

## Gruppe „Text“

Alle Text-Knöpfe erzeugen ein Element vom Typ `text` (580 × 150 px, linksbündig,
Zeichenabstand 0, Absatzabstand 0) mit einem vorgefüllten Text.

| Knopf               | Symbol           | Vorgefüllter Text                                                                | Abweichungen vom Standard                                          |
| ------------------- | ---------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Text                | Textcursor       | „Deine Gedanken beginnen hier.“                                                  | keine                                                              |
| Überschrift (H1)    | `Heading1`       | „Eine Überschrift“                                                               | Schriftgröße = max(32, Standardgröße × 1,65), **fett**, Höhe 80 px |
| Untertitel (H2)     | `Heading2`       | „Ein Untertitel“                                                                 | Schriftgröße = max(23, Standardgröße × 1,18), Höhe 70 px           |
| Liste (Stichpunkte) | `List`           | „• Erster Gedanke / • Zweiter Gedanke / • Dritter Gedanke“ (eine Zeile je Punkt) | Höhe 150 px                                                        |
| Checkliste          | `ClipboardCheck` | „☐ Eine Aufgabe / ☐ Noch eine Aufgabe / ☐ Erledigt“                              | Höhe 150 px                                                        |
| Datum               | `Rows3`          | heutiges Datum, lang auf Deutsch, z. B. „14. November 2026“                      | Schriftgröße = max(18, Standardgröße × 0,85), Höhe 45 px           |

Hinweise:

- Liste und Checkliste sind **reiner Text**: Die Zeichen „•“ und „☐“ stehen im
  Text. Ein Häkchen lässt sich dort nicht anklicken; abhaken heißt „☐“ durch
  „☑“ ersetzen.
- Damit „•“, „☐“ und „☑“ in einer eigenen Handschrift erscheinen, müssen sie in
  der Schrift gezeichnet sein, sonst fällt der Renderer auf Caveat zurück.

## Gruppe „Element hinzufügen“

Grafiken erzeugen Elemente mit den Standardmaßen 230 × 96 px. Linienstärke =
Schriftgröße ÷ 15, begrenzt auf 1 bis 8 px. Die Farbe ist die Standardfarbe.

| Knopf            | Typ         | Standardgröße | Aussehen                                                                                                                                                                                        |
| ---------------- | ----------- | ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Bild             | `image`     | 240 × 180 px  | Öffnet die Dateiauswahl (PNG, JPEG, WebP, höchstens 5 MB). Das Bild wird als Data-URL im Dokument gespeichert und in den Rahmen gestreckt. Falscher Typ oder zu groß ergibt eine Fehlermeldung. |
| Rechteck         | `rectangle` | 230 × 96 px   | Rahmen in der Farbe, Füllung in derselben Farbe mit 10 % Deckkraft                                                                                                                              |
| Ellipse          | `ellipse`   | 230 × 96 px   | Ellipse im Rahmen, gleiche Kontur und Füllung wie das Rechteck                                                                                                                                  |
| Linie            | `line`      | 230 × 12 px   | Waagerechte Linie durch die Mitte, runde Enden                                                                                                                                                  |
| Pfeil            | `arrow`     | 230 × 36 px   | Waagerechte Linie mit Pfeilspitze rechts (Spitze mindestens 7 px oder 3 × Linienstärke)                                                                                                         |
| Kontrollkästchen | `checkbox`  | 28 × 28 px    | Quadrat mit hellem Grund; wenn `checked` gesetzt ist, mit Haken. Startet leer                                                                                                                   |
| Markierung       | `highlight` | 240 × 32 px   | Gefüllte Fläche in Gelb `#e8bd4b` mit 22 % Deckkraft, wie ein Textmarker                                                                                                                        |

Alle Grafiken lassen sich drehen und werden in Vorschau und Export vom selben
Renderer gezeichnet (`drawGraphicElement` in `render.ts`). Der Renderer, die
Typen und die Eigenschaften-Leiste bleiben erhalten, damit bestehende Dokumente
mit solchen Elementen weiter korrekt angezeigt und bearbeitet werden.

## Weiterer Knopf in der Leiste

- **Alle Seiten / Seite bearbeiten**: schaltet zwischen der Seitenübersicht
  (alle Seiten als Vorschau) und der Bearbeitung einer Seite um. Dieser Knopf
  ist **nicht** entfallen, er sitzt jetzt oben rechts neben „Exportieren“.
