import type { Meta, StoryObj } from "@storybook/react";
import { Area, AreaChart, CartesianGrid, Tooltip, XAxis } from "recharts";
import { ChartContainer, ChartTooltipContent } from "./chart.js";

const meta: Meta<typeof ChartContainer> = {
  title: "Chart",
  component: ChartContainer,
  tags: ["autodocs"],
};
export default meta;
type Story = StoryObj<typeof ChartContainer>;
const data = [
  { period: "Jan", revenue: 12000 },
  { period: "Fev", revenue: 15800 },
  { period: "Mar", revenue: 19900 },
];
export const AreaRevenue: Story = {
  args: {
    config: { revenue: { label: "Receita", color: "var(--color-chart-1)" } },
  },
  render: (args) => (
    <ChartContainer {...args} className="max-w-2xl" aria-label="Receita mensal">
      <AreaChart accessibilityLayer data={data}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="period" tickLine={false} axisLine={false} />
        <Tooltip
          content={
            <ChartTooltipContent
              valueFormatter={(value) => `R$ ${String(value)}`}
            />
          }
        />
        <Area
          dataKey="revenue"
          type="monotone"
          stroke="var(--color-revenue)"
          fill="var(--color-revenue)"
          fillOpacity={0.15}
        />
      </AreaChart>
    </ChartContainer>
  ),
};
