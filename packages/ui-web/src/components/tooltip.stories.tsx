import type { Meta, StoryObj } from "@storybook/react";
import { Button } from "./button.js";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./tooltip.js";

const meta: Meta<typeof Tooltip> = {
  title: "Tooltip",
  component: Tooltip,
  tags: ["autodocs"],
};
export default meta;
type Story = StoryObj<typeof Tooltip>;
export const Default: Story = {
  render: () => (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="outline">Indicador</Button>
        </TooltipTrigger>
        <TooltipContent>Receita recorrente mensal</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  ),
};
