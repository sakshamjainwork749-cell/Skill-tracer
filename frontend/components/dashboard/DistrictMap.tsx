"use client";

import { useMemo, useState } from "react";
import { MapPin } from "lucide-react";
import { MAHARASHTRA_DISTRICTS } from "@/lib/maharashtra-districts";
import type { DistrictOutcome } from "@/lib/types";
import { cn } from "@/lib/utils";

const VIEW_W = 500;
const VIEW_H = 620;

/** Census-2011 / renamed-district aliases: normalised dataset name -> geo feature name. */
const GEO_ALIASES: Record<string, string> = {
  sambhajinagar: "Aurangabad",
  chhatrapatisambhajinagar: "Aurangabad",
  aurangabad: "Aurangabad",
  ahilyanagar: "Ahmadnagar",
  ahmadnagar: "Ahmadnagar",
  dharashiv: "Osmanabad",
  osmanabad: "Osmanabad",
  beed: "Bid",
  bid: "Bid",
  gondia: "Gondiya",
  gondiya: "Gondiya",
  raigad: "Raigarh",
  raigarh: "Raigarh",
};

function normalise(value: string) {
  return value.toLowerCase().replace(/[^a-z]/g, "");
}

function geoNameFor(datasetName: string): string {
  const key = normalise(datasetName);
  if (GEO_ALIASES[key]) return GEO_ALIASES[key];
  const exact = MAHARASHTRA_DISTRICTS.find((shape) => normalise(shape.name) === key);
  return exact?.name ?? datasetName;
}

function retentionColor(value: number | null | undefined) {
  if (value == null) return "#CBD5E1";
  if (value >= 70) return "#0B7A75";
  if (value >= 62) return "#E99024";
  return "#D85C4A";
}

