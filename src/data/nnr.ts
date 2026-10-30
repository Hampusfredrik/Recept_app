// Referensintag per dag för stapeln "Andel av dagligt referensintag (NNR)".
// Värdena är de som designen använder. Kontroll mot NNR 2023:
//  - Vitamin D 10 µg, vitamin C 95 mg, kalcium 950 mg, jod 150 µg och selen 75 µg
//    stämmer med NNR 2023 för kvinnor 25–50 år (Helsedirektoratets jämförelsetabell).
//    För män anges vitamin C 110 mg och selen 90 µg.
//  - Vitamin B12 (4 µg), folat (330 µg) och järn (9 mg) är INTE verifierade.
//    Kontrollera mot tabellerna i NNR 2023 (pub.norden.org/nord2023-003) innan de används skarpt.
export const NNR: { key: string; label: string; unit: string; ref: number }[] = [
  { key: 'vitd', label: 'Vitamin D', unit: 'µg', ref: 10 },
  { key: 'b12', label: 'Vitamin B12', unit: 'µg', ref: 4 },
  { key: 'vitc', label: 'Vitamin C', unit: 'mg', ref: 95 },
  { key: 'folate', label: 'Folat', unit: 'µg', ref: 330 },
  { key: 'iron', label: 'Järn', unit: 'mg', ref: 9 },
  { key: 'calcium', label: 'Kalcium', unit: 'mg', ref: 950 },
  { key: 'iodine', label: 'Jod', unit: 'µg', ref: 150 },
  { key: 'selenium', label: 'Selen', unit: 'µg', ref: 75 },
];
