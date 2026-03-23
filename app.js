/* ============================================================
   Player Participation — app.js
   Shared logic, data modules, and utilities
   ============================================================ */

'use strict';

/* ────────────────────────────────────────────
   KEYS
──────────────────────────────────────────── */
const PP_KEYS = {
  roster:     'pp_roster',
  games:      'pp_games',
  formations: 'pp_formations',
  plays:      (gameId) => `pp_plays_${gameId}`,
};

/* ────────────────────────────────────────────
   LOCALSTORAGE HELPERS
──────────────────────────────────────────── */
function ppGet(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw !== null ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function ppSet(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error('ppSet failed:', key, e);
  }
}

function ppUpdate(key, fn) {
  const current = ppGet(key);
  const next    = fn(current);
  ppSet(key, next);
  return next;
}

/* ────────────────────────────────────────────
   MODULE: ROSTER
──────────────────────────────────────────── */
function getRoster() {
  return ppGet(PP_KEYS.roster) ?? [];
}

function savePlayer({ id, number, name, position, unit }) {
  ppUpdate(PP_KEYS.roster, (roster) => {
    const list = roster ?? [];
    const idx  = list.findIndex(p => p.id === id);
    const player = { id: id || generateId(), number, name, position: position || '', unit };
    if (idx >= 0) {
      list[idx] = player;
    } else {
      list.push(player);
    }
    return list;
  });
}

function deletePlayer(id) {
  ppUpdate(PP_KEYS.roster, (roster) =>
    (roster ?? []).filter(p => p.id !== id)
  );
}

/**
 * Parse CSV text into an array of player objects.
 * Expected format (header optional):
 *   #,Nombre,Posición,Unidad
 *   7,Carlos Ramos,QB,OFE
 */
function parseRosterCSV(text) {
  const players = [];
  const lines   = text.split('\n').map(l => l.trim()).filter(Boolean);
  for (const line of lines) {
    const cols = parseCSVLine(line);
    if (!cols[0] || cols[0] === '#') continue;          // skip header / empty
    const [number, name, position, unit] = cols.map(c => c.trim());
    if (!name) continue;
    const validUnit = ['OFE', 'DEF', 'ST'].includes(unit) ? unit : 'OFE';
    players.push({ id: generateId(), number, name, position: position || '', unit: validUnit });
  }
  return players;
}

/* ────────────────────────────────────────────
   MODULE: GAMES (PARTIDOS)
──────────────────────────────────────────── */
function getGames() {
  return ppGet(PP_KEYS.games) ?? [];
}

function getGame(id) {
  return getGames().find(g => g.id === id) ?? null;
}

function saveGame({ id, name, date, opponent, status }) {
  ppUpdate(PP_KEYS.games, (games) => {
    const list = games ?? [];
    const game = {
      id:       id || generateId(),
      name:     name || '',
      date:     date || '',
      opponent: opponent || '',
      status:   status || 'active',
    };
    const idx = list.findIndex(g => g.id === game.id);
    if (idx >= 0) {
      list[idx] = game;
    } else {
      list.unshift(game);
    }
    return list;
  });
}

function deleteGame(id) {
  ppUpdate(PP_KEYS.games, (games) =>
    (games ?? []).filter(g => g.id !== id)
  );
  // cascade: remove plays
  localStorage.removeItem(PP_KEYS.plays(id));
}

function setCurrentGame(id) {
  try { sessionStorage.setItem('pp_current_game', id); } catch {}
}

function getCurrentGame() {
  try {
    const id = sessionStorage.getItem('pp_current_game');
    return id ? getGame(id) : null;
  } catch {
    return null;
  }
}

/* ────────────────────────────────────────────
   MODULE: PLAYS (JUGADAS)
──────────────────────────────────────────── */
function getPlays(gameId) {
  return ppGet(PP_KEYS.plays(gameId)) ?? [];
}

function savePlays(gameId, plays) {
  ppSet(PP_KEYS.plays(gameId), plays);
}

function updatePlay(gameId, playIndex, patch) {
  ppUpdate(PP_KEYS.plays(gameId), (plays) => {
    const list = plays ?? [];
    if (playIndex < 0 || playIndex >= list.length) return list;
    list[playIndex] = { ...list[playIndex], ...patch };
    return list;
  });
}

