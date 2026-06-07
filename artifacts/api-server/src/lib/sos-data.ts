// 2026 NFL Schedule seed data
// Byes in 2026: weeks 5-14 (some teams)
// Each entry: [week, team, opponent, isHome, isBye]

export type ScheduleEntry = {
  season: number;
  week: number;
  team: string;
  opponent: string | null;
  isHome: boolean;
  isBye: boolean;
};

export const NFL_TEAMS = [
  "ARI", "ATL", "BAL", "BUF", "CAR", "CHI", "CIN", "CLE",
  "DAL", "DEN", "DET", "GB", "HOU", "IND", "JAX", "KC",
  "LAC", "LAR", "LV", "MIA", "MIN", "NE", "NO", "NYG",
  "NYJ", "PHI", "PIT", "SEA", "SF", "TB", "TEN", "WSH"
];

export const TEAM_FULL_NAMES: Record<string, string> = {
  ARI: "Arizona Cardinals",
  ATL: "Atlanta Falcons",
  BAL: "Baltimore Ravens",
  BUF: "Buffalo Bills",
  CAR: "Carolina Panthers",
  CHI: "Chicago Bears",
  CIN: "Cincinnati Bengals",
  CLE: "Cleveland Browns",
  DAL: "Dallas Cowboys",
  DEN: "Denver Broncos",
  DET: "Detroit Lions",
  GB: "Green Bay Packers",
  HOU: "Houston Texans",
  IND: "Indianapolis Colts",
  JAX: "Jacksonville Jaguars",
  KC: "Kansas City Chiefs",
  LAC: "Los Angeles Chargers",
  LAR: "Los Angeles Rams",
  LV: "Las Vegas Raiders",
  MIA: "Miami Dolphins",
  MIN: "Minnesota Vikings",
  NE: "New England Patriots",
  NO: "New Orleans Saints",
  NYG: "New York Giants",
  NYJ: "New York Jets",
  PHI: "Philadelphia Eagles",
  PIT: "Pittsburgh Steelers",
  SEA: "Seattle Seahawks",
  SF: "San Francisco 49ers",
  TB: "Tampa Bay Buccaneers",
  TEN: "Tennessee Titans",
  WSH: "Washington Commanders",
};

export const TEAM_DIVISIONS: Record<string, string> = {
  ARI: "NFC West", ATL: "NFC South", BAL: "AFC North", BUF: "AFC East",
  CAR: "NFC South", CHI: "NFC North", CIN: "AFC North", CLE: "AFC North",
  DAL: "NFC East", DEN: "AFC West", DET: "NFC North", GB: "NFC North",
  HOU: "AFC South", IND: "AFC South", JAX: "AFC South", KC: "AFC West",
  LAC: "AFC West", LAR: "NFC West", LV: "AFC West", MIA: "AFC East",
  MIN: "NFC North", NE: "AFC East", NO: "NFC South", NYG: "NFC East",
  NYJ: "AFC East", PHI: "NFC East", PIT: "AFC North", SEA: "NFC West",
  SF: "NFC West", TB: "NFC South", TEN: "AFC South", WSH: "NFC East",
};

