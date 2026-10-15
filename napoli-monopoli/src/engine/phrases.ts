import type { PawnId, SpeechCat } from './types';

type Lines = Record<SpeechCat, string[]>;

export const PHRASES: Record<PawnId, Lines> = {
  ciro: {
    roll: [
      'Fratm, guarda e impara!',
      'Mo\' ti faccio vedere io, uè!',
      'Tiro e vado, non tengo tempo!',
      "Jamme jà, che tengo 'o motorino in doppia fila!",
      'Questi dadi so\' truccati, ma a favore mio.',
    ],
    buy: [
      'Me la piglio io, fratm. Chi ha da dì quaccosa?',
      'Comprata! Mo\' ci metto il cartello "Proprietà di Ciro".',
      "Questa la pago in contanti… del cognato.",
      "E chi me la leva cchiù, sfaccimma!",
    ],
    payRent: [
      'Ma che è, \'na rapina? Io so\' Ciro!',
      'Pago, pago… ma te lo segno, omm \'e mmerda.',
      "Chitemmuorto, pure l'affitto mo\'?",
      'Tieni, e accattate \'na vita.',
    ],
    collectRent: [
      'Caccia \'e sorde, fratm!',
      'Ringrazia che non ti faccio pagare pure il parcheggio.',
      'Bello, bello. Passa alla cassa.',
    ],
    jail: [
      'Io non so\' stato! Chiedete a mio cugino!',
      "Poggioreale? Tranquilli, là conosco a mezzo carcere.",
      "Avvocà, voi mi dovete fa' ascì stasera!",
    ],
    win: ['FRATM! SO\' IO \'O RE \'E NAPULE!', 'Scudetto e motorino nuovo. In tre, senza casco!'],
    bankrupt: ['Me ne vado a Milano a fare il rider… che schifo.', 'Mannaggia \'a miseria, pure il motorino s\'hanno pigliato.'],
    scippato: ['Uè! \'O borsello! Fermatelo!', 'Ma a me?! A ME?! Io so\' del mestiere!'],
    scippa: ["Grazie 'o stesso, fratm!", 'Tre secondi netti. Record del quartiere.'],
    pacco: ["Ti piace 'o regalo? Aprilo a casa, mi raccomando."],
    card: ['Vediamo che dice la sorte, va.', 'Speriamo bene, mannaggia.'],
  },
  toto: {
    roll: [
      'Signori miei, il dado è tratto. Anzi, lo tiro io.',
      'Ogni limite ha una pazienza!',
      'Lancio con la mano sinistra: quella con le tre dita.',
      'A prescindere, faccio un bel numero.',
      'Ma mi faccia il piacere, dadi!',
    ],
    buy: [
      "Acquisto codesto immobile con ottima sagacità mercantilizia.",
      "La compro. Pago con un assegno… post-datato al 2087.",
      'Signori, una proprietà così non si vende: si regala a me.',
      "E io pago! Per una volta, eh.",
    ],
    payRent: [
      "E io pago! E io pago!",
      'Quisquilie, pinzillacchere… ma quanto mi costano!',
      "Siete degli strozzinatori patentati.",
      'Pago con la mano da tre: vi do il 60%.',
    ],
    collectRent: [
      "Grazie, gentilissimo omo di mondo.",
      'Favorite alla cassa, e senza trucchi.',
      "La somma fa il totale, caro mio.",
    ],
    jail: [
      'Sono un uomo di mondo: ho fatto tre anni di militare a Cuneo… e mo\' pure Poggioreale.',
      'Ma è un equivoco internazionale!',
      'Chiamate il mio avvocato. Si chiama come me.',
    ],
    win: ['Siamo uomini o caporali? Io so\' \'o padrone!', 'Ho vinto con dignità e con tre dita!'],
    bankrupt: ['Vado a Milano. Lì nessuno mi conosce: ricomincio coi pacchi.', 'Sono rovinato, rovinatissimo!'],
    scippato: ['Furfante! Malandrino! Ladro di borselli altrui!', 'Ma questa è una disonestà disonesta!'],
    scippa: ['Ho preso in prestito. Senza permesso, ma in prestito.', 'Pardon, mi è caduto il vostro portafoglio in tasca.'],
    pacco: ['Un affare d\'oro, signori. Oro… di mattone.', 'Il contenuto è garantito dalla mia faccia.'],
    card: ['Vediamo cosa dice il destino, quel mascalzone.'],
  },
  gigi: {
    roll: [
      'Statte zitto e fammi impastare \'sti dadi.',
      'Pomodoro San Marzano e un bel 7, grazie.',
      'Tiro come stendo la pasta: con amore e violenza.',
      "Mo' vedimme si \'o forno è caldo!",
      "Ventilatore acceso, si tira!",
    ],
    buy: [
      'Qui ci apro una pizzeria. La quarantesima.',
      "Me la compro. Paga \'a margherita!",
      'Fior di latte, basilico e rogito notarile.',
      "Comprato! E niente ananas, è chiaro?",
    ],
    payRent: [
      'Pago, ma la pizza da me te la scordi.',
      'Con questi soldi facevo trecento margherite, strunz!',
      "Mi state mangiando vivo come \'na pizza fritta.",
      'Va\' fa\' \'n culo, tu e il forno elettrico.',
    ],
    collectRent: ['Pagate, pagate. Coperto incluso.', 'Il forno a legna non si scalda da solo.', 'Grazie. Il servizio è escluso, il pizzo no.'],
    jail: [
      "Mi arrestano perché la pizza era troppo buona!",
      "A Poggioreale ci metto un forno, vedrete.",
      'Sono innocente: ho solo messo il ketchup a un turista.',
    ],
    win: ["MARGHERITA CAMPIONE D'ITALIA!", 'Ho vinto! Pizza per tutti… a pagamento.'],
    bankrupt: ['Vado a Milano. Lì la pizza la fanno coi wurstel. Mi sento male.', 'Chiudo il forno. Il mondo è finito.'],
    scippato: ['M\'hanno arrubbato pure la mozzarella!', 'Ladri! Avete preso la cassa e le olive!'],
    scippa: ['Questo è per l\'ananas.', 'Pizza al taglio: tagliato il tuo portafoglio.'],
    pacco: ['Dentro c\'è una pizza. Più o meno.'],
    card: ['Speriamo che non sia l\'ananas.', 'Leggo la carta come leggo le comande: male.'],
  },
  gennaro: {
    roll: [
      'Benedico i dadi nel nome del Padre, del Figlio e del Napoli.',
      'Il Signore vede e provvede. Pure i doppi.',
      "Lancio. E se esce male, maledico.",
      'In nome della santa ampolla!',
      "Fedeli, raccoglietevi: tiro!",
    ],
    buy: [
      'Questa la consacro. Diventa terra santa e mia.',
      'Comprata con le offerte della domenica.',
      'Il Signore ha detto: moltiplicatevi. Io moltiplico le proprietà.',
      'Proprietà benedetta: ora costa il doppio.',
    ],
    payRent: [
      "Vi perdono… ma non dimentico, figli di \'na bona femmina.",
      'Pago, ma vi faccio venire i suricilli in casa.',
      "Anatema! E pure il resto, tienilo.",
      'Il santo paga, ma il santo ricorda.',
    ],
    collectRent: ["L'offerta è libera. Ma minimo questa.", 'Grazie, fratello. Ora sei in pace.', "Mettete nella cassetta delle elemosine."],
    jail: [
      'Arrestate un santo?! Si scioglie il sangue dalla rabbia!',
      'Poggioreale ha bisogno di un patrono. Eccomi.',
      'Pregherò per voi. Poco.',
    ],
    win: ['MIRACOLO! IL SANTO HA VINTO!', 'Settembre, maggio e dicembre: ho vinto in tutti e tre.'],
    bankrupt: ["Mi trasferisco a Milano come statuina in un negozio di souvenir. Che fine.", 'Nemmeno il miracolo mi salva. Mannaggia a me.'],
    scippato: ["Rubare a un santo! All'inferno di corsa!", 'Mi avete preso l\'ampolla?! No, solo i soldi. Meno male.'],
    scippa: ['Considerala una decima.', "La provvidenza a volte ha il motorino."],
    pacco: ['Fidati: è benedetto.'],
    card: ['Signore, fa\' che sia una bona notizia.', 'Questa carta la benedico prima di leggerla.'],
  },
};

