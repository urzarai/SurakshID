// services/watchlistService.js
// Watchlist data layer for AML screening.
// Manages two data sources — both free, no API key required:
//   1. OFAC Consolidated Sanctions List — CSV format
//   2. UN Security Council Consolidated Sanctions List — XML format
//
// Environment behaviour:
//   Development — loads from local files in backend/data/
//   Production  — downloads from URLs set in OFAC_CSV_URL and UN_XML_URL env vars
//
// A weekly cron job refreshes both lists every Monday at 2:00 AM.
//
// Exports:
//   initWatchlists()      — call once at server startup
//   getOfacList()         — returns in-memory OFAC entries
//   getUnList()           — returns in-memory UN entries
//   getWatchlistStatus()  — returns metadata about loaded lists

const { parse } = require('csv-parse');
const cron      = require('node-cron');
const xml2js    = require('xml2js');
const fs        = require('fs');
const path      = require('path');
const https     = require('https');
const http      = require('http');

// ─── In-memory stores ─────────────────────────────────────────────────────────
let ofacEntries    = [];
let unEntries      = [];
let lastOfacRefresh = null;
let lastUnRefresh   = null;

// ─── Environment flag ─────────────────────────────────────────────────────────
const IS_PROD = process.env.NODE_ENV === 'production';

// ─── Local file paths (development only) ─────────────────────────────────────
const OFAC_CSV_PATH = path.join(__dirname, '..', 'data', 'ofac_consolidated.csv.csv');
const UN_XML_PATH   = path.join(__dirname, '..', 'data', 'un_consolidated.xml.xml');

// ─── Generic HTTP/HTTPS downloader (production only) ─────────────────────────
const downloadFile = (url) => {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const chunks = [];

    const req = client.get(url, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        return downloadFile(response.headers.location).then(resolve).catch(reject);
      }
      if (response.statusCode !== 200) {
        return reject(new Error(`HTTP ${response.statusCode} for ${url}`));
      }
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end',  () => resolve(Buffer.concat(chunks).toString('utf-8')));
      response.on('error', reject);
    });

    req.setTimeout(60000, () => {
      req.destroy();
      reject(new Error(`Request timed out after 60s for: ${url}`));
    });

    req.on('error', (err) => reject(new Error(`Request error: ${err.message}`)));
  });
};

// ─── Get OFAC CSV data (local or remote) ─────────────────────────────────────
const getOfacCsvData = async () => {
  if (IS_PROD) {
    const url = process.env.OFAC_CSV_URL;
    if (!url) throw new Error('OFAC_CSV_URL environment variable is not set.');
    console.log('[Watchlist] Downloading OFAC list from remote URL...');
    return await downloadFile(url);
  }

  if (!fs.existsSync(OFAC_CSV_PATH)) {
    throw new Error(
      `OFAC file not found at: ${OFAC_CSV_PATH}. ` +
      `Download from https://ofac.treasury.gov/downloads/consolidated.csv and place in backend/data/`
    );
  }

  console.log('[Watchlist] Loading OFAC list from local file...');
  return fs.readFileSync(OFAC_CSV_PATH, 'utf-8');
};

// ─── Get UN XML data (local or remote) ───────────────────────────────────────
const getUnXmlData = async () => {
  if (IS_PROD) {
    const url = process.env.UN_XML_URL;
    if (!url) throw new Error('UN_XML_URL environment variable is not set.');
    console.log('[Watchlist] Downloading UN sanctions list from remote URL...');
    return await downloadFile(url);
  }

  if (!fs.existsSync(UN_XML_PATH)) {
    throw new Error(
      `UN file not found at: ${UN_XML_PATH}. ` +
      `Download from https://scsanctions.un.org/resources/xml/en/consolidated.xml and place in backend/data/`
    );
  }

  console.log('[Watchlist] Loading UN sanctions list from local file...');
  return fs.readFileSync(UN_XML_PATH, 'utf-8');
};