// 2026 NFL Schedule - 18 weeks, all 32 teams
// Format: [week, homeTeam, awayTeam]
// Byes distributed weeks 5-14
const GAME_PAIRS_2026: [number, string, string][] = [
  // Week 1
  [1, "KC", "BUF"], [1, "PHI", "DAL"], [1, "SF", "LAR"], [1, "MIA", "NE"],
  [1, "BAL", "HOU"], [1, "DET", "MIN"], [1, "ATL", "NO"], [1, "TB", "CAR"],
  [1, "DEN", "LV"], [1, "NYJ", "LAC"], [1, "PIT", "CLE"], [1, "GB", "CHI"],
  [1, "SEA", "ARI"], [1, "TEN", "JAX"], [1, "CIN", "IND"], [1, "WSH", "NYG"],
  // Week 2
  [2, "BUF", "MIA"], [2, "DAL", "NYG"], [2, "LAR", "SEA"], [2, "NO", "ATL"],
  [2, "HOU", "IND"], [2, "MIN", "GB"], [2, "NE", "NYJ"], [2, "CAR", "WSH"],
  [2, "LV", "DEN"], [2, "LAC", "KC"], [2, "CLE", "PIT"], [2, "CHI", "DET"],
  [2, "ARI", "SF"], [2, "JAX", "TEN"], [2, "IND", "CIN"], [2, "PHI", "BAL"],
  // Week 3
  [3, "KC", "LAC"], [3, "DAL", "PHI"], [3, "SF", "SEA"], [3, "MIA", "BUF"],
  [3, "BAL", "CLE"], [3, "ATL", "TB"], [3, "DEN", "LV"], [3, "MIN", "CHI"],
  [3, "NE", "NYG"], [3, "GB", "DET"], [3, "NO", "CAR"], [3, "HOU", "TEN"],
  [3, "NYJ", "IND"], [3, "JAX", "CIN"], [3, "LAR", "ARI"], [3, "PIT", "WSH"],
  // Week 4
  [4, "PHI", "NYG"], [4, "BUF", "NE"], [4, "LAR", "SF"], [4, "CAR", "ATL"],
  [4, "CLE", "BAL"], [4, "DET", "GB"], [4, "CHI", "MIN"], [4, "TB", "NO"],
  [4, "LV", "LAC"], [4, "KC", "DEN"], [4, "PIT", "CIN"], [4, "WSH", "DAL"],
  [4, "ARI", "SEA"], [4, "TEN", "HOU"], [4, "IND", "JAX"], [4, "MIA", "NYJ"],
  // Week 5 — BYE: BAL, BUF, KC, MIA
  [5, "PHI", "DAL"], [5, "LAR", "ARI"], [5, "MIN", "DET"], [5, "ATL", "CAR"],
  [5, "NE", "PIT"], [5, "NO", "TB"], [5, "HOU", "IND"], [5, "CIN", "CLE"],
  [5, "LV", "DEN"], [5, "LAC", "NYJ"], [5, "GB", "CHI"], [5, "TEN", "JAX"],
  [5, "SEA", "SF"], [5, "WSH", "NYG"],
  // Week 6 — BYE: CHI, DAL, NYG, PHI
  [6, "KC", "LV"], [6, "BUF", "NYJ"], [6, "MIA", "NE"], [6, "BAL", "PIT"],
  [6, "CLE", "CIN"], [6, "MIN", "GB"], [6, "ATL", "NO"], [6, "CAR", "TB"],
  [6, "DEN", "LAC"], [6, "LAR", "SEA"], [6, "HOU", "JAX"], [6, "TEN", "IND"],
  [6, "ARI", "SF"], [6, "DET", "WSH"],
  // Week 7 — BYE: CIN, CLE, IND, TEN
  [7, "KC", "MIA"], [7, "PHI", "WSH"], [7, "DAL", "NYG"], [7, "SF", "LAR"],
  [7, "BUF", "BAL"], [7, "DET", "GB"], [7, "ATL", "TB"], [7, "NO", "CAR"],
  [7, "DEN", "LV"], [7, "LAC", "KC"], [7, "GB", "MIN"], [7, "HOU", "JAX"],
  [7, "NE", "NYJ"], [7, "PIT", "CHI"], [7, "SEA", "ARI"],
  // Week 8 — BYE: ATL, CAR, GB, MIN
  [8, "BAL", "PHI"], [8, "BUF", "MIA"], [8, "KC", "DEN"], [8, "DAL", "WSH"],
  [8, "CIN", "PIT"], [8, "CLE", "NE"], [8, "NO", "TB"], [8, "HOU", "TEN"],
  [8, "LV", "LAC"], [8, "DET", "CHI"], [8, "IND", "JAX"], [8, "LAR", "ARI"],
  [8, "SF", "SEA"], [8, "NYJ", "NYG"],
  // Week 9 — BYE: DEN, LAC, LV, SF
  [9, "KC", "BUF"], [9, "PHI", "MIN"], [9, "DAL", "GB"], [9, "BAL", "CIN"],
  [9, "MIA", "NE"], [9, "ATL", "CAR"], [9, "TB", "NO"], [9, "HOU", "JAX"],
  [9, "DET", "PIT"], [9, "CHI", "WSH"], [9, "NYG", "NYJ"], [9, "CLE", "IND"],
  [9, "LAR", "SEA"], [9, "ARI", "TEN"],
  // Week 10 — BYE: ARI, LAR, NO, SEA
  [10, "KC", "LAC"], [10, "BUF", "BAL"], [10, "PHI", "DAL"], [10, "MIA", "NYJ"],
  [10, "CIN", "CLE"], [10, "PIT", "NE"], [10, "GB", "ATL"], [10, "TB", "CAR"],
  [10, "DEN", "LV"], [10, "DET", "CHI"], [10, "MIN", "WSH"], [10, "HOU", "IND"],
  [10, "TEN", "JAX"], [10, "SF", "NYG"],
  // Week 11 — BYE: HOU, JAX, NE, NYJ
  [11, "KC", "PIT"], [11, "BUF", "DEN"], [11, "PHI", "NYG"], [11, "DAL", "WSH"],
  [11, "BAL", "MIA"], [11, "CIN", "CLE"], [11, "ATL", "NO"], [11, "TB", "CAR"],
  [11, "LV", "LAC"], [11, "MIN", "DET"], [11, "GB", "CHI"], [11, "TEN", "IND"],
  [11, "SF", "LAR"], [11, "ARI", "SEA"],
  // Week 12 — BYE: DET, GB, MIA, BUF
  [12, "KC", "LV"], [12, "PHI", "BAL"], [12, "DAL", "NYG"], [12, "NE", "NYJ"],
  [12, "CIN", "PIT"], [12, "CLE", "HOU"], [12, "ATL", "CAR"], [12, "TB", "NO"],
  [12, "DEN", "LAC"], [12, "MIN", "CHI"], [12, "WSH", "SF"], [12, "IND", "TEN"],
  [12, "JAX", "LAR"], [12, "ARI", "SEA"],
  // Week 13 — BYE: CHI, PIT, WSH, NYG
  [13, "KC", "DEN"], [13, "BUF", "MIA"], [13, "PHI", "DAL"], [13, "BAL", "CLE"],
  [13, "NE", "LAC"], [13, "CIN", "HOU"], [13, "ATL", "TB"], [13, "NO", "CAR"],
  [13, "LV", "DET"], [13, "GB", "MIN"], [13, "SF", "ARI"], [13, "SEA", "LAR"],
  [13, "TEN", "JAX"], [13, "IND", "NYJ"],
  // Week 14 — BYE: CIN, TEN, JAX, IND
  [14, "KC", "PHI"], [14, "BUF", "NE"], [14, "DAL", "ATL"], [14, "MIA", "BAL"],
  [14, "CLE", "PIT"], [14, "DET", "GB"], [14, "NO", "WSH"], [14, "CAR", "NYG"],
  [14, "DEN", "LV"], [14, "LAC", "NYJ"], [14, "MIN", "CHI"], [14, "TB", "LAR"],
  [14, "SF", "SEA"], [14, "HOU", "ARI"],
  // Week 15 — no byes
  [15, "KC", "LAR"], [15, "BUF", "MIA"], [15, "PHI", "NE"], [15, "DAL", "WSH"],
  [15, "BAL", "PIT"], [15, "CLE", "CIN"], [15, "ATL", "TB"], [15, "NO", "CAR"],
  [15, "DEN", "LAC"], [15, "LV", "HOU"], [15, "DET", "MIN"], [15, "GB", "CHI"],
  [15, "SF", "ARI"], [15, "SEA", "NYG"], [15, "IND", "TEN"], [15, "JAX", "NYJ"],
  // Week 16 — no byes
  [16, "KC", "CIN"], [16, "BUF", "NYG"], [16, "PHI", "WSH"], [16, "MIA", "LAR"],
  [16, "BAL", "NO"], [16, "CLE", "DEN"], [16, "ATL", "CAR"], [16, "TB", "ARI"],
  [16, "LV", "SEA"], [16, "LAC", "DET"], [16, "DET", "GB"], [16, "MIN", "CHI"],
  [16, "HOU", "JAX"], [16, "IND", "TEN"], [16, "NE", "SF"], [16, "PIT", "DAL"],
  // Week 17 — no byes
  [17, "KC", "HOU"], [17, "BUF", "PIT"], [17, "PHI", "NYG"], [17, "DAL", "ATL"],
  [17, "BAL", "CLE"], [17, "MIA", "NE"], [17, "CIN", "LAR"], [17, "NO", "TB"],
  [17, "LV", "DEN"], [17, "LAC", "SF"], [17, "DET", "MIN"], [17, "GB", "SEA"],
  [17, "HOU", "IND"], [17, "JAX", "TEN"], [17, "WSH", "CAR"], [17, "NYG", "NYJ"],
  // Week 18 — no byes
  [18, "KC", "LV"], [18, "BUF", "NYJ"], [18, "PHI", "DAL"], [18, "MIA", "BAL"],
  [18, "CLE", "CIN"], [18, "PIT", "BAL"], [18, "ATL", "NO"], [18, "CAR", "TB"],
  [18, "DEN", "LAC"], [18, "LAR", "SF"], [18, "DET", "CHI"], [18, "GB", "MIN"],
  [18, "HOU", "TEN"], [18, "JAX", "IND"], [18, "WSH", "PHI"], [18, "NYG", "NE"],
];

