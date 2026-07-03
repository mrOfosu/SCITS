import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, PieChart, Pie, Cell, LineChart, Line, CartesianGrid } from "recharts";

interface ComplaintItem {
  category: string;
  priority: string;
  status: string;
  created_at: string;
}

interface AdminChartsProps {
  complaints: ComplaintItem[];
}

const COLORS = [
  "hsl(222.2, 47.4%, 11.2%)",
  "hsl(215.4, 16.3%, 46.9%)",
  "hsl(0, 84.2%, 60.2%)",
  "hsl(210, 40%, 96.1%)",
];

const categoryLabels: Record<string, string> = {
  academic: "Academic",
  infrastructure: "Infrastructure",
  administrative: "Administrative",
  other: "Other",
};

const statusLabels: Record<string, string> = {
  pending: "Pending",
  in_review: "In Review",
  resolved: "Resolved",
  closed: "Closed",
};

const priorityLabels: Record<string, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

function groupBy(items: ComplaintItem[], key: keyof ComplaintItem, labelMap: Record<string, string>) {
  const map: Record<string, number> = {};
  items.forEach((item) => {
    const val = item[key] as string;
    map[val] = (map[val] || 0) + 1;
  });
  return Object.entries(map).map(([name, count]) => ({ name: labelMap[name] || name, count }));
}

function groupByMonth(items: ComplaintItem[]) {
  const map: Record<string, number> = {};
  items.forEach((item) => {
    const d = new Date(item.created_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    map[key] = (map[key] || 0) + 1;
  });
  return Object.entries(map)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-12)
    .map(([month, count]) => ({ month, count }));
}

const barConfig: ChartConfig = { count: { label: "Complaints", color: "hsl(222.2, 47.4%, 11.2%)" } };
const lineConfig: ChartConfig = { count: { label: "Complaints", color: "hsl(222.2, 47.4%, 11.2%)" } };

export default function AdminCharts({ complaints }: AdminChartsProps) {
  const byCategory = groupBy(complaints, "category", categoryLabels);
  const byPriority = groupBy(complaints, "priority", priorityLabels);
  const byStatus = groupBy(complaints, "status", statusLabels);
  const byMonth = groupByMonth(complaints);

  return (
    <div className="grid gap-3 sm:gap-4 md:grid-cols-2">
      {/* By Category */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">By Category</CardTitle></CardHeader>
        <CardContent>
          <ChartContainer config={barConfig} className="h-[200px] w-full">
            <BarChart data={byCategory}>
              <XAxis dataKey="name" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="count" fill="hsl(222.2, 47.4%, 11.2%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* By Status */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">By Status</CardTitle></CardHeader>
        <CardContent>
          <ChartContainer config={barConfig} className="h-[240px] w-full">
            <PieChart margin={{ top: 8, right: 16, bottom: 8, left: 16 }}>
              <ChartTooltip content={<ChartTooltipContent />} />
              <Pie
                data={byStatus}
                dataKey="count"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={38}
                outerRadius={68}
                paddingAngle={2}
                labelLine={false}
                label={({ percent }) => (percent && percent > 0.06 ? `${Math.round(percent * 100)}%` : "")}
              >
                {byStatus.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} stroke="hsl(var(--background))" strokeWidth={2} />
                ))}
              </Pie>
            </PieChart>
          </ChartContainer>
          <div className="mt-2 flex flex-wrap justify-center gap-x-3 gap-y-1 text-xs">
            {byStatus.map((s, i) => (
              <div key={s.name} className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm" style={{ background: COLORS[i % COLORS.length] }} />
                <span className="text-muted-foreground">{s.name}</span>
                <span className="font-medium">{s.count}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* By Priority */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">By Priority</CardTitle></CardHeader>
        <CardContent>
          <ChartContainer config={barConfig} className="h-[200px] w-full">
            <BarChart data={byPriority}>
              <XAxis dataKey="name" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="count" fill="hsl(0, 84.2%, 60.2%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Monthly Trend */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Monthly Trend</CardTitle></CardHeader>
        <CardContent>
          <ChartContainer config={lineConfig} className="h-[200px] w-full">
            <LineChart data={byMonth}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="month" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Line type="monotone" dataKey="count" stroke="hsl(222.2, 47.4%, 11.2%)" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ChartContainer>
        </CardContent>
      </Card>
    </div>
  );
}