// ─── Load OFAC CSV ────────────────────────────────────────────────────────────
const loadOfacList = async () => {
  const csvData = await getOfacCsvData();

  return new Promise((resolve, reject) => {
    parse(
      csvData,
      {
        columns:             true,
        skip_empty_lines:    true,
        trim:                true,
        relax_column_count:  true,
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
              name:       name.trim(),
              type:       r.Type || r['SDN Type'] || '',
              program:    r.Program || r.program || '',
              remarks:    r.Remarks || r.remarks || '',
              listSource: 'OFAC Consolidated',
            };
          })
          .filter((e) => e.name.length > 0);

        lastOfacRefresh = new Date();
        console.log(
          `[Watchlist] OFAC list loaded: ${ofacEntries.length} entries. ` +
          `Refreshed: ${lastOfacRefresh.toISOString()}`
        );
        resolve();
      }
    );
  });
};

// ─── Load UN XML ──────────────────────────────────────────────────────────────
const loadUnList = async () => {
  const xmlData = await getUnXmlData();

  const parser = new xml2js.Parser({ explicitArray: true });
  const result = await parser.parseStringPromise(xmlData);
  const entries = [];

  // ── Individuals ──
  try {
    const individuals =
      result?.CONSOLIDATED_LIST?.INDIVIDUALS?.[0]?.INDIVIDUAL || [];

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
          name:        fullName,
          type:        'Individual',
          listSource:  'UN Security Council',
          nationality: individual?.NATIONALITY?.[0]?.VALUE?.[0] || null,
          designation: individual?.DESIGNATION?.[0]?.VALUE?.[0] || null,
        });
      }

      const aliases = individual?.INDIVIDUAL_ALIAS || [];
      for (const alias of aliases) {
        const aliasName = alias?.ALIAS_NAME?.[0] || '';
        if (aliasName && aliasName !== fullName) {
          entries.push({
            name:        aliasName.trim(),
            type:        'Individual (Alias)',
            listSource:  'UN Security Council',
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
    const entities =
      result?.CONSOLIDATED_LIST?.ENTITIES?.[0]?.ENTITY || [];

    for (const entity of entities) {
      const name = entity?.FIRST_NAME?.[0] || entity?.ENTITY_NAME?.[0] || '';
      if (name) {
        entries.push({
          name:        name.trim(),
          type:        'Entity',
          listSource:  'UN Security Council',
          designation: entity?.DESIGNATION?.[0]?.VALUE?.[0] || null,
        });
      }

      const aliases = entity?.ENTITY_ALIAS || [];
      for (const alias of aliases) {
        const aliasName = alias?.ALIAS_NAME?.[0] || '';
        if (aliasName) {
          entries.push({
            name:       aliasName.trim(),
            type:       'Entity (Alias)',
            listSource: 'UN Security Council',
          });
        }
      }
    }
  } catch (e) {
    console.warn('[Watchlist] Could not parse UN entities section:', e.message);
  }

  unEntries      = entries.filter((e) => e.name.length > 0);
  lastUnRefresh  = new Date();
  console.log(
    `[Watchlist] UN list loaded: ${unEntries.length} entries. ` +
    `Refreshed: ${lastUnRefresh.toISOString()}`
  );
};

// ─── Getters ──────────────────────────────────────────────────────────────────
const getOfacList = () => ofacEntries;
const getUnList   = () => unEntries;

const getWatchlistStatus = () => ({
  ofac: {
    loaded:      ofacEntries.length > 0,
    entryCount:  ofacEntries.length,
    lastRefresh: lastOfacRefresh,
  },
  un: {
    loaded:      unEntries.length > 0,
    entryCount:  unEntries.length,
    lastRefresh: lastUnRefresh,
  },
});

// ─── Init + Cron ──────────────────────────────────────────────────────────────
const initWatchlists = async () => {
  try {
    await loadOfacList();
  } catch (error) {
    console.error(`[Watchlist] OFAC load failed: ${error.message}`);
    console.warn('[Watchlist] OFAC screening will be skipped until data loads.');
  }

  try {
    await loadUnList();
  } catch (error) {
    console.error(`[Watchlist] UN load failed: ${error.message}`);
    console.warn('[Watchlist] UN screening will be skipped until data loads.');
  }

  // Weekly refresh — every Monday at 2:00 AM
  cron.schedule('0 2 * * 1', async () => {
    console.log('[Watchlist] Running weekly refresh...');
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