/* ────────────────────────────────────────────
   MODULE: FORMATIONS
──────────────────────────────────────────── */
function getFormations() {
  return ppGet(PP_KEYS.formations) ?? [];
}

function getFormationByName(name) {
  const target = name?.trim().toLowerCase();
  return getFormations().find(f => f.name.trim().toLowerCase() === target) ?? null;
}

function saveFormation({ id, name, unit, positions }) {
  ppUpdate(PP_KEYS.formations, (formations) => {
    const list = formations ?? [];
    const formation = {
      id:        id || generateId(),
      name:      name || '',
      unit:      unit || 'OFE',
      positions: positions || [],
      isDefault: false,
    };
    const idx = list.findIndex(f => f.id === formation.id);
    if (idx >= 0) {
      // preserve isDefault flag if it was set
      formation.isDefault = list[idx].isDefault ?? false;
      list[idx] = formation;
    } else {
      list.push(formation);
    }
    return list;
  });
}

function deleteFormation(id) {
  ppUpdate(PP_KEYS.formations, (formations) =>
    (formations ?? []).filter(f => f.id !== id)
  );
}

/* ────────────────────────────────────────────
   DEFAULT FORMATIONS
──────────────────────────────────────────── */
const DEFAULT_FORMATIONS = [
  {
    id:        'default-shotgun-spread',
    name:      'Shotgun / Spread',
    unit:      'OFE',
    isDefault: true,
    positions: [
      { id: 'WR-X',  label: 'WR-X',  x: 12, y: 60 },
      { id: 'WR-Z',  label: 'WR-Z',  x: 88, y: 60 },
      { id: 'SLOT',  label: 'SLOT',  x: 72, y: 55 },
      { id: 'OL-LT', label: 'OL-LT', x: 38, y: 72 },
      { id: 'OL-LG', label: 'OL-LG', x: 43, y: 72 },
      { id: 'C',     label: 'C',     x: 50, y: 72 },
      { id: 'OL-RG', label: 'OL-RG', x: 57, y: 72 },
      { id: 'OL-RT', label: 'OL-RT', x: 62, y: 72 },
      { id: 'QB',    label: 'QB',    x: 50, y: 80 },
      { id: 'RB',    label: 'RB',    x: 50, y: 86 },
    ],
  },
  {
    id:        'default-trips',
    name:      'Trips',
    unit:      'OFE',
    isDefault: true,
    positions: [
      { id: 'WR-X',  label: 'WR-X',  x: 12, y: 60 },
      { id: 'WR-Z',  label: 'WR-Z',  x: 72, y: 58 },
      { id: 'WR-Y',  label: 'WR-Y',  x: 80, y: 60 },
      { id: 'SLOT',  label: 'SLOT',  x: 88, y: 62 },
      { id: 'OL-LT', label: 'OL-LT', x: 38, y: 72 },
      { id: 'OL-LG', label: 'OL-LG', x: 43, y: 72 },
      { id: 'C',     label: 'C',     x: 50, y: 72 },
      { id: 'OL-RG', label: 'OL-RG', x: 57, y: 72 },
      { id: 'OL-RT', label: 'OL-RT', x: 62, y: 72 },
      { id: 'QB',    label: 'QB',    x: 50, y: 80 },
      { id: 'RB',    label: 'RB',    x: 44, y: 86 },
    ],
  },
  {
    id:        'default-empty',
    name:      'Empty',
    unit:      'OFE',
    isDefault: true,
    positions: [
      { id: 'WR-X',  label: 'WR-X',  x: 10, y: 60 },
      { id: 'WR-L2', label: 'WR-L2', x: 20, y: 62 },
      { id: 'WR-Z',  label: 'WR-Z',  x: 90, y: 60 },
      { id: 'WR-R2', label: 'WR-R2', x: 80, y: 62 },
      { id: 'SLOT',  label: 'SLOT',  x: 70, y: 58 },
      { id: 'OL-LT', label: 'OL-LT', x: 38, y: 72 },
      { id: 'OL-LG', label: 'OL-LG', x: 43, y: 72 },
      { id: 'C',     label: 'C',     x: 50, y: 72 },
      { id: 'OL-RG', label: 'OL-RG', x: 57, y: 72 },
      { id: 'OL-RT', label: 'OL-RT', x: 62, y: 72 },
      { id: 'QB',    label: 'QB',    x: 50, y: 80 },
    ],
  },
];

