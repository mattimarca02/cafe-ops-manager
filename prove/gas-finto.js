/*
 * Apps Script "finto" per provare il codice sul computer (Node.js).
 *
 * Imita le parti di Apps Script usate dal progetto: SpreadsheetApp (fogli in
 * memoria), DriveApp (cartelle e file in memoria), Utilities, XmlService,
 * LockService, CacheService, PropertiesService, MailApp, ScriptApp, Session,
 * HtmlService, UrlFetchApp, Logger.
 *
 * NON viene caricato su Apps Script (è escluso da .claspignore).
 * Un metodo non previsto lancia un errore: così ci si accorge subito se il
 * codice usa qualcosa che qui non è stato imitato (e va verificato a mano).
 */
'use strict';

var zlib = require('zlib');
var crypto = require('crypto');

var finto = {
  email: [],
  trigger: [],
  log: [],
  ora: null, // se impostata (Date), new Date() del codice resta quella di Node: usare finto.adesso()
  utente: 'bar@example.com'
};

// ---------------------------------------------------------------------------
// Date e fusi orari
// ---------------------------------------------------------------------------

function partiData(data, fuso) {
  var f = new Intl.DateTimeFormat('en-GB', {
    timeZone: fuso, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', weekday: 'short', hourCycle: 'h23'
  });
  var p = {};
  f.formatToParts(data).forEach(function (x) { p[x.type] = x.value; });
  var giorni = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
  return {
    anno: +p.year, mese: +p.month, giorno: +p.day,
    ora: +p.hour, minuti: +p.minute, secondi: +p.second, settimana: giorni[p.weekday]
  };
}

var NOMI_MESI = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August',
  'September', 'October', 'November', 'December'];
var NOMI_GIORNI = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function formatDate(data, fuso, schema) {
  if (!(data instanceof Date) || isNaN(data.getTime())) throw new Error('formatDate: data non valida');
  var p = partiData(data, fuso);
  var due = function (n) { return (n < 10 ? '0' : '') + n; };
  var out = '';
  var i = 0;
  while (i < schema.length) {
    var c = schema[i];
    if (c === '\'') {
      var fine = schema.indexOf('\'', i + 1);
      out += schema.substring(i + 1, fine);
      i = fine + 1;
      continue;
    }
    var j = i;
    while (j < schema.length && schema[j] === c) j++;
    var n = j - i;
    switch (c) {
      case 'y': out += n === 2 ? String(p.anno).slice(-2) : p.anno; break;
      case 'M': out += n >= 4 ? NOMI_MESI[p.mese - 1] : n === 3 ? NOMI_MESI[p.mese - 1].slice(0, 3) : n === 2 ? due(p.mese) : p.mese; break;
      case 'd': out += n === 2 ? due(p.giorno) : p.giorno; break;
      case 'H': out += n === 2 ? due(p.ora) : p.ora; break;
      case 'm': out += n === 2 ? due(p.minuti) : p.minuti; break;
      case 's': out += n === 2 ? due(p.secondi) : p.secondi; break;
      case 'u': out += p.settimana; break;
      case 'E': out += n >= 4 ? NOMI_GIORNI[p.settimana] : NOMI_GIORNI[p.settimana].slice(0, 3); break;
      default:
        if (/[A-Za-z]/.test(c)) throw new Error('formatDate finto: simbolo non gestito "' + c + '"');
        out += schema.substring(i, j);
    }
    i = j;
  }
  return out;
}

/** Istante (Date) corrispondente all'ora "di orologio" indicata nel fuso. */
function dataNelFuso(anno, mese, giorno, ora, minuti, secondi, fuso) {
  var stima = Date.UTC(anno, mese - 1, giorno, ora, minuti, secondi || 0);
  for (var k = 0; k < 3; k++) {
    var p = partiData(new Date(stima), fuso);
    var visto = Date.UTC(p.anno, p.mese - 1, p.giorno, p.ora, p.minuti, p.secondi);
    var voluto = Date.UTC(anno, mese - 1, giorno, ora, minuti, secondi || 0);
    stima += voluto - visto;
  }
  return new Date(stima);
}

function parseDate(testo, fuso, schema) {
  var campi = [];
  var re = '';
  var i = 0;
  while (i < schema.length) {
    var c = schema[i];
    var j = i;
    while (j < schema.length && schema[j] === c) j++;
    if (/[yMdHms]/.test(c)) {
      campi.push(c);
      re += '(\\d{1,' + Math.max(j - i, 2) + '})';
      if (c === 'y') re = re.replace(/\\d\{1,\d+\}\)$/, '\\d{4})');
    } else {
      re += schema.substring(i, j).replace(/[.*+?^${}()|[\]\\\/]/g, '\\$&');
    }
    i = j;
  }
  var m = new RegExp('^' + re + '$').exec(String(testo));
  if (!m) throw new Error('parseDate finto: "' + testo + '" non corrisponde a "' + schema + '"');
  var v = { y: 1970, M: 1, d: 1, H: 0, m: 0, s: 0 };
  campi.forEach(function (c, k) { v[c] = +m[k + 1]; });
  return dataNelFuso(v.y, v.M, v.d, v.H, v.m, v.s, fuso);
}