export function buildScheduleSeed(season: number = 2026): ScheduleEntry[] {
  const entries: ScheduleEntry[] = [];
  const teamWeeks: Record<string, Set<number>> = {};

  for (const team of NFL_TEAMS) {
    teamWeeks[team] = new Set();
  }

  for (const [week, home, away] of GAME_PAIRS_2026) {
    if (!NFL_TEAMS.includes(home) || !NFL_TEAMS.includes(away)) continue;
    entries.push({
      season,
      week,
      team: home,
      opponent: away,
      isHome: true,
      isBye: false,
    });
    entries.push({
      season,
      week,
      team: away,
      opponent: home,
      isHome: false,
      isBye: false,
    });
    teamWeeks[home].add(week);
    teamWeeks[away].add(week);
  }

  // Add byes for any team-week not covered
  for (const team of NFL_TEAMS) {
    for (let w = 1; w <= 18; w++) {
      if (!teamWeeks[team].has(w)) {
        entries.push({
          season,
          week: w,
          team,
          opponent: null,
          isHome: false,
          isBye: true,
        });
        teamWeeks[team].add(w);
      }
    }
  }

  return entries;
}

// 2025 FPA data by position (used as 2026 baseline)
// rank 1 = hardest to score against, rank 32 = easiest
// Based on realistic 2025 adjusted fantasy points allowed

