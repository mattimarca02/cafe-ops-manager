/*
 * Prove del registro HACCP con l'Apps Script finto.
 */
'use strict';

var assert = require('assert');
var gas = require('./gas-finto');

var PIN = '1234';

function ora(testo) { return Utilities.parseDate(testo, FUSO, 'yyyy-MM-dd HH:mm'); }

function registro() {
  var s = scheda_(SCHEDA_HACCP);
  return s.getLastRow() < 2 ? [] : s.getRange(2, 1, s.getLastRow() - 1, INTESTAZIONI_HACCP.length).getValues();
}

function registra(idControllo, valore, extra) {
  var d = { id: 'Hprova-' + Math.random().toString(36).substring(2, 10), idControllo: idControllo, valore: valore, persona: 'Maria' };
  for (var k in extra) d[k] = extra[k];
  return registraControlloHaccp(PIN, d);
}

module.exports = {
  'setup: schede HACCP con gli esempi e ora limite in Impostazioni': function () {
    var controlli = leggiControlliHaccp_();
    assert.strictEqual(controlli.length, 6);
    assert.deepStrictEqual(controlli.map(function (c) { return c.id; }),
      ['H-frigo-bevande', 'H-frigo-alimenti', 'H-congelatore', 'H-pulizia-piano', 'H-scadenze-merce', 'H-pulizia-bagni']);
    assert.strictEqual(controlli[2].min, -25);
    assert.strictEqual(controlli[2].max, -18);
    assert.strictEqual(controlli[4].frequenza, 'settimanale');
    assert.ok(/consulente HACCP/.test(controlli[0].istruzioni));
    assert.strictEqual(leggiImpostazione_(IMP_ORA_HACCP), '11:00');
    assert.ok(SpreadsheetApp.getActiveSpreadsheet().getSheetByName('HACCP'));
    // Rieseguire setup non duplica gli esempi
    setup();
    assert.strictEqual(leggiControlliHaccp_().length, 6);
  },

  'app: controlli da fare e numerino nella home': function () {
    var r = controlliHaccp(PIN);
    assert.ok(r.ok, r.messaggio);
    assert.strictEqual(r.controlli.length, 6);
    assert.strictEqual(r.controlli.filter(function (c) { return !c.fatto; }).length, 6);
    assert.strictEqual(r.oraLimite, '11:00');
    assert.strictEqual(r.mesi.length, 12);
    assert.strictEqual(avvio(PIN).haccpDaFare, 6);
    assert.ok(registra('H-pulizia-bagni', 'Fatto').ok);
    assert.strictEqual(avvio(PIN).haccpDaFare, 5);
    var bagni = controlliHaccp(PIN).controlli.filter(function (c) { return c.id === 'H-pulizia-bagni'; })[0];
    assert.ok(bagni.fatto);
    assert.strictEqual(bagni.ultima.persona, 'Maria');
  },

  'temperature: nel range, fuori range con azione correttiva, non valide': function () {
    assert.strictEqual(registra('H-frigo-alimenti', '3,5').esito, 'OK');
    assert.strictEqual(registra('H-frigo-alimenti', '6', { note: 'Regolato il termostato' }).esito, 'FUORI RANGE');
    assert.strictEqual(registra('H-congelatore', '-15').esito, 'FUORI RANGE');
    var r = registra('H-congelatore', 'ghiaccio');
    assert.strictEqual(r.ok, false);
    assert.ok(/temperatura/.test(r.messaggio));
    var righe = registro();
    assert.strictEqual(righe.length, 3);
    assert.strictEqual(righe[0][4], 3.5);
    assert.strictEqual(righe[0][5], 'OK');
    assert.strictEqual(righe[1][6], 'Regolato il termostato');
    assert.strictEqual(righe[2][6], NOTA_HACCP_MANCANTE, 'fuori range senza nota: resta traccia');
    assert.strictEqual(righe[2][2], 'Temperatura congelatore');
    assert.strictEqual(righe[2][8], 'H-congelatore');
    assert.strictEqual(righe[2][7], 'Maria');
  },

  'stesso ID inviato due volte (coda offline): una sola riga': function () {
    var dati = { id: 'Hdoppio-123', idControllo: 'H-pulizia-piano', valore: 'Fatto', data: '2026-10-09', ora: '07:45' };
    assert.ok(registraControlloHaccp(PIN, dati).ok);
    assert.ok(registraControlloHaccp(PIN, dati).giaSalvata);
    var righe = registro();
    assert.strictEqual(righe.length, 1);
    assert.strictEqual(chiaveGiorno_(righe[0][0]), '2026-10-09', 'data del telefono');
    assert.strictEqual(righe[0][1], '07:45', 'ora del telefono');
  },

  'controllo tolto dal foglio mentre il dato era in coda: salvato con il nome arrivato': function () {
    var r = registraControlloHaccp(PIN, { id: 'Hsparito-1', idControllo: 'H-non-ce-piu', nome: 'Frigo vecchio', tipo: 'temperatura',
      min: 0, max: 4, valore: '9' });
    assert.ok(r.ok);
    assert.strictEqual(r.esito, 'FUORI RANGE');
    assert.strictEqual(registro()[0][2], 'Frigo vecchio');
  },

  'tipo nota: serve il testo': function () {
    var s = scheda_(SCHEDA_CONTROLLI_HACCP);
    s.appendRow(['Note del giorno', 'nota', '', '', 'giornaliera', 'SI', '', '']);
    var c = controlliHaccp(PIN).controlli.filter(function (x) { return x.nome === 'Note del giorno'; })[0];
    assert.ok(c.id, 'il controllo scritto a mano riceve un ID');
    assert.strictEqual(registraControlloHaccp(PIN, { id: 'Hnota-0001', idControllo: c.id, valore: '' }).ok, false);
    assert.ok(registraControlloHaccp(PIN, { id: 'Hnota-0002', idControllo: c.id, valore: 'Arrivato il tecnico del frigo' }).ok);
    assert.strictEqual(registro()[0][4], 'Arrivato il tecnico del frigo');
  },

  'promemoria email: dopo l\'ora limite, una volta al giorno, solo se manca qualcosa': function () {
    // Registro mai usato (esempi non ancora confermati): nessuna email
    assert.strictEqual(inviaPromemoriaHaccp_(ora('2026-10-12 11:05')).inviata, false, 'registro non ancora usato');
    assert.strictEqual(gas.finto.email.length, 0);
    // Una registrazione di un altro giorno: da qui in poi il registro è "in uso"
    scheda_(SCHEDA_HACCP).appendRow([leggiData_('2026-10-01'), '09:00', 'Pulizia bagni', 'spunta', 'Fatto', 'Fatto', '', 'Maria',
      'H-pulizia-bagni', 'Hprimo-1', new Date()]);
    assert.strictEqual(inviaPromemoriaHaccp_(ora('2026-10-12 10:30')).inviata, false, 'prima delle 11');
    var e = inviaPromemoriaHaccp_(ora('2026-10-12 11:05'));
    assert.ok(e.inviata);
    assert.strictEqual(e.mancanti, 5, 'lunedì: i 5 giornalieri (il settimanale no)');
    assert.strictEqual(gas.finto.email.length, 1);
    assert.ok(/Pulizia bagni/.test(gas.finto.email[0].body));
    assert.strictEqual(gas.finto.email[0].to, 'bar@example.com', 'senza email in Impostazioni: il proprietario');
    assert.strictEqual(inviaPromemoriaHaccp_(ora('2026-10-12 12:05')).inviata, false, 'già inviato oggi');

    // Il giorno dopo, tutto fatto prima delle 11: nessuna email
    scriviImpostazione_(IMP_EMAIL_TITOLARE, 'titolare@example.com');
    // (scritte direttamente nel registro: l'app non accetta date nel futuro rispetto all'orologio vero)
    leggiControlliHaccp_().forEach(function (c, i) {
      scheda_(SCHEDA_HACCP).appendRow([leggiData_('2026-10-13'), '09:00', c.nome, c.tipo, c.tipo === 'temperatura' ? c.max - 1 : 'Fatto',
        'OK', '', 'Maria', c.id, 'Htutto-' + i, new Date()]);
    });
    assert.strictEqual(inviaPromemoriaHaccp_(ora('2026-10-13 11:30')).inviata, false);
    // Ora limite cambiata e email dedicata
    scriviImpostazione_(IMP_ORA_HACCP, '15:30');
    scriviImpostazione_(IMP_EMAIL_HACCP, 'haccp@example.com');
    assert.strictEqual(inviaPromemoriaHaccp_(ora('2026-10-14 15:00')).inviata, false);
    assert.ok(inviaPromemoriaHaccp_(ora('2026-10-14 15:31')).inviata);
    assert.strictEqual(gas.finto.email[1].to, 'haccp@example.com');
  },

  'PDF del mese: creato nella cartella Bar - HACCP e sostituito alla seconda volta': function () {
    registraControlloHaccp(PIN, { id: 'Hpdf-0001', idControllo: 'H-frigo-alimenti', valore: '7', note: 'Spostata la merce', data: '2026-09-03', ora: '08:00', persona: 'Luca' });
    registraControlloHaccp(PIN, { id: 'Hpdf-0002', idControllo: 'H-pulizia-bagni', valore: 'Fatto', data: '2026-09-03', ora: '18:00', persona: 'Giulia' });
    var r = esportaHaccpPdf(PIN, '2026-09');
    assert.ok(r.ok, r.messaggio);
    assert.strictEqual(r.nome, 'Registro HACCP 2026-09.pdf');
    assert.strictEqual(r.righe, 2);
    var cartella = DriveApp.getRootFolder().getFoldersByName('Bar - HACCP').next();
    var file = cartella.getFilesByName(r.nome).next();
    assert.strictEqual(file.getMimeType(), 'application/pdf');
    var contenuto = file.getBlob().getDataAsString();
    assert.ok(/Settembre 2026/.test(contenuto));
    assert.ok(/Spostata la merce/.test(contenuto));
    assert.ok(/03\/09\/2026/.test(contenuto) && /Luca/.test(contenuto) && /7 °C/.test(contenuto));
    assert.ok(/FUORI RANGE/.test(contenuto));
    assert.ok(/Firma del responsabile/.test(contenuto));
    esportaHaccpPdf(PIN, '2026-09');
    var n = 0;
    var tutti = cartella.getFilesByName(r.nome);
    while (tutti.hasNext()) { tutti.next(); n++; }
    assert.strictEqual(n, 1, 'il PDF vecchio va nel cestino');
    assert.ok(leggiImpostazione_(IMP_ID_CARTELLA_HACCP), 'ID della cartella salvato in Impostazioni');
  },

  'attivatori: promemoria HACCP ogni ora e PDF archiviato col report mensile': function () {
    installaTrigger();
    var t = gas.finto.trigger.filter(function (x) { return x.funzione === 'promemoriaHaccp'; });
    assert.strictEqual(t.length, 1);
    assert.strictEqual(t[0].ogniOre, 1);
    scriviImpostazione_(IMP_EMAIL_TITOLARE, 'titolare@example.com');
    // Registro HACCP non usato: niente cartella né PDF
    inviaReportMensile();
    assert.strictEqual(DriveApp.getRootFolder().getFoldersByName('Bar - HACCP').hasNext(), false, 'nessun PDF se il registro non è usato');
    registraControlloHaccp(PIN, { id: 'Hreport-01', idControllo: 'H-pulizia-bagni', valore: 'Fatto' });
    inviaReportMensile();
    var cartella = DriveApp.getRootFolder().getFoldersByName('Bar - HACCP').next();
    var oggi = annoMeseOggi_();
    var m = spostaMese_(oggi.anno, oggi.mese, -1);
    assert.ok(cartella.getFilesByName('Registro HACCP ' + chiaveMese_(m.anno, m.mese) + '.pdf').hasNext());
  },

  'ora limite scritta come orario e ID riscritto: il controllo resta riconosciuto': function () {
    // Il valore mostrato nella cella è quello che conta
    scriviImpostazione_(IMP_ORA_HACCP, '15:45');
    assert.strictEqual(oraLimiteHaccp_(), 15 * 60 + 45);
    // Registrazione fatta con un ID poi cambiato nel foglio: vale anche il nome del controllo
    registraControlloHaccp(PIN, { id: 'Hrinomina-1', idControllo: 'H-pulizia-bagni', valore: 'Fatto' });
    var c = leggiControlliHaccp_().filter(function (x) { return x.id === 'H-pulizia-bagni'; })[0];
    scheda_(SCHEDA_CONTROLLI_HACCP).getRange(c.riga, 8).setValue('H-nuovo-id');
    var bagni = controlliHaccp(PIN).controlli.filter(function (x) { return x.id === 'H-nuovo-id'; })[0];
    assert.ok(bagni.fatto);
    // ID non valido arrivato dal telefono: non viene scritto così com'è
    registraControlloHaccp(PIN, { id: 'Hsporco-01', idControllo: '=HYPERLINK("x")', nome: 'Vecchio', tipo: 'spunta', valore: 'Fatto' });
    var righe = registro();
    assert.strictEqual(righe[righe.length - 1][8], '');
  }
};