// ---------------------------------------------------------------------------
// Byte e Blob
// ---------------------------------------------------------------------------

function aSegno(buf) {
  var out = new Array(buf.length);
  for (var i = 0; i < buf.length; i++) out[i] = buf[i] > 127 ? buf[i] - 256 : buf[i];
  return out;
}

function aBuffer(byte) {
  if (Buffer.isBuffer(byte)) return byte;
  if (typeof byte === 'string') return Buffer.from(byte, 'utf8');
  return Buffer.from(byte.map(function (x) { return x & 0xFF; }));
}

function Blob(dati, tipo, nome) {
  this._buf = dati === undefined ? Buffer.alloc(0) : aBuffer(dati);
  this._tipo = tipo || null;
  this._nome = nome || null;
}
Blob.prototype.getBytes = function () { return aSegno(this._buf); };
Blob.prototype.getDataAsString = function (codifica) {
  var cod = String(codifica || 'UTF-8').toLowerCase();
  return new TextDecoder(cod).decode(this._buf);
};
Blob.prototype.getName = function () { return this._nome; };
Blob.prototype.setName = function (n) { this._nome = n; return this; };
Blob.prototype.getContentType = function () { return this._tipo; };
Blob.prototype.setContentType = function (t) { this._tipo = t; return this; };
Blob.prototype.copyBlob = function () { return new Blob(Buffer.from(this._buf), this._tipo, this._nome); };
Blob.prototype.getBlob = function () { return this; };

// --- ZIP minimo (deflate o store) ---
function crc32(buf) { return zlib.crc32(buf) >>> 0; }

function creaZip(blobs) {
  var parti = [];
  var centrale = [];
  var offset = 0;
  blobs.forEach(function (b) {
    var nome = Buffer.from(b.getName() || 'file', 'utf8');
    var dati = b._buf;
    var compressi = zlib.deflateRawSync(dati);
    var crc = crc32(dati);
    var locale = Buffer.alloc(30);
    locale.writeUInt32LE(0x04034b50, 0);
    locale.writeUInt16LE(20, 4);
    locale.writeUInt16LE(0x0800, 6);
    locale.writeUInt16LE(8, 8);
    locale.writeUInt32LE(crc, 14);
    locale.writeUInt32LE(compressi.length, 18);
    locale.writeUInt32LE(dati.length, 22);
    locale.writeUInt16LE(nome.length, 26);
    parti.push(locale, nome, compressi);
    var c = Buffer.alloc(46);
    c.writeUInt32LE(0x02014b50, 0);
    c.writeUInt16LE(20, 4);
    c.writeUInt16LE(20, 6);
    c.writeUInt16LE(0x0800, 8);
    c.writeUInt16LE(8, 10);
    c.writeUInt32LE(crc, 16);
    c.writeUInt32LE(compressi.length, 20);
    c.writeUInt32LE(dati.length, 24);
    c.writeUInt16LE(nome.length, 28);
    c.writeUInt32LE(offset, 42);
    centrale.push(c, nome);
    offset += 30 + nome.length + compressi.length;
  });
  var cd = Buffer.concat(centrale);
  var fine = Buffer.alloc(22);
  fine.writeUInt32LE(0x06054b50, 0);
  fine.writeUInt16LE(blobs.length, 8);
  fine.writeUInt16LE(blobs.length, 10);
  fine.writeUInt32LE(cd.length, 12);
  fine.writeUInt32LE(offset, 16);
  return Buffer.concat(parti.concat([cd, fine]));
}

function leggiZip(buf) {
  var fine = -1;
  for (var i = buf.length - 22; i >= 0; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { fine = i; break; }
  }
  if (fine < 0) throw new Error('Invalid argument: blob (zip non valido)');
  var n = buf.readUInt16LE(fine + 10);
  var pos = buf.readUInt32LE(fine + 16);
  var out = [];
  for (var k = 0; k < n; k++) {
    if (buf.readUInt32LE(pos) !== 0x02014b50) throw new Error('zip rovinato');
    var metodo = buf.readUInt16LE(pos + 10);
    var dimC = buf.readUInt32LE(pos + 20);
    var lNome = buf.readUInt16LE(pos + 28);
    var lExtra = buf.readUInt16LE(pos + 30);
    var lComm = buf.readUInt16LE(pos + 32);
    var offLoc = buf.readUInt32LE(pos + 42);
    var nome = buf.slice(pos + 46, pos + 46 + lNome).toString('utf8');
    var inizioDati = offLoc + 30 + buf.readUInt16LE(offLoc + 26) + buf.readUInt16LE(offLoc + 28);
    var compressi = buf.slice(inizioDati, inizioDati + dimC);
    var dati = metodo === 0 ? compressi : zlib.inflateRawSync(compressi);
    out.push(new Blob(dati, null, nome));
    pos += 46 + lNome + lExtra + lComm;
  }
  return out;
}

// ---------------------------------------------------------------------------
// XmlService (parser XML semplice ma rigoroso sui tag)
// ---------------------------------------------------------------------------

