import { motion } from "framer-motion";
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

// Neutral monochrome ramp (matches the app's --foreground scale) for groupings
// with no inherent status meaning, e.g. category breakdowns.
const NEUTRAL_RAMP = [
  "hsl(0, 0%, 9%)",
  "hsl(0, 0%, 32%)",
  "hsl(0, 0%, 55%)",
  "hsl(0, 0%, 78%)",
];

// Status colors are looked up by the actual status key (not array position),
// so "Pending"/"Rejected" reliably render as the same destructive red used
// in badges elsewhere, regardless of data order.
const STATUS_COLORS: Record<string, string> = {
  pending: "hsl(0, 72%, 51%)",
  rejected: "hsl(0, 72%, 51%)",
  in_review: "hsl(0, 0%, 9%)",
  resolved: "hsl(0, 0%, 45%)",
  closed: "hsl(0, 0%, 78%)",
};

const FOREGROUND = "hsl(0, 0%, 9%)";

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

function groupByStatus(items: ComplaintItem[]) {
  const map: Record<string, number> = {};
  items.forEach((item) => {
    map[item.status] = (map[item.status] || 0) + 1;
  });
  return Object.entries(map).map(([status, count]) => ({
    status,
    name: statusLabels[status] || status,
    count,
  }));
}

const PRIORITY_COLORS: Record<string, string> = {
  high: "hsl(0, 72%, 51%)",
  medium: "hsl(0, 0%, 32%)",
  low: "hsl(0, 0%, 78%)",
};

function groupByPriority(items: ComplaintItem[]) {
  const map: Record<string, number> = {};
  items.forEach((item) => {
    map[item.priority] = (map[item.priority] || 0) + 1;
  });
  return Object.entries(map).map(([priority, count]) => ({
    priority,
    name: priorityLabels[priority] || priority,
    count,
  }));
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

const barConfig: ChartConfig = { count: { label: "Complaints", color: FOREGROUND } };
const lineConfig: ChartConfig = { count: { label: "Complaints", color: FOREGROUND } };

export default function AdminCharts({ complaints }: AdminChartsProps) {
  const byCategory = groupBy(complaints, "category", categoryLabels);
  const byPriority = groupByPriority(complaints);
  const byStatus = groupByStatus(complaints);
  const byMonth = groupByMonth(complaints);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="grid gap-3 sm:gap-4 md:grid-cols-2"
    >
      {/* By Category */}
      <Card className="shadow-elevation-sm">
        <CardHeader className="pb-2"><CardTitle className="text-base tracking-tight">By Category</CardTitle></CardHeader>
        <CardContent>
          <ChartContainer config={barConfig} className="h-[200px] w-full">
            <BarChart data={byCategory}>
              <XAxis dataKey="name" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {byCategory.map((_, i) => (
                  <Cell key={i} fill={NEUTRAL_RAMP[i % NEUTRAL_RAMP.length]} />
                ))}
              </Bar>
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* By Status */}
      <Card className="shadow-elevation-sm">
        <CardHeader className="pb-2"><CardTitle className="text-base tracking-tight">By Status</CardTitle></CardHeader>
        <CardContent>
          <ChartContainer config={barConfig} className="h-[200px] w-full">
            <PieChart>
              <ChartTooltip content={<ChartTooltipContent />} />
              <Pie data={byStatus} dataKey="count" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, count }) => `${name}: ${count}`} fontSize={11}>
                {byStatus.map((entry, i) => (
                  <Cell key={i} fill={STATUS_COLORS[entry.status] || NEUTRAL_RAMP[i % NEUTRAL_RAMP.length]} />
                ))}
              </Pie>
            </PieChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* By Priority */}
      <Card className="shadow-elevation-sm">
        <CardHeader className="pb-2"><CardTitle className="text-base tracking-tight">By Priority</CardTitle></CardHeader>
        <CardContent>
          <ChartContainer config={barConfig} className="h-[200px] w-full">
            <BarChart data={byPriority}>
              <XAxis dataKey="name" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {byPriority.map((entry, i) => (
                  <Cell key={i} fill={PRIORITY_COLORS[entry.priority] || NEUTRAL_RAMP[i % NEUTRAL_RAMP.length]} />
                ))}
              </Bar>
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Monthly Trend */}
      <Card className="shadow-elevation-sm">
        <CardHeader className="pb-2"><CardTitle className="text-base tracking-tight">Monthly Trend</CardTitle></CardHeader>
        <CardContent>
          <ChartContainer config={lineConfig} className="h-[200px] w-full">
            <LineChart data={byMonth}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="month" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Line type="monotone" dataKey="count" stroke={FOREGROUND} strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ChartContainer>
        </CardContent>
      </Card>
    </motion.div>
  );
}
