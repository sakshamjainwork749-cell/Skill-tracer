"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type {
  AttritionData,
  SkillGapSector,
  TrendPoint,
  TrainingFunnel,
} from "@/lib/types";

const tooltipStyle = {
  backgroundColor: "#102D3A",
  border: "1px solid rgba(255,255,255,.12)",
  borderRadius: 12,
  color: "#fff",
  fontSize: 11,
  boxShadow: "0 16px 35px -18px rgba(16,45,58,.7)",
};

export function OutcomeTrendChart({ data }: { data: TrendPoint[] }) {
  return (
    <div className="h-[300px] w-full" role="img" aria-label="Placement rate, employment rate and six-month retention trend from April to September">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 12, right: 12, left: -18, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 5" vertical={false} stroke="#D2DDD9" />
          <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: "#64748B", fontSize: 10, fontWeight: 700 }} dy={9} />
          <YAxis domain={[50, 100]} axisLine={false} tickLine={false} tick={{ fill: "#94A3B8", fontSize: 9 }} tickFormatter={(value) => `${value}%`} />
          <Tooltip contentStyle={tooltipStyle} formatter={(value, name) => [`${value}%`, name]} />
          <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 10, paddingTop: 14, color: "#4B6A68" }} />
          <Line type="monotone" dataKey="placement_rate" name="Placement rate" stroke="#0B7A75" strokeWidth={2.5} dot={{ r: 3, fill: "#0B7A75", strokeWidth: 0 }} activeDot={{ r: 5, fill: "#0B7A75", stroke: "#fff", strokeWidth: 2 }} />
          <Line type="monotone" dataKey="employed_rate" name="Employment rate" stroke="#10B981" strokeWidth={2.5} dot={{ r: 3, fill: "#10B981", strokeWidth: 0 }} activeDot={{ r: 5, fill: "#10B981", stroke: "#fff", strokeWidth: 2 }} />
          <Line type="monotone" dataKey="retention_6m_rate" name="6M retention rate" stroke="#E99024" strokeWidth={2.5} dot={{ r: 3, fill: "#E99024", strokeWidth: 0 }} activeDot={{ r: 5, fill: "#E99024", stroke: "#fff", strokeWidth: 2 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function FunnelChart({ data }: { data: TrainingFunnel["stages"] }) {
  const colors = ["#0F172A", "#0B7A75", "#3B82F6", "#10B981"];
  return (
    <div className="h-[300px] w-full" role="img" aria-label="Training-to-employment funnel: enrolled 100 percent, completed 92 percent, placed 69 percent, retained at twelve months 58 percent">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 20, right: 12, left: -8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 5" vertical={false} stroke="#D2DDD9" />
          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "#64748B", fontSize: 9, fontWeight: 700 }} dy={9} />
          <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fill: "#94A3B8", fontSize: 9 }} tickFormatter={(value) => `${value}%`} />
          <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(37,99,235,.04)" }} formatter={(value, _name, item) => [`${value}% · ${item.payload.value.toLocaleString("en-IN")} people`, _name]} />
          <Bar dataKey="percentage" name="Share of enrolled" radius={[8, 8, 2, 2]} barSize={42}>
            {data.map((entry, index) => <Cell key={entry.name} fill={colors[index % colors.length]} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function SkillGapBars({ sector }: { sector: SkillGapSector }) {
  return (
    <div className="h-[330px] w-full" role="img" aria-label={`${sector.sector} trained supply compared with market demand`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={sector.skills} layout="vertical" margin={{ top: 6, right: 18, left: 18, bottom: 0 }} barGap={4}>
          <CartesianGrid strokeDasharray="3 5" horizontal={false} stroke="#D2DDD9" />
          <XAxis type="number" domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fill: "#94A3B8", fontSize: 9 }} tickFormatter={(value) => `${value}%`} />
          <YAxis type="category" dataKey="skill" width={105} axisLine={false} tickLine={false} tick={{ fill: "#475569", fontSize: 9, fontWeight: 700 }} />
          <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(37,99,235,.04)" }} formatter={(value, name) => [`${value}%`, name]} />
          <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 10, color: "#4B6A68" }} />
          <Bar dataKey="supply" name="Trained supply" fill="#0B7A75" radius={[0, 5, 5, 0]} barSize={10} />
          <Bar dataKey="demand" name="Market demand" fill="#E99024" radius={[0, 5, 5, 0]} barSize={10} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// Kept as an export for any older dashboard imports during the route migration.
export const SkillGapRadar = SkillGapBars;

const attritionColors = ["#0B7A75", "#E99024", "#10B981", "#94A3B8", "#CBD5E1"];

export function AttritionDonut({ data }: { data: AttritionData }) {
  return (
    <div className="relative h-[270px] w-full" role="img" aria-label="Top attrition reasons donut chart">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Tooltip contentStyle={tooltipStyle} formatter={(value, name) => [`${value}%`, name]} />
          <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 9, color: "#4B6A68" }} />
          <Pie data={data.reasons} dataKey="percentage" nameKey="reason" cx="50%" cy="46%" innerRadius={64} outerRadius={94} paddingAngle={2} stroke="none">
            {data.reasons.map((entry, index) => <Cell key={entry.reason} fill={attritionColors[index % attritionColors.length]} />)}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-x-0 top-[36%] text-center">
        <p className="text-2xl font-extrabold tracking-tight text-navy-900">{data.total.toLocaleString("en-IN")}</p>
        <p className="mt-0.5 text-[8px] font-extrabold uppercase tracking-[0.12em] text-navy-400">Exit records</p>
      </div>
    </div>
  );
}
