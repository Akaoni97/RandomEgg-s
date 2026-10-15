import type { Deck } from './types';

export type CardEffect =
  | { kind: 'money'; amount: number }
  | { kind: 'payEach'; amount: number }
  | { kind: 'collectEach'; amount: number }
  | { kind: 'moveTo'; to: number; collectGo: boolean }
  | { kind: 'moveRel'; steps: number }
  | { kind: 'nearestStation' }
  | { kind: 'jail' }
  | { kind: 'skip'; turns: number }
  | { kind: 'conosco' }
  | { kind: 'corno' }
  | { kind: 'throwMalocchio' }
  | { kind: 'selfMalocchio' }
  | { kind: 'cugino' }
  | { kind: 'sciopero' }
  | { kind: 'vesuvio'; amount: number }
  | { kind: 'repairs'; perBasso: number; perPalazzo: number }
  | { kind: 'potToMe' };

export interface Card {
  id: string;
  deck: Deck;
  title: string;
  text: string;
  effect: CardEffect;
  negative: boolean;
}

const c = (deck: Deck, id: string, title: string, text: string, effect: CardEffect, negative = false): Card => ({
  id: `${deck}-${id}`,
  deck,
  title,
  text,
  effect,
  negative,
});

export const SMORFIA_CARDS: Card[] = [
  c('smorfia', 'lotto', 'Ambo secco!', "Hai vinto al lotto con i numeri della Smorfia del sogno di nonna. Ritira 200 ₵.", { kind: 'money', amount: 200 }),
  c('smorfia', 'parroco', 'Tripla fila benedetta', 'Hai parcheggiato in tripla fila davanti alla chiesa. Il parroco ti benedice comunque: +20 ₵.', { kind: 'money', amount: 20 }),
  c('smorfia', 'tedesco', "'O pacco al tedesco", "Fai 'o pacco a un turista tedesco: incassi 150 ₵. Sfaccimma, che talento.", { kind: 'money', amount: 150 }),
  c('smorfia', 'mammà', 'Mammà ha trovato le sigarette', 'Mammà ti ha trovato le sigarette nella giacca. Torna al VIA… di corsa, senza ritirare niente.', { kind: 'moveTo', to: 0, collectGo: false }, true),
  c('smorfia', 'cresima', 'La busta della cresima', "Tutti i parenti ti devono la busta per la cresima di tuo figlio: 25 ₵ da ciascuno, e guai a chi mette 10 euro.", { kind: 'collectEach', amount: 25 }),
  c('smorfia', 'conosco', 'Conosco a uno', "Tuo cugino conosce a uno che conosce a uno. Tieni questa carta: ti salva dal carcere, da un affitto o ti sistema un'asta.", { kind: 'conosco' }),
  c('smorfia', 'corno', "'O curniciello", "Nonna ti regala un corno rosso. Non è vero, ma ci credo. +1 Corno.", { kind: 'corno' }),
  c('smorfia', 'presepe', "Statuina nel presepe", "A San Gregorio Armeno hanno fatto la tua statuina. Vendi i diritti d'immagine: +100 ₵.", { kind: 'money', amount: 100 }),
  c('smorfia', 'pizza', 'Pizza a portafoglio', 'Vai a mangiare a Via Tribunali. Spendi 4 euro, ti senti un re. Vai a Via Tribunali.', { kind: 'moveTo', to: 19, collectGo: true }),
  c('smorfia', 'stadio', "Biglietto in curva", "Ti hanno regalato un biglietto in curva B. Vai allo Stadio Maradona; se passi dal VIA ritiri.", { kind: 'moveTo', to: 39, collectGo: true }),
  c('smorfia', 'cugino', "'O cugino d'America", "Arriva 'o cugino d'America e si piazza in casa tua. Per un giro la tua proprietà migliore non incassa niente: è famiglia.", { kind: 'cugino' }, true),
  c('smorfia', 'sciopero', 'Sciopero ANM', 'Sciopero selvaggio: per un giro le funicolari non incassano. Scendi a piedi, chiattone.', { kind: 'sciopero' }),
  c('smorfia', 'caffe', "Caffè pagato all'avvocato", 'Hai offerto il caffè all\'avvocato. Adesso ti deve un favore. +1 "Conosco a uno".', { kind: 'conosco' }),
  c('smorfia', 'funicolare', 'Corri, parte la funicolare', 'Vai alla funicolare più vicina. Se è di qualcuno, paghi come al solito, pezzente.', { kind: 'nearestStation' }),
  c('smorfia', 'santo', "'O santo t'ha aiutato", "Hai fatto la promessa a San Gennaro e il Napoli ha vinto. Ritira 50 ₵ e va' a pagà 'a promessa.", { kind: 'money', amount: 50 }),
  c('smorfia', 'gratta', 'Gratta e vinci', "Gratti con la moneta da 2 euro. Vinci 10 euro. Spendi 20 in altri gratta e vinci. Netto: -10 ₵.", { kind: 'money', amount: -10 }, true),
  c('smorfia', 'milano', 'La pizza di Milano', "Hai detto che la pizza di Milano è buona. Tutti i giocatori ti sputano in faccia: paga 50 ₵ a testa, traditore.", { kind: 'payEach', amount: 50 }, true),
  c('smorfia', 'contrabbando', 'Sigarette di contrabbando', "Hai venduto una stecca di Marlboro 'e contrabbando sul Rettifilo. +75 ₵ in nero.", { kind: 'money', amount: 75 }),
  c('smorfia', 'avanti', "Fuitevenne!", "Arriva la Municipale. Scappa di tre caselle avanti.", { kind: 'moveRel', steps: 3 }),
  c('smorfia', 'eredita', "L'eredità di zì Peppe", "Zì Peppe è morto e ti ha lasciato il basso a Forcella e 100 ₵. Piangi un po' per finta.", { kind: 'money', amount: 100 }),
  c('smorfia', 'neomelodico', 'Concerto neomelodico', "Hai cantato al matrimonio di tua cugina: 'Nu bacio annascuso'. Ogni giocatore ti dà 20 ₵ per farti smettere.", { kind: 'collectEach', amount: 20 }),
  c('smorfia', 'vesuvio', "'O Vesuvio s'arrabbia", "Hai bestemmiato vicino al Vesuvio. Lui ha sentito: il Vesuvio sale di 15.", { kind: 'vesuvio', amount: 15 }, true),
  c('smorfia', 'sospeso', 'Il barista ti vuole bene', 'Il barista ti dà tutti i caffè sospesi: prendi il piatto del Caffè Sospeso.', { kind: 'potToMe' }),
];

