// services/watchlistService.js
// Watchlist data layer for AML screening.
// Manages two data sources — both free, no API key required:
//   1. OFAC Consolidated Sanctions List — loaded from local CSV file
//      covers all OFAC programs including SDN (Specially Designated Nationals)
//   2. UN Security Council Consolidated Sanctions List — loaded from local XML file
//      global sanctions list used by banks worldwide
//
// Files are downloaded manually and placed in backend/data/
// A weekly cron job re-reads the local files (refresh them manually or automate later)
//
// Exports:
//   initWatchlists()      — call once at server startup
//   getOfacList()         — returns in-memory OFAC entries
//   getUnList()           — returns in-memory UN entries
//   getWatchlistStatus()  — returns metadata about loaded lists

const { parse } = require('csv-parse');
const cron = require('node-cron');
const xml2js = require('xml2js');
const fs = require('fs');
const path = require('path');

// ─── In-memory stores ─────────────────────────────────────────────────────────
let ofacEntries = [];
let unEntries = [];
let lastOfacRefresh = null;
let lastUnRefresh = null;

// ─── Local file paths ─────────────────────────────────────────────────────────
const OFAC_CSV_PATH = path.join(__dirname, '..', 'data', 'ofac_consolidated.csv');
const UN_XML_PATH   = path.join(__dirname, '..', 'data', 'un_consolidated.xml');

// ─── Load OFAC CSV from local file ───────────────────────────────────────────
const loadOfacList = () => {
  return new Promise((resolve, reject) => {
    console.log('[Watchlist] Loading OFAC list from local file...');

    if (!fs.existsSync(OFAC_CSV_PATH)) {
      return reject(new Error(`OFAC file not found at: ${OFAC_CSV_PATH}. Download it from https://ofac.treasury.gov/downloads/consolidated.csv and place it in backend/data/`));
    }

    const csvData = fs.readFileSync(OFAC_CSV_PATH, 'utf-8');

    parse(
      csvData,
      {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        relax_column_count: true,
      },
      (err, records) => {
        if (err) return reject(new Error(`OFAC CSV parse error: ${err.message}`));

        ofacEntries = records
          .map((r) => {
            const name =
              r.Name ||
              r.name ||
              [r['First Name'], r['Last Name']].filter(Boolean).join(' ') ||
              '';
            return {
              name: name.trim(),
              type: r.Type || r['SDN Type'] || '',
              program: r.Program || r.program || '',
              remarks: r.Remarks || r.remarks || '',
              listSource: 'OFAC Consolidated',
            };
          })
          .filter((e) => e.name.length > 0);

        lastOfacRefresh = new Date();
        console.log(`[Watchlist] OFAC list loaded: ${ofacEntries.length} entries. Refreshed: ${lastOfacRefresh.toISOString()}`);
        resolve();
      }
    );
  });
};