function ElementoXml(nome) {
  var dueP = nome.indexOf(':');
  this._nome = dueP >= 0 ? nome.substring(dueP + 1) : nome;
  this._qnome = nome;
  this._figli = [];
  this._attributi = {};
}
ElementoXml.prototype.getName = function () { return this._nome; };
ElementoXml.prototype.getQualifiedName = function () { return this._qnome; };
ElementoXml.prototype.getChildren = function (nome) {
  return this._figli.filter(function (f) { return f instanceof ElementoXml && (!nome || f._nome === nome); });
};
ElementoXml.prototype.getChild = function (nome) { return this.getChildren(nome)[0] || null; };
ElementoXml.prototype.getText = function () {
  return this._figli.filter(function (f) { return typeof f === 'string'; }).join('');
};
ElementoXml.prototype.getValue = function () {
  return this._figli.map(function (f) { return typeof f === 'string' ? f : f.getValue(); }).join('');
};
ElementoXml.prototype.getChildText = function (nome) { var c = this.getChild(nome); return c ? c.getText() : null; };
ElementoXml.prototype.getAttribute = function (nome) {
  var v = this._attributi[nome];
  return v === undefined ? null : { getValue: function () { return v; }, getName: function () { return nome; } };
};

function decodificaEntita(s) {
  return s.replace(/&(#x[0-9a-fA-F]+|#\d+|lt|gt|amp|quot|apos);/g, function (t, e) {
    if (e === 'lt') return '<';
    if (e === 'gt') return '>';
    if (e === 'amp') return '&';
    if (e === 'quot') return '"';
    if (e === 'apos') return '\'';
    if (e[1] === 'x') return String.fromCodePoint(parseInt(e.substring(2), 16));
    return String.fromCodePoint(parseInt(e.substring(1), 10));
  });
}

