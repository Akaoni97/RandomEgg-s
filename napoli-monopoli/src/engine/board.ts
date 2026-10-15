import type { ColorGroup, TileDef } from './types';

const P = (
  index: number,
  name: string,
  short: string,
  group: ColorGroup,
  price: number,
  rent: number[],
  houseCost: number,
  diorama: string,
  flavor: string,
): TileDef => ({ index, kind: 'property', name, short, group, price, rent, houseCost, diorama, flavor });

const S = (index: number, name: string, flavor: string): TileDef => ({
  index,
  kind: 'station',
  name,
  short: name.replace('Funicolare ', 'Funic. '),
  price: 200,
  diorama: 'funicolare',
  flavor,
});

export const BOARD: TileDef[] = [
  { index: 0, kind: 'via', name: 'Partenza dalla Stazione Centrale', short: 'VIA', flavor: "Ritiri 200 ₵… se non te l'hanno già scippate." },
  P(1, 'Scampia', 'Scampia', 'marrone', 60, [2, 10, 30, 90, 160, 250], 50, 'vele', "Le Vele: vista mare, se sali sul tetto e strizzi gli occhi."),
  { index: 2, kind: 'smorfia', name: "'A Smorfia", short: "'A Smorfia", flavor: 'Pesca un biglietto e sogna i numeri.' },
  P(3, 'Secondigliano', 'Secondigl.', 'marrone', 60, [4, 20, 60, 180, 320, 450], 50, 'palazzone', 'Qui il navigatore ti dice: "Ricalcolo… anzi no, scappa."'),
  { index: 4, kind: 'tax', name: 'Il Pizzo', short: 'Il Pizzo', tax: 200, flavor: "Paga 200 ₵. Non è una tassa, è un'offerta spontanea." },
  S(5, 'Funicolare Centrale', 'Sale e scende. Quando non sciopera.'),
  P(6, 'Forcella', 'Forcella', 'azzurro', 100, [6, 30, 90, 270, 400, 550], 50, 'bancarella', 'Rolex a 20 euro. Originali, giura.'),
  { index: 7, kind: 'malocchio', name: 'Malocchio', short: 'Malocchio', flavor: "Qualcuno t'ha guardato storto." },
  P(8, 'Rione Sanità', 'Sanità', 'azzurro', 100, [6, 30, 90, 270, 400, 550], 50, 'chiesa', "Il quartiere di Totò. Qui pure 'e muorte so' simpatici."),
  P(9, 'Duchesca', 'Duchesca', 'azzurro', 120, [8, 40, 100, 300, 450, 600], 50, 'bancarella', 'Mercato: trovi tutto, pure il tuo motorino rubato.'),
  { index: 10, kind: 'jail', name: 'Poggioreale', short: 'Poggioreale', flavor: 'In visita… per ora.' },
  P(11, 'Quartieri Spagnoli', 'Quartieri', 'rosa', 140, [10, 50, 150, 450, 625, 750], 100, 'vicolo', 'Vicoli stretti, motorini larghi, panni stesi ovunque.'),
  { index: 12, kind: 'utility', name: 'Allaccio Abusivo ENEL', short: 'ENEL abus.', price: 150, diorama: 'enel', flavor: 'La luce è gratis. Pagare è da fessi.' },
  P(13, 'Pignasecca', 'Pignasecca', 'rosa', 140, [10, 50, 150, 450, 625, 750], 100, 'pescheria', "Il pesce è fresco: ti guarda ancora male."),
  P(14, 'Montesanto', 'Montesanto', 'rosa', 160, [12, 60, 180, 500, 700, 900], 100, 'vicolo', 'Scale, scale e ancora scale. Il cardiologo ringrazia.'),
  S(15, 'Funicolare di Chiaia', 'Per salire al Vomero senza sudare la camicia.'),
  P(16, 'Spaccanapoli', 'Spaccanapoli', 'arancione', 180, [14, 70, 200, 550, 750, 950], 100, 'chiesa', 'La spacca in due. Come la suocera.'),
  { index: 17, kind: 'smorfia', name: "'A Smorfia", short: "'A Smorfia", flavor: 'Pesca un biglietto e sogna i numeri.' },
  P(18, 'San Gregorio Armeno', 'S. Gregorio', 'arancione', 180, [14, 70, 200, 550, 750, 950], 100, 'presepe', 'Statuine di tutti: santi, calciatori e pure tuo cugino.'),
  P(19, 'Via Tribunali', 'Tribunali', 'arancione', 200, [16, 80, 220, 600, 800, 1000], 100, 'pizzeria', "La fila per la pizza è più lunga della fila per l'INPS."),
  { index: 20, kind: 'caffe', name: 'Il Caffè Sospeso', short: 'Caffè Sospeso', flavor: 'Prendi tutto il piatto. Offre la città.' },
  P(21, 'Piazza Garibaldi', 'P.za Garibaldi', 'rosso', 220, [18, 90, 250, 700, 875, 1050], 150, 'piazza', "Benvenuti a Napoli: tieni stretto 'o portafoglio."),
  { index: 22, kind: 'malocchio', name: 'Malocchio', short: 'Malocchio', flavor: "Qualcuno t'ha guardato storto." },
  P(23, 'Corso Umberto', 'C.so Umberto', 'rosso', 220, [18, 90, 250, 700, 875, 1050], 150, 'palazzone', 'Il Rettifilo: dritto come la parola di un politico.'),
  P(24, 'Via Toledo', 'Via Toledo', 'rosso', 240, [20, 100, 300, 750, 925, 1100], 150, 'negozi', 'Shopping, sfogliatelle e borseggiatori artistici.'),
  S(25, 'Funicolare di Montesanto', 'La più popolare. Pure troppo.'),
  P(26, 'Vomero', 'Vomero', 'giallo', 260, [22, 110, 330, 800, 975, 1150], 150, 'villa', '"Noi del Vomero non siamo napoletani, siamo vomeresi."'),
  P(27, 'Arenella', 'Arenella', 'giallo', 260, [22, 110, 330, 800, 975, 1150], 150, 'palazzone', 'Parcheggio trovato nel 2003. Mai più spostata la macchina.'),
  { index: 28, kind: 'utility', name: 'Acqua del Serino', short: 'Acqua Serino', price: 150, diorama: 'acqua', flavor: "L'acqua più buona del mondo. Il caffè lo sa." },
  P(29, 'Via Scarlatti', 'Via Scarlatti', 'giallo', 280, [24, 120, 360, 850, 1025, 1200], 150, 'negozi', 'Signore in pelliccia ad agosto.'),
  { index: 30, kind: 'gotojail', name: "T'hanno pigliato!", short: "T'hanno pigliato", flavor: 'Dritto a Poggioreale. Senza passare dal VIA.' },
  P(31, 'Chiaia', 'Chiaia', 'verde', 300, [26, 130, 390, 900, 1100, 1275], 200, 'baretto', 'Aperitivo da 15 euro e la Porsche del papà.'),
  P(32, 'Lungomare Caracciolo', 'Lungomare', 'verde', 300, [26, 130, 390, 900, 1100, 1275], 200, 'lungomare', "Il lungomare più bello del mondo. Lo dice pure tua nonna."),
  { index: 33, kind: 'smorfia', name: "'A Smorfia", short: "'A Smorfia", flavor: 'Pesca un biglietto e sogna i numeri.' },
  P(34, 'Mergellina', 'Mergellina', 'verde', 320, [28, 150, 450, 1000, 1200, 1400], 200, 'chalet', 'Frutta di mare e coppetta allo Chalet Ciro.'),
  S(35, 'Funicolare di Mergellina', 'Porta a Posillipo. Ai poveri fa solo vedere.'),
  { index: 36, kind: 'malocchio', name: 'Malocchio', short: 'Malocchio', flavor: "Qualcuno t'ha guardato storto." },
  P(37, 'Posillipo', 'Posillipo', 'blu', 350, [35, 175, 500, 1100, 1300, 1500], 200, 'villa', 'Ville con piscina e vista. Il mutuo pure ha la vista.'),
  { index: 38, kind: 'tax', name: 'Il Parcheggiatore Abusivo', short: 'Parcheggiatore', tax: 100, flavor: '"Dottò, so\' dduje euro… facit vuje." Facciamo 100.' },
  P(39, 'Stadio Diego Armando Maradona', 'Stadio Maradona', 'blu', 400, [50, 200, 600, 1400, 1700, 2000], 200, 'stadio', 'Il tempio. Qui si prega in curva.'),
];

