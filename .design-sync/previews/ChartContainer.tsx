import {
  ChartContainer,
  ChartLegendContent,
  ChartTooltipContent,
  type ChartConfig,
} from "@repo/ui";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  Tooltip,
  XAxis,
} from "recharts";
// Legend/Tooltip come straight from "recharts", not @repo/ui's re-export:
// the preview bundle carries its own copy of recharts separate from the
// @repo/ui bundle, so BarChart/LineChart only recognize a Legend/Tooltip
// child from THEIR OWN module instance. @repo/ui's ChartLegend/ChartTooltip
// are that other copy and get silently ignored (rendered with no payload).

const accessConfig = {
  granted: {
    label: "Granted",
    color: "var(--chart-1)",
  },
  revoked: {
    label: "Revoked",
    color: "var(--chart-2)",
  },
} satisfies ChartConfig;

const accessData = [
  { month: "Apr", granted: 18, revoked: 4 },
  { month: "May", granted: 22, revoked: 6 },
  { month: "Jun", granted: 15, revoked: 3 },
  { month: "Jul", granted: 27, revoked: 8 },
  { month: "Aug", granted: 24, revoked: 5 },
];

export const Bars = () => (
  <ChartContainer config={accessConfig} className="max-w-lg">
    {/* explicit width/height: this preview's recharts copy is bundled
        separately from @repo/ui's, so ResponsiveContainer's context never
        reaches BarChart and percentage sizing resolves to nothing */}
    <BarChart data={accessData} width={480} height={260}>
      <CartesianGrid vertical={false} />
      <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} />
      <Tooltip content={<ChartTooltipContent />} />
      <Legend content={<ChartLegendContent />} />
      <Bar
        dataKey="granted"
        fill="var(--color-granted)"
        radius={4}
        isAnimationActive={false}
      />
      <Bar
        dataKey="revoked"
        fill="var(--color-revoked)"
        radius={4}
        isAnimationActive={false}
      />
    </BarChart>
  </ChartContainer>
);

const sessionsConfig = {
  active: {
    label: "Active sessions",
    color: "var(--chart-1)",
  },
  elevated: {
    label: "Break-glass sessions",
    color: "var(--chart-3)",
  },
} satisfies ChartConfig;

const sessionsData = [
  { day: "Mon", active: 132, elevated: 2 },
  { day: "Tue", active: 148, elevated: 1 },
  { day: "Wed", active: 156, elevated: 4 },
  { day: "Thu", active: 141, elevated: 3 },
  { day: "Fri", active: 119, elevated: 1 },
];

export const Lines = () => (
  <ChartContainer config={sessionsConfig} className="max-w-lg">
    <LineChart data={sessionsData} width={480} height={260}>
      <CartesianGrid vertical={false} />
      <XAxis
        dataKey="day"
        tickLine={false}
        axisLine={false}
        tickMargin={8}
        padding={{ left: 16, right: 16 }}
      />
      <Tooltip content={<ChartTooltipContent />} />
      <Legend content={<ChartLegendContent />} />
      <Line
        dataKey="active"
        type="monotone"
        stroke="var(--color-active)"
        strokeWidth={2}
        dot={false}
        isAnimationActive={false}
      />
      <Line
        dataKey="elevated"
        type="monotone"
        stroke="var(--color-elevated)"
        strokeWidth={2}
        dot={false}
        isAnimationActive={false}
      />
    </LineChart>
  </ChartContainer>
);