/**
 * Seed default formations if pp_formations is empty or missing.
 * Preserves any user-created formations; only adds defaults by id.
 */
function initDefaultFormations() {
  const existing = ppGet(PP_KEYS.formations);
  if (!existing || existing.length === 0) {
    ppSet(PP_KEYS.formations, JSON.parse(JSON.stringify(DEFAULT_FORMATIONS)));
    return;
  }
  // Add any missing defaults (identified by id)
  const existingIds = new Set(existing.map(f => f.id));
  let changed = false;
  for (const df of DEFAULT_FORMATIONS) {
    if (!existingIds.has(df.id)) {
      existing.push(JSON.parse(JSON.stringify(df)));
      changed = true;
    }
  }
  if (changed) ppSet(PP_KEYS.formations, existing);
}

/* ────────────────────────────────────────────
   PLAYSYNC CSV PARSER
──────────────────────────────────────────── */

/**
 * Parse a single CSV line respecting double-quoted fields.
 * Returns array of string values (quotes stripped).
 */
function parseCSVLine(line) {
  const result = [];
  let cur      = '';
  let inQuote  = false;

  for (let i = 0; i < line.length; i++) {
    const ch   = line[i];
    const next = line[i + 1];

    if (inQuote) {
      if (ch === '"' && next === '"') { cur += '"'; i++; }   // escaped quote
      else if (ch === '"')           { inQuote = false; }
      else                           { cur += ch; }
    } else {
      if (ch === '"')      { inQuote = true; }
      else if (ch === ',') { result.push(cur); cur = ''; }
      else                 { cur += ch; }
    }
  }
  result.push(cur);
  return result;
}

/**
 * Parse a PlaySync CSV export into an array of play objects.
 * The first non-empty line is treated as the header row.
 */
function parsePlaySyncCSV(text) {
  const lines = text.split('\n').map(l => l.trimEnd()).filter(l => l.trim());
  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0]).map(h => h.trim());

  const plays = [];
  for (let i = 1; i < lines.length; i++) {
    const vals = parseCSVLine(lines[i]);
    if (vals.every(v => !v.trim())) continue;   // skip blank rows

    const col = (name) => {
      const idx = headers.indexOf(name);
      return idx >= 0 ? (vals[idx] ?? '').trim() : '';
    };

    plays.push({
      playNumber:   col('#'),
      timestamp:    col('Timestamp'),
      drive:        col('Drive'),
      poss:         col('Poss'),
      down:         col('Down'),
      toFirst:      col('To First'),
      yardLine:     col('Yard Line'),
      yardDisplay:  col('Yard Display'),
      quarter:      col('Quarter'),
      formation:    col('Formation'),
      play:         col('Play'),
      type:         col('Type'),
      motion:       col('Motion'),
      strength:     col('Strength'),
      hash:         col('Hash'),
      yardsGained:  col('Yards Gained'),
      result:       col('Result'),
      playerNumber: col('Player #'),
      noPlay:       col('No Play'),
      penaltyType:  col('Penalty Type'),
      front:        col('Front'),
      blitz:        col('Blitz'),
      coverage:     col('Coverage'),
      notes:        col('Notes'),
      // Player Participation fields (empty on import)
      unit:         '',
      lineup:       {},    // { positionId: playerId }
      grades:       {},    // { playerId: { asignacion, ejecucion, decision, impacto, disciplina } }
    });
  }
  return plays;
}

/**
 * Create a game record and persist its plays from a PlaySync CSV.
 * @param {string} csvText  - raw CSV content
 * @param {{ name, date, opponent }} meta - game metadata
 * @returns {string} - id of the created game
 */
function createGameFromCSV(csvText, meta) {
  const id    = generateId();
  const plays = parsePlaySyncCSV(csvText);
  saveGame({ id, name: meta.name || 'Partido', date: meta.date || '', opponent: meta.opponent || '', status: 'active' });
  savePlays(id, plays);
  return id;
}

/* ────────────────────────────────────────────
   UTILITIES
──────────────────────────────────────────── */
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  try {
    // Parse as local date (avoid UTC offset shift)
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

function getUnitLabel(unit) {
  const map = { OFE: 'Ofensiva', DEF: 'Defensiva', ST: 'Equipos Especiales' };
  return map[unit] ?? unit;
}

/* ────────────────────────────────────────────
   INIT
──────────────────────────────────────────── */
initDefaultFormations();
