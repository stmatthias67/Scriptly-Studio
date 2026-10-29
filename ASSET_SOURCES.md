# Schriftressourcen und technische Quellen

Die Oberfläche verwendet lokal mitgelieferte Schriftdateien der Pakete `@fontsource/manrope`, `@fontsource/lora` und `@fontsource/caveat`, jeweils Version 5.3.0. Caveat dient als ausdrücklich bezeichnete Beispielhandschrift, nicht als vom Nutzer erzeugte Schrift. Die Lizenztexte liegen in den installierten Fontsource-Paketen; es werden keine externen Google-Fonts-Anfragen während der Nutzung benötigt.

Caveat-Quelle: https://github.com/googlefonts/caveat und https://fonts.google.com/specimen/Caveat. Die geöffnete Projektseite beschreibt Caveat als Schrift von Pablo Impallari und dokumentiert die Schriftquellen.

OpenType.js-Dokumentation: https://github.com/nodebox/opentype.js/ und https://opentype.js.org/. Die geöffnete Dokumentation beschreibt die Erzeugung von `Glyph`/`Path`/`Font`, notwendige `.notdef`-Glyphen, Unicode-Zuordnungen und die Serialisierung als reale OTF-Datei mit `toArrayBuffer()`. Verwendet wird das Paket `opentype.js` 2.0.0 mit ESM-Namespace-Import.

Es wurden keine Stockfotos oder generierten Schmuckbilder eingebaut. Papiervorschauen werden direkt mit dem tatsächlichen Seitenrenderer des Produkts erzeugt. Das Feder-Markenzeichen ist ein austauschbares SVG; Oberflächensymbole stammen aus der bereits vorhandenen Lucide-Bibliothek.
