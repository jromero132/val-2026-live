import { useEffect, useState } from "react";

interface RawPartyData {
  partibeteckning: string;
  antalRoster: number;
}

interface ElectionApiResponse {
  rosterPaverkaMandat?: {
    partiroster: RawPartyData[];
  };
  antalValdistriktRaknade?: number;
  antalValdistriktSomSkaRaknas?: number;
  valdeltagande?: string;
  valdeltagandeForegaendeVal?: string;
  totaltAntalRoster?: string;
  totaltAntalRosterForegaendeVal?: string;
  senasteRapporteringstid?: string;
  senasteUppdateringstid?: string;
}

interface ElectionMeta {
  districtsCounted: number;
  districtsTotal: number;
  turnout: number;
  turnoutPrevious: number;
  totalVotes: number;
  totalVotesPrevious: number;
  latestReportTime: string | null;
}

interface PartyResult {
  name: string;
  votes: number;
  oldVotes: number;
  diff: number;
}

interface AllianceResult {
  name: string;
  votes: number;
  oldVotes: number;
  diff: number;
}

const LOCAL_RESULTS_URL = "/api-val/data/resultat/val2026/RD_P.json";
const FALLBACK_RESULTS_URL = "./result.json";

const OLD_RESULTS: Record<string, number> = {
  Socialdemokraterna: 1791649,
  Centerpartiet: 450680,
  Kristdemokraterna: 396063,
  Liberalerna: 342680,
  Miljöpartiet: 389727,
  Moderaterna: 1267524,
  Sverigedemokraterna: 1119255,
  Vänsterpartiet: 526740,
  "Övriga partier": 99922,
};

const ALLIES: Record<string, string[]> = {
  Sossarna: ["Vänsterpartiet", "Socialdemokraterna", "Miljöpartiet", "Centerpartiet"],
  Tidö: ["Liberalerna", "Kristdemokraterna", "Moderaterna", "Sverigedemokraterna"],
};

const PARTY_ABBREVIATIONS: Record<string, string> = {
  Vänsterpartiet: "V",
  Socialdemokraterna: "S",
  Miljöpartiet: "MP",
  Centerpartiet: "C",
  Liberalerna: "L",
  Kristdemokraterna: "KD",
  Moderaterna: "M",
  Sverigedemokraterna: "SD",
  "Övriga partier": "Övriga",
};

const convertPartyName = (name: string): string => {
  const mapping: Record<string, string> = {
    "Arbetarepartiet-Socialdemokraterna": "Socialdemokraterna",
    "Miljöpartiet de gröna": "Miljöpartiet",
    "Liberalerna (tidigare Folkpartiet)": "Liberalerna",
    "Övriga anmälda partier": "Övriga partier",
  };
  return mapping[name] || name;
};

const formatNum = (num: number): string => num.toLocaleString("sv-SE").replace(/\s/g, "·");

const parseSwedishNumber = (value: string | undefined): number => {
  if (!value) return 0;
  const cleaned = value.replace(/%/g, "").replace(/[\s\u00a0]/g, "").replace(",", ".");
  const parsed = Number.parseFloat(cleaned);
  return Number.isNaN(parsed) ? 0 : parsed;
};

