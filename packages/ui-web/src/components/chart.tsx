import * as React from "react";
import { ResponsiveContainer, type TooltipContentProps } from "recharts";
import { cn } from "../lib/utils.js";

export type ChartConfig = Record<
  string,
  {
    label?: React.ReactNode;
    color?: string;
  }
>;

const ChartContext = React.createContext<ChartConfig | null>(null);

function useChart(): ChartConfig {
  const context = React.useContext(ChartContext);
  if (!context)
    throw new Error("Chart components must be inside ChartContainer");
  return context;
}

interface ChartContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  "aria-label": string;
  config: ChartConfig;
  children: React.ComponentProps<typeof ResponsiveContainer>["children"];
}

const ChartContainer = React.forwardRef<HTMLDivElement, ChartContainerProps>(
  ({ config, className, children, style, ...props }, ref) => {
    const variables = Object.fromEntries(
      Object.entries(config)
        .filter(([key, item]) => /^[a-zA-Z0-9_-]+$/u.test(key) && item.color)
        .map(([key, item]) => [`--color-${key}`, item.color]),
    ) as React.CSSProperties;
    return (
      <ChartContext.Provider value={config}>
        <div
          ref={ref}
          role="img"
          className={cn(
            "flex min-h-56 w-full justify-center text-xs [&_.recharts-cartesian-axis-tick_text]:fill-text-muted [&_.recharts-cartesian-grid_line]:stroke-border [&_.recharts-curve.recharts-tooltip-cursor]:stroke-border",
            className,
          )}
          style={{ ...variables, ...style }}
          {...props}
        >
          <ResponsiveContainer>{children}</ResponsiveContainer>
        </div>
      </ChartContext.Provider>
    );
  },
);
ChartContainer.displayName = "ChartContainer";

interface ChartTooltipContentProps extends Partial<
  TooltipContentProps<number, string>
> {
  className?: string;
  hideLabel?: boolean;
  valueFormatter?: (value: number) => React.ReactNode;
}

const ChartTooltipContent = React.forwardRef<
  HTMLDivElement,
  ChartTooltipContentProps
>(
  (
    { active, payload, label, hideLabel = false, valueFormatter, className },
    ref,
  ) => {
    const config = useChart();
    if (!active || !payload?.length) return null;
    return (
      <div
        ref={ref}
        className={cn(
          "grid min-w-36 gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-xs shadow-md",
          className,
        )}
      >
        {!hideLabel && label !== undefined ? (
          <div className="font-medium text-text">{String(label)}</div>
        ) : null}
        <div className="grid gap-1.5">
          {payload.map((item, index) => {
            const key = String(item.dataKey ?? item.name ?? index);
            const itemConfig = config[key];
            const value = typeof item.value === "number" ? item.value : 0;
            return (
              <div key={key} className="flex items-center gap-2">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-sm"
                  style={{ backgroundColor: item.color ?? itemConfig?.color }}
                  aria-hidden="true"
                />
                <span className="text-text-muted">
                  {itemConfig?.label ?? item.name ?? key}
                </span>
                <span className="ml-auto font-mono font-medium tabular-nums text-text">
                  {valueFormatter ? valueFormatter(value) : String(value)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  },
);
ChartTooltipContent.displayName = "ChartTooltipContent";

export { ChartContainer, ChartTooltipContent };
