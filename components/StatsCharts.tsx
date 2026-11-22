"use client";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

function Chart({ title, data, dataKey, color }: { title: string; data: object[]; dataKey: string; color: string }) {
  return (
    <div className="card h-72">
      <b className="text-sm">{title}</b>
      <ResponsiveContainer width="100%" height="90%">
        <BarChart data={data}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" fontSize={11} /><YAxis allowDecimals={false} /><Tooltip /><Bar dataKey={dataKey} fill={color} /></BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function StatsCharts({ runs, wickets, points }: { runs: object[]; wickets: object[]; points: object[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Chart title="Top run scorers" data={runs} dataKey="runs" color="#16a34a" />
      <Chart title="Top wicket takers" data={wickets} dataKey="wickets" color="#dc2626" />
      <Chart title="Team points" data={points} dataKey="points" color="#2563eb" />
    </div>
  );
}