function parseXml(testo) {
  var s = String(testo);
  var pos = 0;
  var radice = null;
  var pila = [];
  var errore = function (msg) { throw new Error('Errore XML: ' + msg + ' (posizione ' + pos + ')'); };
  if (s.charCodeAt(0) === 0xFEFF) pos = 1;
  while (pos < s.length) {
    var lt = s.indexOf('<', pos);
    if (lt < 0) lt = s.length;
    var testoNodo = s.substring(pos, lt);
    if (testoNodo.length) {
      if (pila.length) pila[pila.length - 1]._figli.push(decodificaEntita(testoNodo));
      else if (/\S/.test(testoNodo)) errore('testo fuori dalla radice');
    }
    if (lt >= s.length) break;
    pos = lt;
    if (s.startsWith('<?', pos)) {
      var f = s.indexOf('?>', pos);
      if (f < 0) errore('istruzione non chiusa');
      pos = f + 2;
    } else if (s.startsWith('<!--', pos)) {
      var fc = s.indexOf('-->', pos);
      if (fc < 0) errore('commento non chiuso');
      pos = fc + 3;
    } else if (s.startsWith('<![CDATA[', pos)) {
      var fd = s.indexOf(']]>', pos);
      if (fd < 0 || !pila.length) errore('CDATA non valido');
      pila[pila.length - 1]._figli.push(s.substring(pos + 9, fd));
      pos = fd + 3;
    } else if (s.startsWith('<!', pos)) {
      var fdt = s.indexOf('>', pos);
      pos = fdt + 1;
    } else if (s.startsWith('</', pos)) {
      var fe = s.indexOf('>', pos);
      var nome = s.substring(pos + 2, fe).trim();
      var aperto = pila.pop();
      if (!aperto || aperto._qnome !== nome) errore('tag di chiusura </' + nome + '> inatteso');
      pos = fe + 1;
    } else {
      var m = /^<([A-Za-z_][\w.\-]*(?::[A-Za-z_][\w.\-]*)?)((?:\s+[^\s=\/>]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>/.exec(s.substring(pos));
      if (!m) errore('tag non valido');
      var el = new ElementoXml(m[1]);
      var reAttr = /([^\s=\/>]+)\s*=\s*("([^"]*)"|'([^']*)')/g;
      var a;
      while ((a = reAttr.exec(m[2]))) el._attributi[a[1]] = decodificaEntita(a[3] !== undefined ? a[3] : a[4]);
      if (pila.length) pila[pila.length - 1]._figli.push(el);
      else if (radice) errore('più di una radice');
      else radice = el;
      if (!m[3]) pila.push(el);
      pos += m[0].length;
    }
  }
  if (pila.length) errore('elemento <' + pila[pila.length - 1]._qnome + '> non chiuso');
  if (!radice) errore('documento vuoto');
  return { getRootElement: function () { return radice; } };
}

// ---------------------------------------------------------------------------
// Fogli di calcolo in memoria
// ---------------------------------------------------------------------------

var MAX_RIGHE = 1000;

function lettereAColonna(l) {
  var n = 0;
  for (var i = 0; i < l.length; i++) n = n * 26 + (l.charCodeAt(i) - 64);
  return n;
}

function Foglio(ss, nome) {
  this._ss = ss;
  this._nome = nome;
  this._celle = []; // righe (da 0) di colonne (da 0)
  this._formati = {}; // "r,c" → formato
  this._formatiColonna = {}; // c → formato
  this._validazioni = {};
  this.larghezze = {};
  this.congelate = 0;
}
Foglio.prototype.getName = function () { return this._nome; };
Foglio.prototype.setName = function (n) { this._nome = n; return this; };
Foglio.prototype.getSheetId = function () { return this._ss._fogli.indexOf(this) + 1; };
Foglio.prototype.getParent = function () { return this._ss; };
Foglio.prototype.getLastRow = function () {
  for (var r = this._celle.length - 1; r >= 0; r--) {
    var riga = this._celle[r] || [];
    for (var c = 0; c < riga.length; c++) if (riga[c] !== '' && riga[c] !== undefined && riga[c] !== null) return r + 1;
  }
  return 0;
};
Foglio.prototype.getLastColumn = function () {
  var max = 0;
  this._celle.forEach(function (riga) {
    for (var c = (riga || []).length - 1; c >= 0; c--) {
      if (riga[c] !== '' && riga[c] !== undefined && riga[c] !== null) { max = Math.max(max, c + 1); break; }
    }
  });
  return max;
};
Foglio.prototype.getMaxRows = function () { return Math.max(MAX_RIGHE, this._celle.length); };
Foglio.prototype.getMaxColumns = function () { return 26; };
Foglio.prototype._leggi = function (r, c) {
  var riga = this._celle[r - 1];
  var v = riga ? riga[c - 1] : undefined;
  return v === undefined || v === null ? '' : v;
};
Foglio.prototype._formato = function (r, c) {
  return this._formati[r + ',' + c] || this._formatiColonna[c] || '';
};
Foglio.prototype._scrivi = function (r, c, v) {
  if (r < 1 || c < 1) throw new Error('Riga o colonna non valida');
  if (typeof v === 'string') {
    if (v.charAt(0) === '\'') {
      v = v.substring(1);
    } else if (this._formato(r, c) !== '@' && /^-?\d+(\.\d+)?$/.test(v.trim()) && v.trim().length < 16) {
      v = Number(v.trim());
    }
  }
  if (v instanceof Date) v = new Date(v.getTime());
  while (this._celle.length < r) this._celle.push([]);
  var riga = this._celle[r - 1];
  while (riga.length < c) riga.push('');
  riga[c - 1] = v;
};
Foglio.prototype.getRange = function (a, b, c, d) {
  if (typeof a === 'string') {
    var m = /^([A-Z]+)(\d*)(?::([A-Z]+)(\d*))?$/.exec(a);
    if (!m) throw new Error('getRange finto: notazione non gestita ' + a);
    var c1 = lettereAColonna(m[1]);
    var r1 = m[2] ? +m[2] : 1;
    var c2 = m[3] ? lettereAColonna(m[3]) : c1;
    var r2 = m[4] ? +m[4] : (m[3] || !m[2] ? this.getMaxRows() : r1);
    return new Intervallo(this, r1, c1, r2 - r1 + 1, c2 - c1 + 1, !m[2]);
  }
  return new Intervallo(this, a, b, c === undefined ? 1 : c, d === undefined ? 1 : d, false);
};
Foglio.prototype.getDataRange = function () {
  return new Intervallo(this, 1, 1, Math.max(1, this.getLastRow()), Math.max(1, this.getLastColumn()), false);
};
Foglio.prototype.appendRow = function (valori) {
  var r = this.getLastRow() + 1;
  for (var i = 0; i < valori.length; i++) this._scrivi(r, i + 1, valori[i]);
  return this;
};
Foglio.prototype.deleteRow = function (r) {
  if (r < 1 || r > this.getMaxRows()) throw new Error('deleteRow: riga non valida');
  this._celle.splice(r - 1, 1);
  return this;
};
Foglio.prototype.deleteRows = function (r, n) {
  this._celle.splice(r - 1, n);
  return this;
};
Foglio.prototype.insertRowBefore = function (r) { this._celle.splice(r - 1, 0, []); return this; };
Foglio.prototype.setFrozenRows = function (n) { this.congelate = n; return this; };
Foglio.prototype.setColumnWidth = function (c, w) { this.larghezze[c] = w; return this; };
Foglio.prototype.autoResizeColumns = function () { return this; };
Foglio.prototype.hideSheet = function () { this.nascosto = true; return this; };
Foglio.prototype.clear = function () { this._celle = []; return this; };
Foglio.prototype.activate = function () { return this; };
Foglio.prototype.setTabColor = function () { return this; };

function Intervallo(foglio, r, c, nr, nc, colonnaIntera) {
  if (nr < 1 || nc < 1) throw new Error('The number of rows/columns in the range must be at least 1.');
  this._f = foglio;
  this._r = r;
  this._c = c;
  this._nr = nr;
  this._nc = nc;
  this._colonnaIntera = colonnaIntera;
}
Intervallo.prototype.getValues = function () {
  var out = [];
  for (var i = 0; i < this._nr; i++) {
    var riga = [];
    for (var j = 0; j < this._nc; j++) {
      var v = this._f._leggi(this._r + i, this._c + j);
      riga.push(v instanceof Date ? new Date(v.getTime()) : v);
    }
    out.push(riga);
  }
  return out;
};
Intervallo.prototype.getDisplayValues = function () {
  return this.getValues().map(function (r) { return r.map(String); });
};
Intervallo.prototype.getValue = function () { return this.getValues()[0][0]; };
Intervallo.prototype.setValues = function (valori) {
  if (valori.length !== this._nr) throw new Error('Il numero di righe nei dati (' + valori.length + ') non corrisponde all\'intervallo (' + this._nr + ').');
  for (var i = 0; i < this._nr; i++) {
    if (valori[i].length !== this._nc) throw new Error('Il numero di colonne nei dati (' + valori[i].length + ') non corrisponde all\'intervallo (' + this._nc + ').');
    for (var j = 0; j < this._nc; j++) this._f._scrivi(this._r + i, this._c + j, valori[i][j]);
  }
  return this;
};
Intervallo.prototype.setValue = function (v) {
  for (var i = 0; i < this._nr; i++) for (var j = 0; j < this._nc; j++) this._f._scrivi(this._r + i, this._c + j, v);
  return this;
};
Intervallo.prototype.clearContent = function () {
  for (var i = 0; i < this._nr; i++) {
    for (var j = 0; j < this._nc; j++) {
      var riga = this._f._celle[this._r + i - 1];
      if (riga && riga.length >= this._c + j) riga[this._c + j - 1] = '';
    }
  }
  return this;
};
Intervallo.prototype.setNumberFormat = function (formato) {
  if (this._colonnaIntera) {
    for (var j = 0; j < this._nc; j++) this._f._formatiColonna[this._c + j] = formato;
  } else {
    for (var i = 0; i < this._nr; i++) for (var k = 0; k < this._nc; k++) this._f._formati[(this._r + i) + ',' + (this._c + k)] = formato;
  }
  return this;
};
Intervallo.prototype.getNumberFormat = function () { return this._f._formato(this._r, this._c) || 'General'; };
Intervallo.prototype.setDataValidation = function (v) {
  for (var j = 0; j < this._nc; j++) this._f._validazioni[this._c + j] = v;
  return this;
};
Intervallo.prototype.getRow = function () { return this._r; };
Intervallo.prototype.getColumn = function () { return this._c; };
Intervallo.prototype.getNumRows = function () { return this._nr; };
Intervallo.prototype.getNumColumns = function () { return this._nc; };
['setFontWeight', 'setBackground', 'setFontSize', 'setFontColor', 'setWrap', 'setHorizontalAlignment',
  'setVerticalAlignment', 'setNote', 'setBorder', 'setFontStyle'].forEach(function (m) {
  Intervallo.prototype[m] = function () { return this; };
});

var contatoreId = 0;
function nuovoIdFinto(prefisso) {
  contatoreId++;
  return prefisso + '_' + contatoreId + '_' + crypto.randomBytes(4).toString('hex');
}

function FoglioDiCalcolo(nome) {
  this._nome = nome;
  this._id = nuovoIdFinto('ss');
  this._fogli = [];
  this.fuso = 'Europe/Rome';
  this.lingua = 'it_IT';
  this._fogli.push(new Foglio(this, 'Foglio1'));
}
FoglioDiCalcolo.prototype.getId = function () { return this._id; };
FoglioDiCalcolo.prototype.getName = function () { return this._nome; };
FoglioDiCalcolo.prototype.getUrl = function () { return 'https://docs.google.com/spreadsheets/d/' + this._id + '/edit'; };
FoglioDiCalcolo.prototype.getSheetByName = function (n) {
  for (var i = 0; i < this._fogli.length; i++) if (this._fogli[i]._nome === n) return this._fogli[i];
  return null;
};
FoglioDiCalcolo.prototype.getSheets = function () { return this._fogli.slice(); };
FoglioDiCalcolo.prototype.insertSheet = function (n) {
  if (this.getSheetByName(n)) throw new Error('Esiste già un foglio con il nome "' + n + '".');
  var f = new Foglio(this, n);
  this._fogli.push(f);
  return f;
};
FoglioDiCalcolo.prototype.deleteSheet = function (f) {
  if (this._fogli.length < 2) throw new Error('Non puoi eliminare tutti i fogli');
  this._fogli.splice(this._fogli.indexOf(f), 1);
};
FoglioDiCalcolo.prototype.setSpreadsheetTimeZone = function (f) { this.fuso = f; };
FoglioDiCalcolo.prototype.getSpreadsheetTimeZone = function () { return this.fuso; };
FoglioDiCalcolo.prototype.setSpreadsheetLocale = function (l) { this.lingua = l; };
FoglioDiCalcolo.prototype.toast = function () {};
FoglioDiCalcolo.prototype.setActiveSheet = function (f) { return f; };

// ---------------------------------------------------------------------------
// Drive in memoria
// ---------------------------------------------------------------------------

function Iteratore(elenco) {
  var i = 0;
  return { hasNext: function () { return i < elenco.length; }, next: function () { return elenco[i++]; } };
}

function Cartella(nome, madre) {
  this._id = nuovoIdFinto('cartella');
  this._nome = nome;
  this._madre = madre || null;
  this._cestino = false;
  this.lettori = [];
  this.condivisione = null;
  this.creata = new Date();
  drive.cartelle[this._id] = this;
}
Cartella.prototype.getId = function () { return this._id; };
Cartella.prototype.getName = function () { return this._nome; };
Cartella.prototype.getUrl = function () { return 'https://drive.google.com/drive/folders/' + this._id; };
Cartella.prototype.isTrashed = function () { return this._cestino; };
Cartella.prototype.setTrashed = function (v) { this._cestino = !!v; return this; };
Cartella.prototype._sottocartelle = function () {
  var self = this;
  return Object.keys(drive.cartelle).map(function (k) { return drive.cartelle[k]; })
    .filter(function (c) { return c._madre === self && !c._cestino; });
};
Cartella.prototype._file = function () {
  var self = this;
  return Object.keys(drive.file).map(function (k) { return drive.file[k]; })
    .filter(function (f) { return f._cartella === self && !f._cestino; });
};
Cartella.prototype.getFoldersByName = function (n) {
  return Iteratore(this._sottocartelle().filter(function (c) { return c._nome === n; }));
};
Cartella.prototype.getFolders = function () { return Iteratore(this._sottocartelle()); };
Cartella.prototype.getFiles = function () { return Iteratore(this._file()); };
Cartella.prototype.getFilesByName = function (n) {
  return Iteratore(this._file().filter(function (f) { return f._nome === n; }));
};
Cartella.prototype.createFolder = function (n) { return new Cartella(n, this); };
Cartella.prototype.createFile = function (blob) {
  if (!(blob instanceof Blob)) throw new Error('createFile finto: serve un Blob');
  return new FileDrive(blob.getName() || 'senza nome', blob.copyBlob(), this);
};
Cartella.prototype.addViewer = function (email) {
  if (!/@/.test(email)) throw new Error('Indirizzo email non valido: ' + email);
  this.lettori.push(email);
  return this;
};
Cartella.prototype.setSharing = function (a, p) { this.condivisione = [a, p]; return this; };
Cartella.prototype.getParents = function () { return Iteratore(this._madre ? [this._madre] : []); };

function FileDrive(nome, blob, cartella) {
  this._id = nuovoIdFinto('file');
  this._nome = nome;
  this._blob = blob;
  this._cartella = cartella;
  this._cestino = false;
  this._creato = new Date();
  drive.file[this._id] = this;
}
FileDrive.prototype.getId = function () { return this._id; };
FileDrive.prototype.getName = function () { return this._nome; };
FileDrive.prototype.setName = function (n) { this._nome = n; return this; };
FileDrive.prototype.getUrl = function () { return 'https://drive.google.com/file/d/' + this._id + '/view?usp=drivesdk'; };
FileDrive.prototype.getBlob = function () { return this._blob.copyBlob().setName(this._nome); };
FileDrive.prototype.getMimeType = function () { return this._blob.getContentType(); };
FileDrive.prototype.getSize = function () { return this._blob._buf.length; };
FileDrive.prototype.isTrashed = function () { return this._cestino; };
FileDrive.prototype.setTrashed = function (v) { this._cestino = !!v; return this; };
FileDrive.prototype.moveTo = function (c) { this._cartella = c; return this; };
FileDrive.prototype.getDateCreated = function () { return new Date(this._creato.getTime()); };
FileDrive.prototype.getLastUpdated = function () { return new Date(this._creato.getTime()); };
FileDrive.prototype.getParents = function () { return Iteratore(this._cartella ? [this._cartella] : []); };
FileDrive.prototype.makeCopy = function (nome, cartella) {
  var copia = new FileDrive(nome || ('Copia di ' + this._nome), this._blob.copyBlob(), cartella || this._cartella);
  if (this._ss) copia._ss = this._ss;
  return copia;
};

var drive = { cartelle: {}, file: {}, radice: null };

// ---------------------------------------------------------------------------
// Modelli HTML (HtmlService.createTemplateFromFile): <?= ?> con escape, <?!= ?> senza, <? ?> codice
// ---------------------------------------------------------------------------

function escapeHtml(v) {
  return String(v === undefined || v === null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function compilaModello(testo) {
  var codice = 'var __o = [];\n';
  var re = /<\?(!?=)?([\s\S]*?)\?>/g;
  var ultimo = 0;
  var m;
  while ((m = re.exec(testo))) {
    codice += '__o.push(' + JSON.stringify(testo.substring(ultimo, m.index)) + ');\n';
    if (m[1] === '=') codice += '__o.push(__esc(' + m[2] + '));\n';
    else if (m[1] === '!=') codice += '__o.push(String(' + m[2] + '));\n';
    else codice += m[2] + '\n';
    ultimo = re.lastIndex;
  }
  codice += '__o.push(' + JSON.stringify(testo.substring(ultimo)) + ');\nreturn __o.join("");';
  return codice;
}

function UscitaHtml(contenuto) { this._contenuto = contenuto; }
UscitaHtml.prototype.getContent = function () { return this._contenuto; };
UscitaHtml.prototype.setTitle = function () { return this; };
UscitaHtml.prototype.getBlob = function () { return new Blob(this._contenuto, 'text/html', 'pagina.html'); };
UscitaHtml.prototype.getAs = function (tipo) {
  if (tipo !== 'application/pdf') throw new Error('getAs finto: solo application/pdf');
  // PDF "finto": l'intestazione di un PDF seguita dall'HTML, così le prove possono leggerne il contenuto.
  return new Blob('%PDF-1.4 (finto)\n' + this._contenuto, 'application/pdf', 'documento.pdf');
};

function nuovoModello(nome) {
  var percorso = require('path').join(__dirname, '..', nome + '.html');
  var testo = require('fs').readFileSync(percorso, 'utf8');
  var modello = {
    evaluate: function () {
      var variabili = {};
      Object.keys(modello).forEach(function (k) { if (k !== 'evaluate') variabili[k] = modello[k]; });
      var nomi = Object.keys(variabili);
      /* eslint-disable no-new-func */
      var f = new Function(['__esc'].concat(nomi).join(','), compilaModello(testo));
      return new UscitaHtml(f.apply(null, [escapeHtml].concat(nomi.map(function (n) { return variabili[n]; }))));
    }
  };
  return modello;
}

// ---------------------------------------------------------------------------
// Installazione degli oggetti globali
// ---------------------------------------------------------------------------

var attivo = null;
var cache = {};
var proprieta = {};
var ultimoLock = { preso: false };

function azzera() {
  drive.cartelle = {};
  drive.file = {};
  drive.radice = new Cartella('Il mio Drive', null);
  attivo = new FoglioDiCalcolo('Bar – Spese e Cassa');
  var f = new FileDrive(attivo.getName(), new Blob('', 'application/vnd.google-apps.spreadsheet'), drive.radice);
  f._id = attivo.getId();
  drive.file[f._id] = f;
  f._ss = attivo;
  cache = {};
  proprieta = {};
  finto.email = [];
  finto.trigger = [];
  finto.log = [];
}

function creaTrigger(funzione) {
  var cfg = { funzione: funzione };
  var costruttore = {
    timeBased: function () { cfg.tipo = 'tempo'; return costruttore; },
    onMonthDay: function (g) { cfg.giornoMese = g; return costruttore; },
    onWeekDay: function (g) { cfg.giornoSettimana = g; return costruttore; },
    everyDays: function (n) { cfg.ogniGiorni = n; return costruttore; },
    everyWeeks: function (n) { cfg.ogniSettimane = n; return costruttore; },
    everyHours: function (n) { cfg.ogniOre = n; return costruttore; },
    atHour: function (h) { cfg.ora = h; return costruttore; },
    nearMinute: function (m) { cfg.minuto = m; return costruttore; },
    inTimezone: function (f) { cfg.fuso = f; return costruttore; },
    create: function () {
      var t = {
        getHandlerFunction: function () { return funzione; },
        getUniqueId: function () { return 'trig_' + finto.trigger.indexOf(cfg); },
        _cfg: cfg
      };
      cfg.oggetto = t;
      finto.trigger.push(cfg);
      return t;
    }
  };
  return costruttore;
}

function installa(globale) {
  azzera();
  globale.Utilities = {
    formatDate: formatDate,
    parseDate: parseDate,
    getUuid: function () { return crypto.randomUUID(); },
    base64Encode: function (b) { return aBuffer(b).toString('base64'); },
    base64EncodeWebSafe: function (b) { return aBuffer(b).toString('base64').replace(/\+/g, '-').replace(/\//g, '_'); },
    base64Decode: function (s) {
      if (!/^[A-Za-z0-9+\/=\s]*$/.test(s)) throw new Error('Could not decode string.');
      return aSegno(Buffer.from(s, 'base64'));
    },
    base64DecodeWebSafe: function (s) { return aSegno(Buffer.from(String(s).replace(/-/g, '+').replace(/_/g, '/'), 'base64')); },
    newBlob: function (dati, tipo, nome) { return new Blob(dati, tipo, nome); },
    zip: function (blobs, nome) { return new Blob(creaZip(blobs), 'application/zip', nome || 'archivio.zip'); },
    unzip: function (blob) { return leggiZip(blob._buf); },
    sleep: function () {},
    computeDigest: function (alg, testo) {
      return aSegno(crypto.createHash('sha256').update(String(testo), 'utf8').digest());
    },
    DigestAlgorithm: { SHA_256: 'SHA_256', MD5: 'MD5' },
    Charset: { UTF_8: 'UTF-8' }
  };
  globale.XmlService = { parse: parseXml };
  globale.SpreadsheetApp = {
    getActiveSpreadsheet: function () { return attivo; },
    getActive: function () { return attivo; },
    openById: function (id) {
      if (id === attivo.getId()) return attivo;
      var f = drive.file[id];
      if (f && f._ss) return f._ss;
      throw new Error('Foglio non trovato: ' + id);
    },
    create: function (nome) {
      var ss = new FoglioDiCalcolo(nome);
      var f = new FileDrive(nome, new Blob('', 'application/vnd.google-apps.spreadsheet'), drive.radice);
      f._id = ss.getId();
      drive.file[f._id] = f;
      f._ss = ss;
      return ss;
    },
    flush: function () {},
    getUi: function () { throw new Error('Cannot call SpreadsheetApp.getUi() from this context.'); },
    newDataValidation: function () {
      var v = {};
      var b = {
        requireValueInList: function (l, menu) { v.lista = l; v.menu = menu; return b; },
        requireCheckbox: function () { v.casella = true; return b; },
        setAllowInvalid: function (x) { v.invalidi = x; return b; },
        setHelpText: function (t) { v.aiuto = t; return b; },
        build: function () { return v; }
      };
      return b;
    }
  };
  globale.DriveApp = {
    getRootFolder: function () { return drive.radice; },
    createFolder: function (n) { return new Cartella(n, drive.radice); },
    getFolderById: function (id) {
      var c = drive.cartelle[id];
      if (!c) throw new Error('Cartella non trovata: ' + id);
      return c;
    },
    getFileById: function (id) {
      var f = drive.file[id];
      if (!f) throw new Error('File non trovato: ' + id);
      return f;
    },
    getFoldersByName: function (n) {
      return Iteratore(Object.keys(drive.cartelle).map(function (k) { return drive.cartelle[k]; })
        .filter(function (c) { return c._nome === n && !c._cestino; }));
    },
    Access: { ANYONE_WITH_LINK: 'ANYONE_WITH_LINK', PRIVATE: 'PRIVATE' },
    Permission: { VIEW: 'VIEW', EDIT: 'EDIT' }
  };
  globale.LockService = {
    getScriptLock: function () {
      return {
        waitLock: function () { ultimoLock.preso = true; },
        tryLock: function () { ultimoLock.preso = true; return true; },
        releaseLock: function () { ultimoLock.preso = false; },
        hasLock: function () { return ultimoLock.preso; }
      };
    }
  };
  globale.CacheService = {
    getScriptCache: function () {
      return {
        get: function (k) { return cache[k] === undefined ? null : cache[k]; },
        put: function (k, v) { cache[k] = String(v); },
        remove: function (k) { delete cache[k]; }
      };
    }
  };
  globale.PropertiesService = {
    getScriptProperties: function () {
      return {
        getProperty: function (k) { return proprieta[k] === undefined ? null : proprieta[k]; },
        setProperty: function (k, v) { proprieta[k] = String(v); return this; },
        deleteProperty: function (k) { delete proprieta[k]; return this; }
      };
    }
  };
  globale.MailApp = {
    sendEmail: function (a, b, c) {
      var msg = typeof a === 'object' ? a : { to: a, subject: b, body: c };
      if (!msg.to) throw new Error('Destinatario mancante');
      finto.email.push(msg);
    },
    getRemainingDailyQuota: function () { return 100; }
  };
  globale.ScriptApp = {
    getProjectTriggers: function () { return finto.trigger.map(function (c) { return c.oggetto; }); },
    newTrigger: creaTrigger,
    deleteTrigger: function (t) {
      finto.trigger = finto.trigger.filter(function (c) { return c.oggetto !== t; });
    },
    getOAuthToken: function () { return 'token-finto'; },
    getService: function () { return { getUrl: function () { return 'https://script.google.com/macros/s/finto/exec'; } }; },
    WeekDay: { MONDAY: 'MONDAY', TUESDAY: 'TUESDAY', WEDNESDAY: 'WEDNESDAY', THURSDAY: 'THURSDAY', FRIDAY: 'FRIDAY', SATURDAY: 'SATURDAY', SUNDAY: 'SUNDAY' }
  };
  globale.Session = {
    getEffectiveUser: function () { return { getEmail: function () { return finto.utente; } }; },
    getActiveUser: function () { return { getEmail: function () { return finto.utente; } }; },
    getScriptTimeZone: function () { return 'Europe/Rome'; }
  };
  globale.UrlFetchApp = {
    fetch: function () {
      return {
        getResponseCode: function () { return 200; },
        getBlob: function () { return new Blob('excel finto', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'); },
        getContentText: function () { return ''; }
      };
    }
  };
  globale.Logger = { log: function (m) { finto.log.push(String(m)); } };
  globale.HtmlService = {
    createHtmlOutputFromFile: function () { throw new Error('HtmlService non disponibile nelle prove'); },
    createTemplateFromFile: function (nome) { return nuovoModello(nome); },
    XFrameOptionsMode: { DEFAULT: 'DEFAULT', ALLOWALL: 'ALLOWALL' }
  };
}

module.exports = {
  installa: installa,
  azzera: azzera,
  finto: finto,
  drive: drive,
  foglioAttivo: function () { return attivo; },
  Blob: Blob,
  formatDate: formatDate,
  parseDate: parseDate
};