export function DistrictMap({
  districts,
  selectedId,
  onSelect,
  query,
  onQueryChange,
}: {
  districts: DistrictOutcome[];
  selectedId: string;
  onSelect: (id: string) => void;
  query: string;
  onQueryChange: (value: string) => void;
}) {
  const [hoveredGeo, setHoveredGeo] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const { project, centroidOf } = useMemo(() => {
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const shape of MAHARASHTRA_DISTRICTS) {
      for (const poly of shape.polygons) {
        for (const [x, y] of poly) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    const pad = 12;
    const scale = Math.min(
      (VIEW_W - pad * 2) / (maxX - minX),
      (VIEW_H - pad * 2) / (maxY - minY),
    );
    const projectFn = (lng: number, lat: number) => ({
      x: pad + (lng - minX) * scale + (VIEW_W - pad * 2 - (maxX - minX) * scale) / 2,
      y: pad + (maxY - lat) * scale + (VIEW_H - pad * 2 - (maxY - minY) * scale) / 2,
    });
    const centroid = (geoName: string) => {
      const shape = MAHARASHTRA_DISTRICTS.find((item) => item.name === geoName);
      if (!shape) return null;
      let largest = shape.polygons[0];
      for (const poly of shape.polygons) {
        if (poly.length > largest.length) largest = poly;
      }
      const sum = largest.reduce(
        (acc, [x, y]) => ({ x: acc.x + x / largest.length, y: acc.y + y / largest.length }),
        { x: 0, y: 0 },
      );
      return projectFn(sum.x, sum.y);
    };
    return { project: projectFn, centroidOf: centroid };
  }, []);

  const datasetGeoNames = useMemo(
    () => new Map(districts.map((district) => [geoNameFor(district.name), district])),
    [districts],
  );

  const hoveredEntry = hoveredGeo ? datasetGeoNames.get(hoveredGeo) ?? null : null;

  const tableRows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return districts;
    return districts.filter((district) => district.name.toLowerCase().includes(needle));
  }, [districts, query]);

  const handleGeoClick = (geoName: string) => {
    const entry = datasetGeoNames.get(geoName);
    if (entry) {
      setNotice(null);
      onSelect(entry.id);
    } else {
      const pretty = MAHARASHTRA_DISTRICTS.find((shape) => shape.name === geoName)?.name ?? geoName;
      setNotice(`No outcome data available for ${pretty}.`);
    }
  };

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(300px,.75fr)_minmax(0,1.25fr)]">
      <div className="relative min-h-[420px] overflow-hidden rounded-2xl border border-navy-100 bg-soft-slate">
        <div className="civic-grid absolute inset-0 opacity-60" />
        <div className="absolute left-4 top-4 z-10 flex flex-wrap items-center gap-2">
          <div className="rounded-xl border border-navy-100 bg-white/90 px-3 py-2 shadow-sm backdrop-blur-sm">
            <p className="text-[9px] font-extrabold uppercase tracking-[0.12em] text-navy-400">Maharashtra</p>
            <p className="mt-0.5 text-[10px] font-bold text-navy-700">Select a district region</p>
          </div>
          {selectedId !== "all" && (
            <button
              type="button"
              onClick={() => { setNotice(null); onSelect("all"); }}
              className="rounded-xl border border-primary-200 bg-white/95 px-3 py-2 text-[10px] font-extrabold text-primary-700 shadow-sm transition hover:bg-primary-50"
            >
              Reset · All Maharashtra
            </button>
          )}
        </div>
        <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} className="absolute inset-0 h-full w-full" role="img" aria-labelledby="district-map-title district-map-description">
          <title id="district-map-title">Maharashtra district outcome map</title>
          <desc id="district-map-description">
            Interactive district regions. Districts with outcome data are coloured by six-month retention; the table contains the same values.
          </desc>
          <defs>
            <filter id="district-shadow" x="-30%" y="-30%" width="160%" height="160%">
              <feDropShadow dx="0" dy="8" stdDeviation="10" floodColor="#102D3A" floodOpacity=".12" />
            </filter>
          </defs>
          {MAHARASHTRA_DISTRICTS.map((shape) => {
            const entry = datasetGeoNames.get(shape.name);
            const selected = entry != null && selectedId === entry.id;
            const hovered = hoveredGeo === shape.name;
            const color = retentionColor(entry?.retention_6m_rate);
            const path = shape.polygons
              .map((poly) => poly.map(([lng, lat], index) => {
                const { x, y } = project(lng, lat);
                return `${index === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
              }).join(" ") + " Z")
              .join(" ");
            const label = entry
              ? `${entry.name}: ${entry.employed_rate}% employment, ${entry.retention_6m_rate}% six-month retention`
              : `${shape.name}: no outcome data available`;
            return (
              <g key={shape.name}>
                <path
                  d={path}
                  fill={entry ? color : "#E8EEF2"}
                  fillOpacity={selected ? 0.55 : hovered ? 0.45 : entry ? 0.3 : 0.6}
                  stroke={selected ? "#0B3B39" : hovered ? "#0B7A75" : "#FFFFFF"}
                  strokeWidth={selected ? 2.4 : hovered ? 1.8 : 1}
                  filter={selected ? "url(#district-shadow)" : undefined}
                  className="cursor-pointer outline-none transition"
                  role="button"
                  tabIndex={0}
                  aria-label={label}
                  aria-pressed={selected}
                  onClick={() => handleGeoClick(shape.name)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      handleGeoClick(shape.name);
                    }
                  }}
                  onMouseEnter={() => setHoveredGeo(shape.name)}
                  onMouseLeave={() => setHoveredGeo((current) => (current === shape.name ? null : current))}
                  onFocus={() => setHoveredGeo(shape.name)}
                  onBlur={() => setHoveredGeo((current) => (current === shape.name ? null : current))}
                >
                  <title>{label}</title>
                </path>
              </g>
            );
          })}
          {districts.map((district) => {
            const point = centroidOf(geoNameFor(district.name));
            if (!point) return null;
            const selected = selectedId === district.id;
            return (
              <text
                key={district.id}
                x={point.x}
                y={point.y}
                textAnchor="middle"
                fill={selected ? "#0B3B39" : "#102D3A"}
                opacity={selected ? 1 : 0.75}
                fontSize={selected ? "10" : "8"}
                fontWeight="800"
                className="pointer-events-none"
              >
                {district.name}
              </text>
            );
          })}
          <text x={VIEW_W / 2} y={VIEW_H - 34} textAnchor="middle" fill="#102D3A" opacity=".12" fontSize="20" fontWeight="800" letterSpacing="3" className="pointer-events-none">MAHARASHTRA</text>
        </svg>
        {(hoveredGeo || notice) && (
          <div className="absolute bottom-14 left-4 z-10 max-w-[240px] rounded-xl border border-navy-100 bg-white/95 px-3 py-2 shadow-sm backdrop-blur-sm" role="status">
            {hoveredEntry ? (
              <>
                <p className="text-[11px] font-extrabold text-navy-900">{hoveredEntry.name}</p>
                <p className="mt-0.5 text-[10px] font-bold text-navy-500">
                  {hoveredEntry.employed_rate}% employment · {hoveredEntry.retention_6m_rate}% 6M retention
                </p>
              </>
            ) : (
              <p className="text-[10px] font-bold text-navy-500">
                {notice ?? `${hoveredGeo}: no outcome data available`}
              </p>
            )}
          </div>
        )}
        <div className="absolute bottom-4 left-4 right-4 flex flex-wrap items-center gap-3 rounded-xl border border-navy-100 bg-white/90 px-3 py-2 text-[8px] font-bold text-navy-500 shadow-sm backdrop-blur-sm">
          <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-emerald-500" /> High outcome · 70%+</span>
          <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-primary-600" /> Moderate · 62–69%</span>
          <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-warning-500" /> Low outcome · below 62%</span>
          <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-slate-300" /> No data</span>
        </div>
      </div>

      <div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="flex items-center gap-1.5 text-[9px] font-extrabold uppercase tracking-[0.14em] text-primary-600"><MapPin className="size-3.5" /> Regional outcomes</p>
            <h3 className="mt-1 text-base font-extrabold text-navy-900">District comparison</h3>
          </div>
          <label className="relative block sm:w-64">
            <span className="sr-only">Search districts</span>
            <input
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder="Search districts"
              className="h-10 w-full rounded-xl border border-navy-200 bg-white pl-3 pr-8 text-xs text-navy-900 outline-none transition placeholder:text-navy-300 focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10"
            />
            {query && (
              <button
                type="button"
                onClick={() => onQueryChange("")}
                className="absolute right-2 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded-md text-navy-400 hover:bg-navy-100"
                aria-label="Clear district search"
              >
                ×
              </button>
            )}
          </label>
        </div>
        <p className="mt-1 text-[9px] text-navy-400">Click any row to select</p>

        {tableRows.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-navy-200 p-6 text-center" role="status">
            <p className="text-xs font-extrabold text-navy-800">No districts match “{query.trim()}”.</p>
            <p className="mt-1 text-[10px] text-navy-400">Try a different spelling or clear the search.</p>
          </div>
        ) : (
        <div className="mt-4 overflow-x-auto rounded-xl border border-navy-100">
          <table className="w-full min-w-[670px] border-collapse text-left">
            <caption className="sr-only">Outcome metrics by district</caption>
            <thead>
              <tr className="bg-soft-slate text-[8px] font-extrabold uppercase tracking-[0.1em] text-navy-400">
                <th scope="col" className="px-3 py-3">District</th>
                <th scope="col" className="px-3 py-3 text-right">Trained</th>
                <th scope="col" className="px-3 py-3 text-right">Employment</th>
                <th scope="col" className="px-3 py-3 text-right">6M retention</th>
                <th scope="col" className="px-3 py-3 text-right">Self-employed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy-100">
              {tableRows.map((district) => {
                const selected = selectedId === district.id;
                return (
                  <tr
                    key={district.id}
                    onClick={() => { setNotice(null); onSelect(district.id); }}
                    tabIndex={0}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setNotice(null);
                        onSelect(district.id);
                      }
                    }}
                    className={cn("cursor-pointer transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500", selected ? "bg-primary-50" : "hover:bg-soft-slate")}
                    aria-selected={selected}
                  >
                    <td className="px-3 py-3.5">
                      <div className="flex items-center gap-2">
                        <span className={cn("size-2 rounded-full", selected ? "bg-primary-600" : "bg-navy-200")} />
                        <span className="text-[11px] font-extrabold text-navy-900">{district.name}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3.5 text-right text-[11px] font-bold text-navy-600">{district.trained.toLocaleString("en-IN")}</td>
                    <td className="px-3 py-3.5 text-right text-[11px] font-extrabold text-navy-800">{district.employed_rate}%</td>
                    <td className="px-3 py-3.5 text-right text-[11px] font-extrabold text-navy-800">{district.retention_6m_rate}%</td>
                    <td className="px-3 py-3.5 text-right text-[11px] font-extrabold text-primary-700">{district.self_employment_rate == null ? "—" : `${district.self_employment_rate}%`}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        )}

        <p className="mt-3 text-[9px] leading-4 text-navy-400">Map regions are simplified district boundaries. The table and map use the same district dataset.</p>
      </div>
    </div>
  );
}
