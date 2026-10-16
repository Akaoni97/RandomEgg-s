import type { PawnId } from './types';

export interface PawnDef {
  id: PawnId;
  name: string;
  color: string;
  accent: string;
  emoji: string;
  power: string;
  powerText: string;
  bio: string;
}

export const PAWNS: Record<PawnId, PawnDef> = {
  ciro: {
    id: 'ciro',
    name: 'Ciro Esposito',
    color: '#2a9df4',
    accent: '#ffffff',
    emoji: '🛵',
    power: 'Senza casco',
    powerText:
      'Una volta per giro tira 3 dadi e scarta quello che non gli piace. Ma c\'è il 30% che lo ferma la Municipale (50 ₵ di multa). +1 negli scippi.',
    bio: "Spaccone, sempre di fretta, sul SH in tre senza casco. \"Fratm\" ogni due parole.",
  },
  toto: {
    id: 'toto',
    name: 'Totò Tredita',
    color: '#7b4bd1',
    accent: '#f6d22e',
    emoji: '🎩',
    power: "'O Pacco",
    powerText: 'Maestro del pacco: quando rifila un mattone lo scoprono solo il 30% delle volte (gli altri il 50%). E su ogni affitto tratta: "Siamo uomini o caporali?" e paga il 10% in meno.',
    bio: 'Truffatore gentiluomo con tre dita e il borsello. Parla forbito e sbaglia tutte le parole.',
  },
  gigi: {
    id: 'gigi',
    name: 'Luigi Gigi',
    color: '#e0262f',
    accent: '#2f9e4f',
    emoji: '🍕',
    power: 'Sfornata',
    powerText: 'Ogni volta che passa dal VIA prende 25 ₵ in più, perché la pizza la mangiano tutti.',
    bio: "Una margherita con le gambe e il cappello da pizzaiolo. Permaloso: guai a chi nomina l'ananas.",
  },
  gennaro: {
    id: 'gennaro',
    name: 'Gennaro San',
    color: '#f2b21b',
    accent: '#b3122e',
    emoji: '🙏',
    power: 'Il Miracolo',
    powerText:
      "Annulla un evento negativo (carta o eruzione) e l'ampolla si ricarica ogni 3 passaggi dal VIA, come il miracolo vero che arriva tre volte l'anno. Ma se l'ampolla non si scioglie (1 su un dado) è tragedia: succede tutto e paga pure 100 ₵.",
    bio: 'Statuina di San Gregorio Armeno con l\'ampolla che brilla. Benedice e maledice con la stessa voce.',
  },
};

export const PAWN_ORDER: PawnId[] = ['ciro', 'toto', 'gigi', 'gennaro'];