export const MALOCCHIO_CARDS: Card[] = [
  c('malocchio', 'motorino', "T'hanno fottuto 'o motorino", "T'hanno fottuto 'o motorino mentre pigliavi 'o ccaffè. Paga 100 ₵ per ricomprartelo… dallo stesso che te l'ha arrubbato.", { kind: 'money', amount: -100 }, true),
  c('malocchio', 'suocera', 'Le carte della suocera', "Tua suocera ha letto 'e carte: hai il malocchio. Paga 50 ₵ alla maga di Forcella.", { kind: 'money', amount: -50 }, true),
  c('malocchio', 'moka', 'Si è rotta la moka', 'Ti si è rotta la moka. Lutto cittadino: salti un turno.', { kind: 'skip', turns: 1 }, true),
  c('malocchio', 'lancia1', 'Fattura a domicilio', "Hai l'occhio secco. Scegli un avversario e lanciagli il malocchio: il prossimo affitto che incassa è dimezzato.", { kind: 'throwMalocchio' }),
  c('malocchio', 'lancia2', "Il sale dietro la porta", "Butti il sale dietro la porta di un nemico. Scegli a chi: il suo prossimo affitto è dimezzato.", { kind: 'throwMalocchio' }),
  c('malocchio', 'lancia3', "Corna fatte con la mano", "Fai le corna di nascosto a uno di loro. Scegli la vittima del malocchio.", { kind: 'throwMalocchio' }),
  c('malocchio', 'gatto', 'Gatto nero sul Rettifilo', "Ti ha tagliato la strada un gatto nero. Il malocchio è tuo: il tuo prossimo affitto è dimezzato. Statti accorto.", { kind: 'selfMalocchio' }, true),
  c('malocchio', 'municipale', 'La Municipale', "Ti ferma la Municipale senza casco, senza assicurazione e senza patente. Paga 80 ₵ nel Caffè Sospeso.", { kind: 'money', amount: -80 }, true),
  c('malocchio', 'pigliato', "T'hanno pigliato", "Ti beccano con le sigarette di contrabbando nel bagagliaio. Vai dritto a Poggioreale.", { kind: 'jail' }, true),
  c('malocchio', 'condono', 'Il condono che non arriva', "Il condono edilizio è saltato. Paga 25 ₵ per ogni basso e 100 ₵ per ogni palazzo abusivo, palazzinaro.", { kind: 'repairs', perBasso: 25, perPalazzo: 100 }, true),
  c('malocchio', 'ambulanza', 'Ambulanza abusiva', "Ti sei fatto venire un coccolone e ti è venuta a prendere l'ambulanza abusiva. Paga 150 ₵, e ringrazia che sei vivo.", { kind: 'money', amount: -150 }, true),
  c('malocchio', 'scippo', 'Scippo col motorino', "Due guaglioni sul motorino ti scippano il borsello. -60 ₵ e pure il santino di Padre Pio.", { kind: 'money', amount: -60 }, true),
  c('malocchio', 'traffico', 'Traffico sulla tangenziale', "Tangenziale bloccata. Torna indietro di 3 caselle, mannaggia 'a miseria.", { kind: 'moveRel', steps: -3 }, true),
  c('malocchio', 'juve', 'Hai tifato Juve', "Ti hanno visto con la maglia della Juve. Tutti ti menano e ti fanno pagare 30 ₵ a testa. Curnuto.", { kind: 'payEach', amount: 30 }, true),
  c('malocchio', 'ananas', "L'ananas sulla pizza", "Hai ordinato la pizza con l'ananas. Luigi Gigi piange, il pizzaiolo ti caccia. Paga 50 ₵ di danni morali.", { kind: 'money', amount: -50 }, true),
  c('malocchio', 'vesuvio', 'Il Vesuvio brontola', "Hai detto \"lavali col fuoco\" ad alta voce. Il Vesuvio ha preso nota: sale di 20.", { kind: 'vesuvio', amount: 20 }, true),
  c('malocchio', 'mammà', "Mammà ha cucinato per 30", "Domenica: ragù dalle 6 del mattino. Hai mangiato per 3 giorni. Salti un turno sul divano.", { kind: 'skip', turns: 1 }, true),
  c('malocchio', 'corno', "Corno di riserva", "Una zingara ti voleva fare il malocchio, ma tu hai fatto le corna prima. Prendi un Corno Rosso.", { kind: 'corno' }),
  c('malocchio', 'avvocato', "L'avvocato cugino", 'L\'avvocato cugino ti manda la parcella "da parente": 120 ₵. Figlio \'e \'ntrocchia.', { kind: 'money', amount: -120 }, true),
  c('malocchio', 'buca', 'La buca in Via Marina', "Sei finito in una buca in Via Marina. Ci abitava una famiglia. Paga 40 ₵ di cerchioni.", { kind: 'money', amount: -40 }, true),
  c('malocchio', 'garibaldi', "Vai a Piazza Garibaldi", "Devi prendere il treno. Vai a Piazza Garibaldi e tieni stretto il portafoglio. Se passi dal VIA ritiri.", { kind: 'moveTo', to: 21, collectGo: true }),
  c('malocchio', 'boss', "Il compare d'anello", "Hai fatto da compare d'anello a nozze. Regali d'oro per tutti: paga 25 ₵ a ogni giocatore.", { kind: 'payEach', amount: 25 }, true),
];

export const ALL_CARDS: Record<string, Card> = Object.fromEntries(
  [...SMORFIA_CARDS, ...MALOCCHIO_CARDS].map((card) => [card.id, card]),
);

export const deckCards = (deck: Deck) => (deck === 'smorfia' ? SMORFIA_CARDS : MALOCCHIO_CARDS);