type FpaEntry = {
  defenseTeam: string;
  position: string;
  scoringFormat: string;
  rawPointsAllowed: number;
  adjustedPointsAllowed: number;
  rank: number;
  difficultyBucket: string;
};

function getDifficultyBucket(rank: number): string {
  if (rank <= 5) return "VERY_TOUGH";
  if (rank <= 10) return "TOUGH";
  if (rank <= 22) return "NEUTRAL";
  if (rank <= 27) return "FAVORABLE";
  return "SMASH_SPOT";
}

// Position-specific rank orders — represents how each defense ranked in 2025
// against each position (1 = best defense = hardest to score against)
const RB_RANK_ORDER = [
  "SF", "PHI", "DEN", "BAL", "DAL", "KC", "LAR", "MIA",
  "DET", "BUF", "MIN", "TB", "SEA", "NO", "NYJ", "ATL",
  "WSH", "CHI", "NE", "PIT", "HOU", "LAC", "CIN", "CLE",
  "ARI", "GB", "NYG", "TEN", "CAR", "LV", "IND", "JAX"
];

const QB_RANK_ORDER = [
  "BUF", "SF", "PHI", "LAR", "KC", "BAL", "DEN", "MIN",
  "MIA", "NYJ", "DET", "DAL", "TB", "SEA", "ATL", "NO",
  "CHI", "NE", "HOU", "WSH", "PIT", "CIN", "CLE", "LAC",
  "GB", "NYG", "ARI", "TEN", "LV", "CAR", "IND", "JAX"
];

const WR_RANK_ORDER = [
  "BAL", "SF", "DAL", "PHI", "KC", "DEN", "DET", "NYJ",
  "MIA", "BUF", "MIN", "TB", "NO", "ATL", "LAR", "SEA",
  "CHI", "NE", "PIT", "WSH", "HOU", "LAC", "CIN", "CLE",
  "GB", "ARI", "NYG", "TEN", "CAR", "LV", "IND", "JAX"
];