// ─── Load UN XML from local file ─────────────────────────────────────────────
const loadUnList = async () => {
  console.log('[Watchlist] Loading UN sanctions list from local file...');

  if (!fs.existsSync(UN_XML_PATH)) {
    throw new Error(`UN file not found at: ${UN_XML_PATH}. Download it from https://scsanctions.un.org/resources/xml/en/consolidated.xml and place it in backend/data/`);
  }

  const xmlData = fs.readFileSync(UN_XML_PATH, 'utf-8');

  const parser = new xml2js.Parser({ explicitArray: true });
  const result = await parser.parseStringPromise(xmlData);

  const entries = [];

  // ── Individuals ──
  try {
    const individuals = result?.CONSOLIDATED_LIST?.INDIVIDUALS?.[0]?.INDIVIDUAL || [];

    for (const individual of individuals) {
      const firstName  = individual?.FIRST_NAME?.[0]  || '';
      const secondName = individual?.SECOND_NAME?.[0] || '';
      const thirdName  = individual?.THIRD_NAME?.[0]  || '';
      const fourthName = individual?.FOURTH_NAME?.[0] || '';

      const fullName = [firstName, secondName, thirdName, fourthName]
        .filter(Boolean)
        .join(' ')
        .trim();

      if (fullName) {
        entries.push({
          name: fullName,
          type: 'Individual',
          listSource: 'UN Security Council',
          nationality: individual?.NATIONALITY?.[0]?.VALUE?.[0] || null,
          designation: individual?.DESIGNATION?.[0]?.VALUE?.[0] || null,
        });
      }

      const aliases = individual?.INDIVIDUAL_ALIAS || [];
      for (const alias of aliases) {
        const aliasName = alias?.ALIAS_NAME?.[0] || '';
        if (aliasName && aliasName !== fullName) {
          entries.push({
            name: aliasName.trim(),
            type: 'Individual (Alias)',
            listSource: 'UN Security Council',
            nationality: individual?.NATIONALITY?.[0]?.VALUE?.[0] || null,
            designation: individual?.DESIGNATION?.[0]?.VALUE?.[0] || null,
          });
        }
      }
    }
  } catch (e) {
    console.warn('[Watchlist] Could not parse UN individuals section:', e.message);
  }

  // ── Entities ──
  try {
    const entities = result?.CONSOLIDATED_LIST?.ENTITIES?.[0]?.ENTITY || [];

    for (const entity of entities) {
      const name = entity?.FIRST_NAME?.[0] || entity?.ENTITY_NAME?.[0] || '';
      if (name) {
        entries.push({
          name: name.trim(),
          type: 'Entity',
          listSource: 'UN Security Council',
          designation: entity?.DESIGNATION?.[0]?.VALUE?.[0] || null,
        });
      }

      const aliases = entity?.ENTITY_ALIAS || [];
      for (const alias of aliases) {
        const aliasName = alias?.ALIAS_NAME?.[0] || '';
        if (aliasName) {
          entries.push({
            name: aliasName.trim(),
            type: 'Entity (Alias)',
            listSource: 'UN Security Council',
          });
        }
      }
    }
  } catch (e) {
    console.warn('[Watchlist] Could not parse UN entities section:', e.message);
  }

  unEntries = entries.filter((e) => e.name.length > 0);
  lastUnRefresh = new Date();
  console.log(`[Watchlist] UN list loaded: ${unEntries.length} entries. Refreshed: ${lastUnRefresh.toISOString()}`);
};

// ─── Getters ──────────────────────────────────────────────────────────────────
const getOfacList = () => ofacEntries;
const getUnList   = () => unEntries;

const getWatchlistStatus = () => ({
  ofac: {
    loaded: ofacEntries.length > 0,
    entryCount: ofacEntries.length,
    lastRefresh: lastOfacRefresh,
  },
  un: {
    loaded: unEntries.length > 0,
    entryCount: unEntries.length,
    lastRefresh: lastUnRefresh,
  },
});

// ─── Init + Cron ──────────────────────────────────────────────────────────────
const initWatchlists = async () => {
  try {
    await loadOfacList();
  } catch (error) {
    console.error(`[Watchlist] OFAC load failed: ${error.message}`);
  }

  try {
    await loadUnList();
  } catch (error) {
    console.error(`[Watchlist] UN load failed: ${error.message}`);
  }

  // Weekly cron re-reads local files — replace local files manually to update
  cron.schedule('0 2 * * 1', async () => {
    console.log('[Watchlist] Running weekly refresh from local files...');
    try { await loadOfacList(); } catch (e) { console.error(`[Watchlist] OFAC refresh failed: ${e.message}`); }
    try { await loadUnList();   } catch (e) { console.error(`[Watchlist] UN refresh failed: ${e.message}`); }
    console.log('[Watchlist] Weekly refresh complete.');
  });

  console.log('[Watchlist] Weekly refresh cron scheduled (every Monday at 2:00 AM).');
};

module.exports = {
  initWatchlists,
  getOfacList,
  getUnList,
  getWatchlistStatus,
};