export const GROUP_TILES: Record<ColorGroup, number[]> = {
  marrone: [1, 3],
  azzurro: [6, 8, 9],
  rosa: [11, 13, 14],
  arancione: [16, 18, 19],
  rosso: [21, 23, 24],
  giallo: [26, 27, 29],
  verde: [31, 32, 34],
  blu: [37, 39],
};

export const GROUP_COLORS: Record<ColorGroup, string> = {
  marrone: '#8a4b2a',
  azzurro: '#6fc8f0',
  rosa: '#e85a9c',
  arancione: '#f39321',
  rosso: '#e0262f',
  giallo: '#f6d22e',
  verde: '#2f9e4f',
  blu: '#1f4fb5',
};

export const STATION_TILES = [5, 15, 25, 35];
export const UTILITY_TILES = [12, 28];
export const JAIL_INDEX = 10;
export const GO_SALARY = 200;
export const START_MONEY = 1500;
export const JAIL_FINE = 50;
export const CORNO_PRICE = 30;
/** tiles on the side facing the volcano */
export const VESUVIO_SIDE = [21, 22, 23, 24, 25, 26, 27, 28, 29];

export const isOwnable = (t: TileDef) => t.kind === 'property' || t.kind === 'station' || t.kind === 'utility';

export const SMORFIA: Record<number, string> = {
  1: "L'Italia",
  2: "'A piccerella",
  3: "'A jatta",
  4: "'O puorco",
  5: "'A mano",
  6: "Chella che guarda 'nterra",
  7: "'O vasetto",
  8: "'A Maronna",
  9: "'A figliata",
  10: "'E fasule",
  11: "'E suricille",
  12: "'E surdate",
};

export const SMORFIA_JOKE: Record<number, string> = {
  2: 'La bambina. Tienila lontana dal motorino di Ciro.',
  3: 'La gatta. Frettolosa, fa i figli ciechi.',
  4: "Il porco! Offri un caffè a tutti: 10 ₵ a testa, tirchio.",
  5: 'La mano. Quella di Totò ne ha tre dita, quindi fai i conti.',
  6: "Quella che guarda a terra. Sì, proprio quella. Comportati bene, porco.",
  7: 'Il vasetto. Di ragù, si spera.',
  8: 'La Madonna! Benedizione: +20 ₵.',
  9: 'La figliata. Auguri e figli maschi, dice nonna.',
  10: "I fagioli. Stasera la stanza la apri tu.",
  11: "I topolini! Si mangiano 1 ₵ per ogni basso che possiedi.",
  12: 'I soldati. Tranquillo, non vengono per te. Forse.',
};