const TE_RANK_ORDER = [
  "PHI", "DAL", "SF", "KC", "BAL", "BUF", "MIN", "DEN",
  "LAR", "DET", "MIA", "TB", "NYJ", "SEA", "ATL", "NO",
  "NE", "CHI", "PIT", "WSH", "LAC", "HOU", "CLE", "CIN",
  "ARI", "NYG", "GB", "TEN", "CAR", "IND", "LV", "JAX"
];

const K_RANK_ORDER = [
  "DAL", "PHI", "BAL", "SF", "KC", "DEN", "BUF", "MIN",
  "MIA", "NYJ", "DET", "LAR", "TB", "NO", "ATL", "SEA",
  "CHI", "NE", "WSH", "PIT", "HOU", "CIN", "CLE", "LAC",
  "ARI", "GB", "NYG", "TEN", "LV", "CAR", "IND", "JAX"
];

const DST_RANK_ORDER = [
  "SF", "BUF", "KC", "PHI", "BAL", "DEN", "DAL", "LAR",
  "MIN", "DET", "MIA", "NYJ", "TB", "SEA", "ATL", "NO",
  "CHI", "NE", "PIT", "WSH", "HOU", "LAC", "CIN", "CLE",
  "GB", "ARI", "NYG", "TEN", "CAR", "LV", "IND", "JAX"
];

const RANK_ORDERS: Record<string, string[]> = {
  RB: RB_RANK_ORDER,
  QB: QB_RANK_ORDER,
  WR: WR_RANK_ORDER,
  TE: TE_RANK_ORDER,
  K: K_RANK_ORDER,
  DST: DST_RANK_ORDER,
};

// Realistic adjusted FPA averages per rank position (PPR)
const PPR_FPA_BY_POSITION: Record<string, { base: number; step: number }> = {
  QB: { base: 13.2, step: 1.8 },   // rank 1 ~13.2, rank 32 ~13.2+1.8*31
  RB: { base: 11.5, step: 1.2 },
  WR: { base: 17.8, step: 1.5 },
  TE: { base: 8.2, step: 1.1 },
  K: { base: 5.8, step: 0.7 },
  DST: { base: 5.2, step: 1.0 },
};

const SCORING_MULTIPLIERS: Record<string, number> = {
  PPR: 1.0,
  HALF_PPR: 0.88,
  STANDARD: 0.76,
};

export function buildFpaSeed(season: number = 2025): FpaEntry[] {
  const entries: FpaEntry[] = [];
  const positions = ["QB", "RB", "WR", "TE", "K", "DST"];
  const scoringFormats = ["PPR", "HALF_PPR", "STANDARD"];

  for (const position of positions) {
    const rankOrder = RANK_ORDERS[position];
    const { base, step } = PPR_FPA_BY_POSITION[position];

    for (const scoringFormat of scoringFormats) {
      const multiplier = SCORING_MULTIPLIERS[scoringFormat];

      for (let i = 0; i < rankOrder.length; i++) {
        const team = rankOrder[i];
        const rank = i + 1;
        const adjustedPoints = parseFloat(((base + step * i) * multiplier).toFixed(1));
        const rawPoints = parseFloat((adjustedPoints * (0.95 + Math.random() * 0.1)).toFixed(1));

        entries.push({
          defenseTeam: team,
          position,
          scoringFormat,
          rawPointsAllowed: rawPoints,
          adjustedPointsAllowed: adjustedPoints,
          rank,
          difficultyBucket: getDifficultyBucket(rank),
        });
      }
    }
  }

  return entries;
}