export default function App() {
  const [results, setResults] = useState<PartyResult[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [hoveredParty, setHoveredParty] = useState<PartyResult | null>(null);
  const [hoveredAlliance, setHoveredAlliance] = useState<AllianceResult | null>(null);
  const [meta, setMeta] = useState<ElectionMeta | null>(null);

  const fetchData = async () => {
    try {
      const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
      let response = await fetch(isLocal ? LOCAL_RESULTS_URL : FALLBACK_RESULTS_URL);

      if (!response.ok) throw new Error(`HTTP-fel! Status: ${response.status}`);
      const data: ElectionApiResponse = await response.json();

      const rawList = data.rosterPaverkaMandat?.partiroster || [];
      const parsed: PartyResult[] = rawList.map((p) => {
        const name = convertPartyName(p.partibeteckning);
        const votes = p.antalRoster;
        const oldVotes = OLD_RESULTS[name] ?? 0;
        return {
          name,
          votes,
          oldVotes,
          diff: votes - oldVotes,
        };
      });

      setResults(parsed);
      setMeta({
        districtsCounted: data.antalValdistriktRaknade ?? 0,
        districtsTotal: data.antalValdistriktSomSkaRaknas ?? 0,
        turnout: parseSwedishNumber(data.valdeltagande),
        turnoutPrevious: parseSwedishNumber(data.valdeltagandeForegaendeVal),
        totalVotes: parseSwedishNumber(data.totaltAntalRoster),
        totalVotesPrevious: parseSwedishNumber(data.totaltAntalRosterForegaendeVal),
        latestReportTime: data.senasteRapporteringstid ?? null,
      });
      setLastUpdated(new Date());
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Misslyckades med att hämta data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, []);

  const redGreenVotes = results
    .filter((r) => ALLIES.Sossarna.includes(r.name))
    .reduce((sum, r) => sum + r.votes, 0);

  const tidoVotes = results
    .filter((r) => ALLIES.Tidö.includes(r.name))
    .reduce((sum, r) => sum + r.votes, 0);

  const ovrigaVotes = results
    .filter((r) => !ALLIES.Sossarna.includes(r.name) && !ALLIES.Tidö.includes(r.name))
    .reduce((sum, r) => sum + r.votes, 0);

  const redGreenDiff = results
    .filter((r) => ALLIES.Sossarna.includes(r.name))
    .reduce((sum, r) => sum + r.diff, 0);

  const tidoDiff = results
    .filter((r) => ALLIES.Tidö.includes(r.name))
    .reduce((sum, r) => sum + r.diff, 0);

  const ovrigaDiff = results
    .filter((r) => !ALLIES.Sossarna.includes(r.name) && !ALLIES.Tidö.includes(r.name))
    .reduce((sum, r) => sum + r.diff, 0);

  const grandTotalVotes = redGreenVotes + ovrigaVotes + tidoVotes;
  const redGreenPct = grandTotalVotes > 0 ? (redGreenVotes / grandTotalVotes) * 100 : 0;
  const ovrigaPct = grandTotalVotes > 0 ? (ovrigaVotes / grandTotalVotes) * 100 : 0;
  const tidoPct = grandTotalVotes > 0 ? (tidoVotes / grandTotalVotes) * 100 : 0;

  const redGreenNewVotes = Math.max(redGreenDiff, 0);
  const ovrigaNewVotes = Math.max(ovrigaDiff, 0);
  const tidoNewVotes = Math.max(tidoDiff, 0);
  const totalPositiveNewVotes = redGreenNewVotes + ovrigaNewVotes + tidoNewVotes;
  const redGreenNewPct = totalPositiveNewVotes > 0
    ? (redGreenNewVotes / totalPositiveNewVotes) * 100
    : 0;
  const ovrigaNewPct = totalPositiveNewVotes > 0
    ? (ovrigaNewVotes / totalPositiveNewVotes) * 100
    : 0;
  const tidoNewPct = totalPositiveNewVotes > 0
    ? (tidoNewVotes / totalPositiveNewVotes) * 100
    : 0;

  const totalNewVotes = results.reduce((acc, curr) => acc + curr.diff, 0);

  const alliancesData: AllianceResult[] = [
    {
      name: "Sossarna",
      votes: redGreenVotes,
      oldVotes: redGreenVotes - redGreenDiff,
      diff: redGreenDiff,
    },
    {
      name: "Tidö",
      votes: tidoVotes,
      oldVotes: tidoVotes - tidoDiff,
      diff: tidoDiff,
    },
  ].sort((a, b) => b.votes - a.votes);

  if (loading && !lastUpdated) return <div className="p-6 text-gray-600 text-center">Laddar valdata...</div>;

  return (
    <main className="app-shell max-w-4xl mx-auto p-6 space-y-8 font-sans">
      <header className="text-center border-b pb-4">
        <h1 className="text-2xl font-bold text-gray-800">Val 2026 – Direktrapportering</h1>
        {lastUpdated && (
          <p className="text-xs text-gray-500 mt-1">
            Uppdaterad: {lastUpdated.toLocaleTimeString()} (Uppdateras varje minut)
          </p>
        )}
      </header>

      {error && <div className="p-4 bg-red-100 text-red-700 rounded-md text-sm">{error}</div>}

      <section className="bg-white p-6 rounded-xl shadow-md space-y-4 border border-gray-100">
        <h2 className="text-lg font-semibold text-gray-700">Blockjämförelse</h2>

        <div className="block-labels flex justify-between font-bold text-sm">
          <div className="text-red-700">
            Sossarna: {formatNum(redGreenVotes)}{" "}
            <span className="text-xs font-normal">
              ({redGreenDiff >= 0 ? `+${formatNum(redGreenDiff)}` : formatNum(redGreenDiff)} nya)
            </span>
          </div>
          <div className="text-gray-500 text-center">
            Övriga: {formatNum(ovrigaVotes)}{" "}
            <span className="text-xs font-normal">
              ({ovrigaDiff >= 0 ? `+${formatNum(ovrigaDiff)}` : formatNum(ovrigaDiff)} nya)
            </span>
          </div>
          <div className="text-blue-800 text-right">
            Tidö: {formatNum(tidoVotes)}{" "}
            <span className="text-xs font-normal">
              ({tidoDiff >= 0 ? `+${formatNum(tidoDiff)}` : formatNum(tidoDiff)} nya)
            </span>
          </div>
        </div>

        <div className="relative h-10 w-full bg-gray-200 rounded-full overflow-hidden flex shadow-inner">
          <div
            className="bg-gradient-to-r from-red-600 to-emerald-500 transition-all duration-500 flex items-center justify-start px-3 text-white text-xs font-bold whitespace-nowrap overflow-hidden"
            style={{ width: `${redGreenPct}%` }}
          >
            {redGreenPct.toFixed(1)}%
          </div>

          <div
            className="bg-gray-400 transition-all duration-500 flex items-center justify-center px-1 text-white text-[10px] font-semibold whitespace-nowrap overflow-hidden"
            style={{ width: `${ovrigaPct}%` }}
          >
            {ovrigaPct > 0 ? `${ovrigaPct.toFixed(1)}%` : "Övriga"}
          </div>

          <div
            className="bg-gradient-to-r from-blue-600 to-amber-400 transition-all duration-500 flex items-center justify-end px-3 text-white text-xs font-bold whitespace-nowrap overflow-hidden"
            style={{ width: `${tidoPct}%` }}
          >
            {tidoPct.toFixed(1)}%
          </div>

          <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-black z-10 opacity-80 pointer-events-none" />
          <div className="absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 bg-black text-white text-[10px] px-1 rounded z-20 font-mono pointer-events-none">
            50%
          </div>
        </div>

        <div className="pt-2 space-y-2 border-t border-gray-100">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-gray-700">Fördelning av nya röster</h3>
            <span className="text-xs text-gray-500">
              Totalt: +{formatNum(totalPositiveNewVotes)}
            </span>
          </div>

          <div className="block-labels flex justify-between font-semibold text-xs">
            <div className="text-red-700">
              Sossarna: +{formatNum(redGreenNewVotes)} ({redGreenNewPct.toFixed(1)}%)
            </div>
            <div className="text-gray-500 text-center">
              Övriga: +{formatNum(ovrigaNewVotes)} ({ovrigaNewPct.toFixed(1)}%)
            </div>
            <div className="text-blue-800 text-right">
              Tidö: +{formatNum(tidoNewVotes)} ({tidoNewPct.toFixed(1)}%)
            </div>
          </div>

          <div
            className="relative h-7 w-full bg-gray-200 rounded-full overflow-hidden flex shadow-inner"
            aria-label="Fördelning av nya röster mellan blocken"
          >
            <div
              className="bg-gradient-to-r from-red-600 to-emerald-500 transition-all duration-500 flex items-center justify-center text-white text-[10px] font-bold overflow-hidden"
              style={{ width: `${redGreenNewPct}%` }}
            >
              {redGreenNewPct >= 8 && `${redGreenNewPct.toFixed(1)}%`}
            </div>
            <div
              className="bg-gray-400 transition-all duration-500 flex items-center justify-center text-white text-[10px] font-bold overflow-hidden"
              style={{ width: `${ovrigaNewPct}%` }}
            >
              {ovrigaNewPct >= 8 && `${ovrigaNewPct.toFixed(1)}%`}
            </div>
            <div
              className="bg-gradient-to-r from-blue-600 to-amber-400 transition-all duration-500 flex items-center justify-center text-white text-[10px] font-bold overflow-hidden"
              style={{ width: `${tidoNewPct}%` }}
            >
              {tidoNewPct >= 8 && `${tidoNewPct.toFixed(1)}%`}
            </div>

            <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-black z-10 opacity-80 pointer-events-none" />
            <div className="absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 bg-black text-white text-[10px] px-1 rounded z-20 font-mono pointer-events-none">
              50%
            </div>
          </div>
          <p className="text-[11px] text-gray-400">
            Visar andelen av alla positiva förändringar sedan föregående mätning.
          </p>
        </div>
      </section>

      {meta && (
        <section className="bg-white p-6 rounded-xl shadow-md border border-gray-100 space-y-4">
          <h2 className="text-lg font-semibold text-gray-700">Valstatistik</h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
              <p className="text-xs text-gray-500">Valdeltagande</p>
              <p className="text-xl font-bold text-gray-800">
                {meta.turnout.toLocaleString("sv-SE", { minimumFractionDigits: 1 })}%
              </p>
              <p
                className={`text-xs font-semibold ${
                  meta.turnout - meta.turnoutPrevious >= 0 ? "text-green-600" : "text-red-600"
                }`}
              >
                {meta.turnout - meta.turnoutPrevious >= 0 ? "+" : ""}
                {(meta.turnout - meta.turnoutPrevious).toLocaleString("sv-SE", {
                  minimumFractionDigits: 1,
                })}
                {" "}
                jämfört med {meta.turnoutPrevious.toLocaleString("sv-SE", {
                  minimumFractionDigits: 1,
                })}% (2022)
              </p>
            </div>

            <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
              <p className="text-xs text-gray-500">Räknade valdistrikt</p>
              <p className="text-xl font-bold text-gray-800">
                {formatNum(meta.districtsCounted)} / {formatNum(meta.districtsTotal)}
              </p>
              <div className="h-2 w-full bg-gray-200 rounded-full overflow-hidden mt-2">
                <div
                  className="h-full bg-emerald-500 transition-all duration-500"
                  style={{
                    width: `${
                      meta.districtsTotal > 0
                        ? (meta.districtsCounted / meta.districtsTotal) * 100
                        : 0
                    }%`,
                  }}
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {meta.districtsTotal > 0
                  ? ((meta.districtsCounted / meta.districtsTotal) * 100).toFixed(1)
                  : "0.0"}
                % räknat
              </p>
            </div>

            <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
              <p className="text-xs text-gray-500">Totalt antal röster</p>
              <p className="text-xl font-bold text-gray-800">{formatNum(meta.totalVotes)}</p>
              <p
                className={`text-xs font-semibold ${
                  meta.totalVotes - meta.totalVotesPrevious >= 0 ? "text-green-600" : "text-red-600"
                }`}
              >
                {meta.totalVotes - meta.totalVotesPrevious >= 0 ? "+" : ""}
                {formatNum(meta.totalVotes - meta.totalVotesPrevious)} mot 2022
              </p>
            </div>
          </div>

          {meta.latestReportTime && (
            <p className="text-xs text-gray-400 text-center">
              Senaste rapportering: {meta.latestReportTime}
            </p>
          )}
        </section>
      )}

      <section className="bg-white p-6 rounded-xl shadow-md border border-gray-100 space-y-3">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-semibold text-gray-700">Förändringar i valresultatet</h2>
          <span className="text-sm font-semibold text-gray-500">
            Totalt nya: {formatNum(totalNewVotes)}
          </span>
        </div>

        <ul className="divide-y divide-gray-100">
          {alliancesData.map((alliance) => {
            const isHovered = hoveredAlliance?.name === alliance.name;
            const relativeDiff = hoveredAlliance ? alliance.diff - hoveredAlliance.diff : 0;

            return (
              <li
                key={alliance.name}
                onMouseEnter={() => setHoveredAlliance(alliance)}
                onMouseLeave={() => setHoveredAlliance(null)}
                className={`result-row py-2.5 px-3 rounded-md transition-colors flex justify-between items-center text-sm cursor-pointer ${
                  isHovered ? "bg-slate-100 font-medium" : "hover:bg-slate-50"
                }`}
              >
                <div className="result-name">
                  <span className="font-medium text-gray-800">{alliance.name}</span>
                  <span className="text-xs text-gray-400 ml-2">
                    ({(100 * alliance.votes / grandTotalVotes).toFixed(2)}% | Nuvarande: {formatNum(alliance.votes)} | Tidigare: {formatNum(alliance.oldVotes)})
                  </span>
                </div>

                <div className="result-values flex items-center space-x-3 font-mono">
                  <div className="relative-diff w-28 flex justify-end">
                    {hoveredAlliance && !isHovered && (
                      <span
                        className={`text-xs px-2 py-0.5 rounded text-right whitespace-nowrap ${
                          relativeDiff > 0
                            ? "bg-red-100 text-red-700"
                            : relativeDiff < 0
                            ? "bg-green-100 text-green-700"
                            : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {relativeDiff > 0
                          ? `+${formatNum(relativeDiff)}`
                          : formatNum(relativeDiff)}{" "}
                        mot {hoveredAlliance.name}
                      </span>
                    )}
                  </div>

                  <span
                  className={`diff-value w-24 text-right font-semibold ${
                      alliance.diff > 0
                        ? "text-green-600"
                        : alliance.diff < 0
                        ? "text-red-600"
                        : "text-gray-500"
                    }`}
                  >
                    {alliance.diff > 0 ? `+${formatNum(alliance.diff)}` : formatNum(alliance.diff)}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>

        <hr className="my-3 border-gray-200" />

        <ul className="divide-y divide-gray-100">
          {[...results]
            .sort((a, b) => b.diff - a.diff)
            .map((party) => {
              const isHovered = hoveredParty?.name === party.name;
              const relativeDiff = hoveredParty ? party.diff - hoveredParty.diff : 0;

              return (
                <li
                  key={party.name}
                  onMouseEnter={() => setHoveredParty(party)}
                  onMouseLeave={() => setHoveredParty(null)}
                  className={`result-row py-2.5 px-3 rounded-md transition-colors flex justify-between items-center text-sm cursor-pointer ${
                    isHovered ? "bg-slate-100 font-medium" : "hover:bg-slate-50"
                  }`}
                >
                  <div className="result-name">
                    <span className="font-medium text-gray-800">{party.name}</span>
                    <span className="text-xs text-gray-400 ml-2">
                      ({(100 * party.votes / grandTotalVotes).toFixed(2)}% | Nuvarande: {formatNum(party.votes)} | Tidigare: {formatNum(party.oldVotes)})
                    </span>
                  </div>

                  <div className="result-values flex items-center space-x-3 font-mono">
                      <div className="relative-diff w-28 flex justify-end">
                      {hoveredParty && !isHovered && (
                        <span
                          className={`text-xs px-2 py-0.5 rounded text-right whitespace-nowrap ${
                            relativeDiff > 0
                              ? "bg-red-100 text-red-700"
                              : relativeDiff < 0
                              ? "bg-green-100 text-green-700"
                              : "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {relativeDiff > 0
                            ? `+${formatNum(relativeDiff)}`
                            : formatNum(relativeDiff)}{" "}
                          mot {PARTY_ABBREVIATIONS[hoveredParty.name] || hoveredParty.name}
                        </span>
                      )}
                    </div>

                    <span
                      className={`diff-value w-24 text-right font-semibold ${
                        party.diff > 0
                          ? "text-green-600"
                          : party.diff < 0
                          ? "text-red-600"
                          : "text-gray-500"
                      }`}
                    >
                      {party.diff > 0 ? `+${formatNum(party.diff)}` : formatNum(party.diff)}
                    </span>
                  </div>
                </li>
              );
            })}
        </ul>
      </section>
    </main>
  );
}
