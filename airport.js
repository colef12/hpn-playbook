/* HPN Playbook — airport definition for playbook-core v1.
   Source: vZNY Westchester ATCT SOP Rev. 3 (revised 2026-01-12). For VATSIM use only. */
Playbook.start(H => {
'use strict';
const {$, esc, parseAtis, uniq, windStr, wxStr, verdict, gateCell, cur, pad, fmtVis, num, checked, zulu} = H;
const GATE = {N:'North', E:'East', S:'South', W:'West'};

const PAGES = [
  {id:'overview', n:'Start', r:'Overview'},
  {id:'clearance', n:'Delivery', r:'Clearance'},
  {id:'ground', n:'Ground', r:'Sequencing'},
  {id:'local', n:'Local', r:'Tower rules'},
  {id:'p10', n:'Strips', r:'Live strips'}
];
const RWYS = ['16', '34', '11', '29'];

// SOP › Operational Positions
const POSITIONS = [
  ['Clearance Delivery', 'HPN_DEL', 'Westchester Clearance Delivery', '127.250'],
  ['Ground Control', 'HPN_GND', 'Westchester Ground', '121.825'],
  ['Local Control', 'HPN_TWR', 'Westchester Tower', '118.575'],
  ['ATIS', 'KHPN_ATIS', '', '133.800']
];

function pairFrom(p){
  if (!p) return null;
  const L = p.land.filter(r => RWYS.includes(r)), D = p.dep.filter(r => RWYS.includes(r));
  return {land: L[0] || null, dep: D[0] || null, lands: L, deps: D};
}

// SOP › Clearance Delivery: HPN# for everyone; PROP# only departing 16 when NY TRACON asks.
function sidRows(pair){
  if (!pair || !pair.dep) return [];
  const rows = [['North','HPN# · maintain 3,000'], ['East','HPN# · maintain 3,000'], ['South','HPN# · maintain 3,000'], ['West','HPN# · maintain 3,000']];
  if (pair.dep === '16') rows.push(['Props, only when NY TRACON requests', 'PROP# · maintain 3,000']);
  return rows;
}

function active(){
  const hA = cur('HPN'), lA = cur('LGA');
  const hpn = hA ? parseAtis(hA.text) : null;
  const lga = lA ? parseAtis(lA.text) : null;
  const pair = pairFrom(hpn);
  const ctx = (hpn && pair && pair.dep) ? {pair: {land: pair.land || pair.dep, dep: pair.dep}, apt: hpn, lga} : null;
  if (!hpn){
    return {ctx, pageId: null, html: '<div class="col"><div class="cfg-big"><small>Active HPN configuration</small>No HPN ATIS</div>' +
      '<p>Refresh live ATIS, or paste the HPN ATIS above. The Playbook pages below work without it.</p></div>'};
  }
  // HPN often uses two runways at once ("LANDING AND DEPARTING 34, 29"): show them all
  const lands = pair ? pair.lands.join(', ') : '', deps = pair ? pair.deps.join(', ') : '';
  const cfgTxt = lands && deps ? 'Land ' + lands + ' / Depart ' + deps
    : deps ? 'Depart ' + deps : lands ? 'Land ' + lands : 'Runways not found in ATIS';
  const apprTxt = hpn.appr.length ? uniq(hpn.appr.map(a => a.kind + (a.variant ? ' ' + a.variant : '') + ' ' + a.rwy)).join(', ') : '—';
  const inUse = uniq([...(pair ? pair.lands : []), ...(pair ? pair.deps : [])]);
  const uses = r => inUse.includes(r);
  const checks = [];
  // SOP › Local Control › Intersecting runway operations
  if (pair && pair.lands.includes('29') && (uses('16') || uses('34')))
    checks.push(['Runway 29 arrivals with 16/34', 'A 29 arrival may not cross the original 29 threshold until 16/34 traffic has passed the 29 intersection, is holding short, or is airborne and turning away', verdict('warn', 'Check')]);
  // SOP › LAHSO
  if (pair && pair.lands.includes('16') && (uses('11') || uses('29')))
    checks.push(['LAHSO option', 'Land 16, hold short of 11/29: ALD 4,000 ft, groups 1–4. Daylight VFR, dry runway only', verdict('na', 'Option')]);
  if (pair && pair.lands.includes('11') && (uses('16') || uses('34')))
    checks.push(['LAHSO option', 'Land 11, hold short of 16/34: ALD 2,500 ft, group 1 only. Daylight VFR, dry runway only', verdict('na', 'Option')]);
  // SOP › Clearance Delivery › PROP#
  if (pair && pair.dep) checks.push(['PROP# departure', pair.dep === '16' ? 'Valid departing 16, only when NY TRACON requests it' : 'Not valid departing ' + pair.dep + ': runway 16 only', pair.dep === '16' ? verdict('warn', 'On request') : verdict('na', 'n/a')]);
  // LGA SOP › Page 1 coordination / LGA–LGAN LOA: LGA Final Vector and the right-turn line
  if (lga && lga.land.includes('22') && (lga.dep.includes('13') || lga.dep.includes('22')))
    checks.push(['LGA right-turn line', 'LGA is landing 22: LGA Final Vector may take the right-turn line at 4,000, or 3,000–4,000 with NOBBI/NYACK approval. If LGA takes 3,000, HPN departures are held to 2,000', verdict('warn', 'Coordinate')]);
  if (!checks.length) checks.push(['Configuration', 'No SOP restrictions apply to these runways', verdict('pass', 'Pass')]);
  // SOP › VFR Pattern Work
  const numbers = uses('34') ? '34' : uses('16') ? '16' : null;
  const sids = sidRows(pair);
  const html =
    '<div class="col">' +
      '<div class="cfg-big"><small>' + (H.test.on ? '<span class="v-fail">Test configuration · not live</span>' : 'Active HPN configuration · ATIS ' + esc(hA.code || '–')) + '</small>' + esc(cfgTxt) + '</div>' +
      '<div class="atis-meta"><span class="chip">APCH <b>' + esc(apprTxt) + '</b></span><span class="chip">' + esc(windStr(hpn.wind)) + '</span><span class="chip">' + esc(wxStr(hpn)) + '</span></div>' +
      '<div class="tw"><table><thead><tr><th>Check</th><th>Detail</th><th>Verdict</th></tr></thead><tbody>' +
        checks.map(c => '<tr><td>' + esc(c[0]) + '</td><td>' + esc(c[1]) + '</td><td>' + c[2] + '</td></tr>').join('') +
      '</tbody></table></div>' +
      (numbers ? '<p style="font-size:.9rem"><b>Pattern work on 11/29:</b> "MAKE YOUR DOWNWIND OVER THE RUNWAY ' + numbers + ' NUMBERS."</p>' : '') +
      '<p style="font-size:.9rem"><b>Releases:</b> automatic unless N90 asks for individual releases. Tower does not radar identify IFR departures.</p>' +
    '</div>' +
    '<div class="col">' +
      '<div class="tw"><table><thead><tr><th>Position</th><th>Frequency</th></tr></thead><tbody>' +
        POSITIONS.map(p => '<tr><td>' + esc(p[0]) + '</td><td class="num">' + esc(p[3]) + '</td></tr>').join('') +
        '<tr><td>LGA runways' + (lA && lA.rw ? ' (real world)' : '') + '</td><td class="num">' + (lga ? 'LDG ' + esc(lga.land.join(', ') || '—') + ' · DEP ' + esc(lga.dep.join(', ') || '—') : '—') + '</td></tr>' +
      '</tbody></table></div>' +
      (sids.length ? '<div class="tw"><table><thead><tr><th>Gate</th><th>Assign</th></tr></thead><tbody>' +
        sids.map(r => '<tr><td>' + gateCell(r[0]) + '</td><td>' + esc(r[1]) + '</td></tr>').join('') +
        '</tbody></table></div><p class="note">Initial altitude 3,000 ft. HPN SIDs have no published altitude: say "MAINTAIN 3,000".</p>' : '') +
    '</div>';
  return {ctx, pageId: null, html};
}

/* ---------- test mode ---------- */
function buildTest(){
  const z = zulu(), test = H.test;
  const appr = $('t-hpn-appr').value, dep = $('t-hpn-dep').value, also = checked('t-hpn-also');
  const wd = num('t-hpn-wd') ?? 0, ws = num('t-hpn-ws') ?? 0, wg = num('t-hpn-wg');
  const wind = ws === 0 ? '00000KT' : pad(wd === 0 ? 360 : wd, 3) + pad(ws, 2) + (wg ? 'G' + pad(wg, 2) : '') + 'KT';
  const ceil = num('t-hpn-ceil'), vis = num('t-hpn-vis') ?? 10;
  const sky = ceil === null ? 'FEW250' : 'OVC' + pad(ceil / 100, 3);
  test.atis.HPN = {text: 'HPN ATIS INFO T ' + z + 'Z. ' + wind + ' ' + fmtVis(vis) + 'SM ' + sky + ' 15/10 A2992. ' + appr + ' APCH IN USE. ' +
    also.map(r => 'VISUAL RWY ' + r + ' APCH IN USE. ').join('') + 'DEPG RWY ' + dep + '.', code: 'T', time: z + 'Z', origin: 'Test settings', rw: false};
  test.atis.LGA = $('t-lga-on').checked
    ? {text: 'LGA ATIS INFO T ' + z + 'Z. 21010KT 10SM FEW250 15/10 A2992. ' + $('t-lga-appr').value + ' APCH IN USE. DEPG RWY ' + $('t-lga-dep').value + '.', code: 'T', time: z + 'Z', origin: 'Test settings', rw: false}
    : null;
}
const PRESETS = [
  {label:'Land 16 / Depart 16', hpn:['ILS RWY 16','16',160,10,null,null,10,[]], lga:[true,'ILS RWY 22','13']},
  {label:'Land 34 / Depart 34', hpn:['ILS RWY 34','34',340,12,null,null,10,[]], lga:[true,'RNAV X RWY 31','4']},
  {label:'16 + LAHSO 11', hpn:['ILS RWY 16','16',140,8,null,null,10,['11']], lga:[true,'ILS RWY 4','13']},
  {label:'Land 29 + 34 departures', hpn:['RNAV RWY 29','34',300,14,null,null,10,[]], lga:[true,'RNAV X RWY 31','4']},
  {label:'IMC ILS 16', hpn:['ILS RWY 16','16',170,8,null,500,1.5,[]], lga:[true,'ILS RWY 22','13']},
  {label:'LGA unstaffed', hpn:['ILS RWY 34','34',330,10,null,null,10,[]], lga:[false,'ILS RWY 22','13']}
];
function applyPreset(p){
  const [appr, dep, wd, ws, wg, ceil, vis, also] = p.hpn;
  $('t-hpn-appr').value = appr; $('t-hpn-dep').value = dep;
  $('t-hpn-wd').value = wd; $('t-hpn-ws').value = ws; $('t-hpn-wg').value = wg ?? '';
  $('t-hpn-ceil').value = ceil ?? ''; $('t-hpn-vis').value = vis;
  $('t-hpn-also').querySelectorAll('input').forEach(i => { i.checked = also.includes(i.value); });
  $('t-lga-on').checked = p.lga[0]; $('t-lga-appr').value = p.lga[1]; $('t-lga-dep').value = p.lga[2];
  H.onTestChange();
}

/* ---------- departure-procedure engine data ---------- */
// SOP › Clearance Delivery › Exit Gate table
const EXITS = {SAX:'N', COATE:'N', NEION:'N', HAAYS:'N', GAYEL:'N',
  GREKI:'E', MERIT:'E', BAAYS:'E', CMK:'E', BDR:'E',
  DIXIE:'S', WHITE:'S', SHIPP:'S', WAVEY:'S',
  SBJ:'W', BIGGY:'W', LANNA:'W', PARKE:'W', ELIOT:'W', NEWEL:'W', ZIMMZ:'W'};
EXITS.BAYYS = 'E';
const GATE_FIXES = {
  North:['COATE','NEION','HAAYS','GAYEL','SAX'],
  East: ['MERIT','GREKI','BAAYS','CMK','BDR'],
  South:['WHITE','DIXIE','SHIPP','WAVEY'],
  West: ['BIGGY','LANNA','PARKE','ELIOT','NEWEL','ZIMMZ','SBJ']
};
// SOP › Clearance Delivery › Common Amendments (filed exit → from KHPN)
const AMD_FIX = {ARD:'BIGGY', BOUND:'WAVEY', CCC:'DPK', COL:'WHITE', ETX:'PARKE', FJC:'PARKE', GEDIC:'WAVEY GEDIC',
  HFD:'MERIT HFD', HOFFI:'BDR HOFFI', HTO:'BDR HOFFI HTO', HUO:'HAAYS', IGN:'GREKI', JOANI:'WHITE', LAURN:'WHITE',
  MARIO:'MERIT', NEWES:'MERIT', OWENZ:'WAVEY OWENZ', PACER:'MERIT', PNE:'BIGGY PNE', PUT:'MERIT', RAALF:'MERIT',
  RBV:{West:'BIGGY', South:'WHITE'}, STW:'SAX'};
const SID_RE = /^(HPN|PROP)(\d|#)$/;

function assignSid(ctx){
  const why = 'SOP: HPN# for all departures' + (ctx.pair.dep === '16' ? '; PROP# only if NY TRACON requests it' : '');
  return {text: 'HPN#', base: 'HPN#', extra: '', why, climbVia: false};
}

// 20 sample HPN departures for testing. [callsign, type, arrival, altitude, route, remarks, rules]
const SAMPLE_FLIGHTS = [
  ['JBU1121','A320/L','KFLL','35000','WHITE Q409 ESENT LUNNI1','/V/','I'],
  ['DAL2730','A319/L','KATL','33000','LANNA J48 MOL FLASK OZZZI2','/V/','I'],
  ['AAL4501','E75L/L','KCLT','31000','ELIOT J48 CSN FAK JOHNS ICONS5','/V/','I'],
  ['UAL3412','E75L/L','KORD','34000','GAYEL J95 SLT WATSN4','/V/','I'],
  ['EJA512','C68A/L','KPBI','41000','WAVEY EMJAY J174 ORF','/V/','I'],
  ['N650GA','GLF6/L','KVNY','45000','ZIMMZ Q42 PSB','/V/','I'],
  ['N555CL','CL35/L','KBOS','25000','MERIT HFD PUT BOSOX4','/V/','I'],
  ['N22PC','PC12/G','KACK','16000','BDR V46 ACK','/V/','I'],
  ['N172HP','C172/G','KBDR','4500','','/V/ VFR','V'],
  ['N36SR','SR22/G','KMMU','5000','SBJ V249 MMU','/V/','I'],
  ['LXJ333','E55P/L','KDCA','29000','WHITE J209 SBY TRUPS4','/V/','I'],
  ['EJA780','CL35/L','KMDW','41000','NEWEL J60 PSB','/V/','I'],
  ['N88KA','BE20/G','KALB','16000','HUO V489 ALB','/V/','I'],
  ['N900PE','PC24/L','KPVD','17000','PUT V3 PVD','/V/','I'],
  ['JBU2020','A320/L','KMCO','36000','RBV J209 MCO','/V/','I'],
  ['N66TB','TBM9/G','KPHL','18000','DIXIE V16 ENO','/V/','I'],
  ['N520FX','C56X/L','KIAD','33000','PARKE J6 DJB','/V/','I'],
  ['N456CJ','C25B/L','KBTV','27000','IGN V487 BTV','/V/','I'],
  ['DAL1290','B712/L','KDTW','33000','HPN6 NEWEL J60 DJB','/V/','I'],
  ['N12KA','BE9L/G','KHVN','6000','PROP2 BDR','/V/','I']
];

return {
  id: 'HPN', store: 'hpnpb', airports: ['HPN','LGA'], cards: ['HPN','LGA'],
  pos: {lat: 41.0686, lon: -73.7042},
  pages: PAGES,
  noAtisText: ap => ap === 'LGA' ? 'LGA\'s ATIS shows whether LGA Final Vector may take the right-turn line.' : 'Refresh, or paste an ATIS.',
  active,
  presets: PRESETS, buildTest, applyPreset,
  gateFixes: GATE_FIXES, exits: EXITS, exitRules: {}, amdAirway: {}, amdFix: AMD_FIX, sidRe: SID_RE,
  assignSid,
  initialAlt: 3000,
  samples: SAMPLE_FLIGHTS,
  depFreqs: [],
  vfrPrefix: '',
  depPhrase: p => p.text === 'HPN#' ? 'WESTCHESTER# DEPARTURE' : p.text + ' DEPARTURE',
  sidSpoken: base => base === 'HPN#' ? 'WESTCHESTER' : base.replace('#', ''),
  altNote: () => 'SOP: initial altitude 3,000; HPN SIDs have no published altitude, so use "maintain"'
};
});