// Top players for each position (for Player SOS)
export const POSITION_PLAYERS: Record<string, { playerId: string; playerName: string; team: string }[]> = {
  QB: [
    { playerId: "jh-1", playerName: "Josh Allen", team: "BUF" },
    { playerId: "pm-1", playerName: "Patrick Mahomes", team: "KC" },
    { playerId: "lj-1", playerName: "Lamar Jackson", team: "BAL" },
    { playerId: "jh-2", playerName: "Jalen Hurts", team: "PHI" },
    { playerId: "bp-1", playerName: "Brock Purdy", team: "SF" },
    { playerId: "cd-1", playerName: "CJ Stroud", team: "HOU" },
    { playerId: "jg-1", playerName: "Jordan Love", team: "GB" },
    { playerId: "sk-1", playerName: "Sam Darnold", team: "MIN" },
    { playerId: "dc-1", playerName: "Dak Prescott", team: "DAL" },
    { playerId: "tr-1", playerName: "Tua Tagovailoa", team: "MIA" },
    { playerId: "jd-1", playerName: "Joe Burrow", team: "CIN" },
    { playerId: "km-1", playerName: "Kirk Cousins", team: "ATL" },
    { playerId: "bg-1", playerName: "Baker Mayfield", team: "TB" },
    { playerId: "aj-1", playerName: "Anthony Richardson", team: "IND" },
    { playerId: "dw-1", playerName: "Deshaun Watson", team: "CLE" },
    { playerId: "bc-1", playerName: "Bryce Young", team: "CAR" },
  ],
  RB: [
    { playerId: "ch-1", playerName: "Christian McCaffrey", team: "SF" },
    { playerId: "cj-1", playerName: "CJ Stroud", team: "HOU" },
    { playerId: "br-1", playerName: "Breece Hall", team: "NYJ" },
    { playerId: "be-1", playerName: "Bijan Robinson", team: "ATL" },
    { playerId: "jt-1", playerName: "Jonathan Taylor", team: "IND" },
    { playerId: "dk-1", playerName: "De'Von Achane", team: "MIA" },
    { playerId: "an-1", playerName: "Alvin Kamara", team: "NO" },
    { playerId: "jj-1", playerName: "Josh Jacobs", team: "GB" },
    { playerId: "ds-1", playerName: "Derrick Henry", team: "BAL" },
    { playerId: "tc-1", playerName: "Tony Pollard", team: "TEN" },
    { playerId: "jm-1", playerName: "James Cook", team: "BUF" },
    { playerId: "dp-1", playerName: "David Montgomery", team: "DET" },
    { playerId: "rm-1", playerName: "Rachaad White", team: "TB" },
    { playerId: "ks-1", playerName: "Kyren Williams", team: "LAR" },
    { playerId: "ac-1", playerName: "Aaron Jones", team: "MIN" },
    { playerId: "za-1", playerName: "Zamir White", team: "LV" },
    { playerId: "cr-1", playerName: "Chase Brown", team: "CIN" },
    { playerId: "rj-1", playerName: "Raheem Mostert", team: "MIA" },
    { playerId: "jf-1", playerName: "Jaylen Warren", team: "PIT" },
    { playerId: "ea-1", playerName: "Emari Demercado", team: "ARI" },
  ],
  WR: [
    { playerId: "tj-1", playerName: "Tyreek Hill", team: "MIA" },
    { playerId: "js-1", playerName: "Justin Jefferson", team: "MIN" },
    { playerId: "cj-2", playerName: "CeeDee Lamb", team: "DAL" },
    { playerId: "sa-1", playerName: "Stefon Diggs", team: "HOU" },
    { playerId: "dm-1", playerName: "Davante Adams", team: "LV" },
    { playerId: "ax-1", playerName: "A.J. Brown", team: "PHI" },
    { playerId: "gh-1", playerName: "Garrett Wilson", team: "NYJ" },
    { playerId: "dh-1", playerName: "DK Metcalf", team: "SEA" },
    { playerId: "cr-2", playerName: "Cooper Kupp", team: "LAR" },
    { playerId: "jc-1", playerName: "Ja'Marr Chase", team: "CIN" },
    { playerId: "tr-2", playerName: "Tee Higgins", team: "CIN" },
    { playerId: "pp-1", playerName: "Puka Nacua", team: "LAR" },
    { playerId: "nh-1", playerName: "Nico Collins", team: "HOU" },
    { playerId: "jd-2", playerName: "Jaylen Waddle", team: "MIA" },
    { playerId: "rm-2", playerName: "Rashee Rice", team: "KC" },
    { playerId: "dk-2", playerName: "Dontayvion Wicks", team: "GB" },
    { playerId: "bw-1", playerName: "Brian Thomas Jr.", team: "JAX" },
    { playerId: "xw-1", playerName: "Xavier Worthy", team: "KC" },
    { playerId: "ma-1", playerName: "Mike Evans", team: "TB" },
    { playerId: "wg-1", playerName: "Christian Kirk", team: "JAX" },
  ],
  TE: [
    { playerId: "sk-2", playerName: "Sam LaPorta", team: "DET" },
    { playerId: "tc-2", playerName: "Travis Kelce", team: "KC" },
    { playerId: "mk-1", playerName: "Mark Andrews", team: "BAL" },
    { playerId: "dk-3", playerName: "Dalton Kincaid", team: "BUF" },
    { playerId: "tm-1", playerName: "TJ Hockenson", team: "MIN" },
    { playerId: "cm-1", playerName: "Cole Kmet", team: "CHI" },
    { playerId: "dw-2", playerName: "David Njoku", team: "CLE" },
    { playerId: "eb-1", playerName: "Evan Engram", team: "JAX" },
    { playerId: "dg-1", playerName: "Dallas Goedert", team: "PHI" },
    { playerId: "is-1", playerName: "Isaiah Likely", team: "BAL" },
    { playerId: "jw-1", playerName: "Jake Ferguson", team: "DAL" },
    { playerId: "bg-2", playerName: "Ben Sinnott", team: "WSH" },
    { playerId: "pk-1", playerName: "Pat Freiermuth", team: "PIT" },
    { playerId: "mf-1", playerName: "Michael Mayer", team: "LV" },
    { playerId: "bg-3", playerName: "Brock Bowers", team: "LV" },
    { playerId: "jf-2", playerName: "Juwan Johnson", team: "NO" },
  ],
  K: [
    { playerId: "jt-2", playerName: "Justin Tucker", team: "BAL" },
    { playerId: "eg-1", playerName: "Evan McPherson", team: "CIN" },
    { playerId: "ba-1", playerName: "Brandon Aubrey", team: "DAL" },
    { playerId: "jm-2", playerName: "Jake Moody", team: "SF" },
    { playerId: "wl-1", playerName: "Will Lutz", team: "DEN" },
    { playerId: "to-1", playerName: "Tyler Bass", team: "BUF" },
    { playerId: "hy-1", playerName: "Harrison Butker", team: "KC" },
    { playerId: "km-2", playerName: "Ka'imi Fairbairn", team: "HOU" },
    { playerId: "gj-1", playerName: "Greg Joseph", team: "MIN" },
    { playerId: "mn-1", playerName: "Matt Prater", team: "ARI" },
    { playerId: "er-1", playerName: "Eddy Pineiro", team: "CAR" },
    { playerId: "cs-1", playerName: "Chris Boswell", team: "PIT" },
    { playerId: "bc-2", playerName: "Blake Grupe", team: "NO" },
    { playerId: "dr-1", playerName: "Daniel Carlson", team: "LV" },
    { playerId: "rm-3", playerName: "Riley Patterson", team: "JAX" },
    { playerId: "gm-1", playerName: "Graham Gano", team: "NYG" },
  ],
  DST: [
    { playerId: "dst-sf", playerName: "49ers D/ST", team: "SF" },
    { playerId: "dst-buf", playerName: "Bills D/ST", team: "BUF" },
    { playerId: "dst-kc", playerName: "Chiefs D/ST", team: "KC" },
    { playerId: "dst-phi", playerName: "Eagles D/ST", team: "PHI" },
    { playerId: "dst-bal", playerName: "Ravens D/ST", team: "BAL" },
    { playerId: "dst-den", playerName: "Broncos D/ST", team: "DEN" },
    { playerId: "dst-dal", playerName: "Cowboys D/ST", team: "DAL" },
    { playerId: "dst-lar", playerName: "Rams D/ST", team: "LAR" },
    { playerId: "dst-min", playerName: "Vikings D/ST", team: "MIN" },
    { playerId: "dst-det", playerName: "Lions D/ST", team: "DET" },
    { playerId: "dst-mia", playerName: "Dolphins D/ST", team: "MIA" },
    { playerId: "dst-nyj", playerName: "Jets D/ST", team: "NYJ" },
    { playerId: "dst-pit", playerName: "Steelers D/ST", team: "PIT" },
    { playerId: "dst-hou", playerName: "Texans D/ST", team: "HOU" },
    { playerId: "dst-cin", playerName: "Bengals D/ST", team: "CIN" },
    { playerId: "dst-cle", playerName: "Browns D/ST", team: "CLE" },
  ],
};