/** "Modalità Nonna": censored words with silly replacements */
export const CENSURA: [RegExp, string][] = [
  [/sfaccimma/gi, 'sfogliatella'],
  [/omm 'e mmerda/gi, "omm 'e panna"],
  [/strunz/gi, 'scugnizz'],
  [/chitemmuorto/gi, 'chitemmuort… o meglio, salute!'],
  [/va' fa' 'n culo/gi, "va' fa' 'na passeggiata"],
  [/vaffanculo/gi, 'vai a farti una pizza'],
  [/faccia 'e cazz/gi, "faccia 'e babbà"],
  [/cazzimma/gi, 'carinezza'],
  [/cazzi/gi, 'cavoli'],
  [/cazz[oa]?/gi, 'cavolo'],
  [/curnuto/gi, 'cornetto'],
  [/figli di 'na bona femmina/gi, 'figli di buona mamma'],
  [/figlio 'e 'ntrocchia/gi, 'figlio di tua madre'],
  [/fottuto/gi, 'preso'],
  [/porco/gi, 'birbante'],
  [/mannaggia 'a miseria/gi, 'mannaggia ai fagioli'],
];

export function censor(text: string, nonna: boolean): string {
  if (!nonna) return text;
  return CENSURA.reduce((acc, [re, rep]) => acc.replace(re, rep), text);
}

export function phraseCount(pawn: PawnId): number {
  return Object.values(PHRASES[pawn]).reduce((n, l) => n + l.length, 0);
}
