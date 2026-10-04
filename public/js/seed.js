// Dati DEMO: inventati, generati applicando operazioni reali al motore
// così che movimenti, storico e audit siano coerenti con le giacenze.
import { applyOp, emptyState, romeDate, addDays } from './core.js';

export const DEMO_USERS = [
  { id: 'u-luca', name: 'Luca', username: 'luca', role: 'admin' },
  { id: 'u-marco', name: 'Marco', username: 'marco', role: 'magazzino' },
  { id: 'u-giulia', name: 'Giulia', username: 'giulia', role: 'ufficio' },
];

export function buildDemoState(nowMs = Date.now()) {
  const today = romeDate(nowMs);
  let s = emptyState();
  s.meta.createdAt = nowMs;
  s.meta.demo = true;
  const [luca, marco, giulia] = DEMO_USERS;
  let lastId = null;
  const at = (daysAgo, hour = 9, user = marco) => {
    const ms = nowMs - daysAgo * 86400000 + (hour - 12) * 3600000;
    return { user, now: ms, today: romeDate(ms) };
  };
  const run = (ctx, op) => {
    const r = applyOp(s, op, ctx);
    s = r.state;
    lastId = r.result.lotId || r.result.planId || r.result.noteId || null;
    return lastId;
  };

  // Baia 1: due lotti separati nella stessa baia (caso di prova "lotti separati").
  const a = run(at(12, 8), { type: 'lot.create', locationId: 'baia-1', material: 'Ferro-silicio FeSi 75', client: 'Acciaierie Demo Nord', lotCode: 'DEMO-A', tons: 30, format: 'Sfuso' });
  run(at(11, 10, luca), { type: 'lot.create', locationId: 'baia-1', material: 'Ferro-manganese HC', client: 'Fonderia Esempio', lotCode: 'DEMO-B', tons: 20, format: 'Sacconi', bags: 20 });

  // Baia 2: quasi piena con un arrivo programmato che supera la capienza provvisoria.
  run(at(30, 9), { type: 'lot.create', locationId: 'baia-2', material: 'Ferro-cromo HC', client: 'Demo Steel', lotCode: 'DEMO-C22', tons: 912.4, format: 'Sfuso', pdfRef: 'DDT-DEMO-0412.pdf' });
  run(at(3, 11, giulia), { type: 'plan.create', locationId: 'baia-2', material: 'Ferro-cromo HC', client: 'Demo Steel', lotCode: 'DEMO-C23', format: 'Sfuso', containers: 8, days: 4, startDate: addDays(today, 1), totalTons: 216 });

  // Baia 3: lotto con appunto importante.
  run(at(20, 7), { type: 'lot.create', locationId: 'baia-3', material: 'Silico-manganese', client: 'Officine Prova', lotCode: 'DEMO-S03', tons: 418.75, format: 'Sfuso' });
  run(at(15, 15), { type: 'lot.unload', lotId: lastId, tons: 62.5, note: 'Camion DEMO per Officine Prova' });
  run(at(2, 8), { type: 'note.create', locationId: 'baia-3', title: 'Telo di copertura strappato sul lato nord', text: 'Coprire prima della pioggia di giovedì. Materiale da tenere asciutto.', status: 'Aperto', important: true });

  // Baia 5: posizione vuota con storico e un appunto ancora aperto.
  const e = run(at(25, 9), { type: 'lot.create', locationId: 'baia-5', material: 'Ferro-molibdeno', client: 'Fonderia Esempio', lotCode: 'DEMO-E05', tons: 44, format: 'Sacconi', bags: 44 });
  run(at(18, 14), { type: 'lot.unload', lotId: e, tons: 24 });
  run(at(6, 10), { type: 'lot.unloadAll', lotId: e, note: 'Ultimo ritiro DEMO' });
  run(at(1, 16, luca), { type: 'note.create', locationId: 'baia-5', title: 'Pulire il fondo prima del prossimo arrivo', text: '', status: 'In lavorazione', important: false });

  // Baia 7: piano 10 container in 5 giorni, iniziato due giorni fa → 4 container stimati.
  run(at(2, 7, giulia), { type: 'plan.create', locationId: 'baia-7', material: 'Ferro-silicio FeSi 75', client: 'Acciaierie Demo Nord', lotCode: 'DEMO-P10', format: 'Sfuso', containers: 10, days: 5, startDate: addDays(today, -2), totalTons: 270 });

  // Mucchi.
  run(at(40, 9), { type: 'lot.create', locationId: 'mucchio-18', material: 'Ferro-titanio 70', client: 'Demo Steel', lotCode: 'DEMO-M18', tons: 86.2, format: 'Sfuso' });
  run(at(35, 9), { type: 'lot.create', locationId: 'mucchio-21', material: 'Silico-manganese', client: 'Acciaierie Demo Nord', lotCode: 'DEMO-M21', tons: 140, format: 'Sfuso' });
  run(at(33, 9), { type: 'lot.create', locationId: 'mucchio-22', material: 'Ferro-manganese HC', client: 'Fonderia Esempio', lotCode: 'DEMO-M22A', tons: 75.3, format: 'Sfuso' });
  run(at(33, 11), { type: 'lot.create', locationId: 'mucchio-22', material: 'Ferro-manganese MC', client: 'Officine Prova', lotCode: 'DEMO-M22B', tons: 51.06, format: 'Sfuso' });
  run(at(28, 9), { type: 'lot.create', locationId: 'mucchio-49', material: 'Silicio metallico', client: 'Demo Steel', lotCode: 'DEMO-M49', tons: 233.9, format: 'Sfuso' });
  run(at(9, 9), { type: 'lot.create', locationId: 'mucchio-34', material: 'Ferro-silicio FeSi 65', client: 'Officine Prova', lotCode: 'DEMO-M34', tons: 160, format: 'Sfuso' });
  run(at(4, 9), { type: 'lot.load', lotId: lastId, tons: 27, note: 'Integrazione DEMO' });

  // Baie alfabetiche e tettoia.
  run(at(22, 9), { type: 'lot.create', locationId: 'baia-a', material: 'Ferro-vanadio 80', client: 'Fonderia Esempio', lotCode: 'DEMO-VA1', tons: 12.6, format: 'Sacconi', bags: 12 });
  run(at(14, 9), { type: 'lot.create', locationId: 'baia-c', material: 'Ferro-niobio', client: 'Demo Steel', lotCode: 'DEMO-NB3', tons: 640, format: 'Sfuso' });
  run(at(16, 9), { type: 'lot.create', locationId: 'tettoia', material: 'Ferro-boro', client: 'Officine Prova', lotCode: 'DEMO-T01', tons: 8.4, format: 'Sacconi', bags: 8 });
  run(at(16, 10), { type: 'lot.create', locationId: 'tettoia', material: 'Ferro-vanadio 80', client: 'Acciaierie Demo Nord', lotCode: 'DEMO-T02', tons: 5.25, format: 'Sacconi', bags: 5 });
  run(at(10, 9), { type: 'lot.create', locationId: 'baia-11', material: 'Ferro-silicio FeSi 75', client: 'Demo Steel', lotCode: 'DEMO-K11', tons: 1004.8, format: 'Sfuso' });
  run(at(8, 9), { type: 'lot.create', locationId: 'baia-14', material: 'Silico-manganese', client: 'Fonderia Esempio', lotCode: 'DEMO-N14', tons: 355, format: 'Sfuso' });

  // Appunto generale.
  run(at(3, 18, luca), { type: 'note.create', locationId: null, title: 'Pesa a ponte: taratura lunedì', text: 'Fino alla taratura usare la pesa esterna per i carichi sopra 25 t.', status: 'Aperto', important: true });

  // Ordini.
  run(at(1, 9, giulia), { type: 'order.create', title: 'Caricare camion per Acciaierie Demo Nord', date: today, time: '14:30', material: 'Ferro-silicio FeSi 75', locationId: 'baia-1', qty: 10, unit: 't', status: 'Da fare', notes: 'Prelevare dal lotto DEMO-A.', vehicleId: 'pala' });
  run(at(1, 10, giulia), { type: 'order.create', title: 'Spostare sacconi sotto tettoia', date: addDays(today, 2), time: '', material: 'Ferro-manganese HC', locationId: 'baia-1', qty: 6, unit: 'sacconi', status: 'Programmato', notes: '', vehicleId: 'muletto-1' });
  run(at(7, 10, marco), { type: 'order.create', title: 'Ritiro Ferro-molibdeno Baia 5', date: addDays(today, -6), time: '10:00', material: 'Ferro-molibdeno', locationId: 'baia-5', qty: 20, unit: 't', status: 'Completato', notes: 'Scarico eseguito dal lotto.' });
  run(at(0, 8, luca), { type: 'order.create', title: 'Verifica livello Mucchio 49', date: addDays(today, 1), time: '08:00', material: 'Silicio metallico', locationId: 'mucchio-49', qty: null, unit: 't', status: 'Da fare', notes: '' });

  // Calendario.
  run(at(2, 9, giulia), { type: 'event.create', title: 'Arrivo nave DEMO al porto', date: addDays(today, 3), time: '07:00', kind: 'Carico', notes: 'Container in arrivo in Baia 2.' });
  run(at(2, 9, giulia), { type: 'event.create', title: 'Manutenzione pala gommata', date: addDays(today, 1), time: '13:00', kind: 'Mezzi', notes: '' });
  run(at(2, 9, luca), { type: 'event.create', title: 'Visita cliente Demo Steel', date: addDays(today, 6), time: '10:30', kind: 'Visita', notes: '' });
  run(at(2, 9, luca), { type: 'event.create', title: 'Inventario mucchi 21–30', date: addDays(today, -3), time: '', kind: 'Promemoria', notes: '' });

  // Mezzi.
  run(at(0, 7, marco), { type: 'fleet.update', vehicleId: 'merlo', fields: { status: 'In uso', note: 'Sistemazione big bag sotto tettoia' } });
  run(at(1, 17, luca), { type: 'fleet.update', vehicleId: 'muletto-2', fields: { status: 'Manutenzione', note: 'Cambio forche, rientra giovedì' } });

  return s;
}
