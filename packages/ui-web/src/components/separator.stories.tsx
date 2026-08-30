import type { Meta, StoryObj } from "@storybook/react";
import { Separator } from "./separator.js";

const meta: Meta<typeof Separator> = {
  title: "Separator",
  component: Separator,
  tags: ["autodocs"],
};
export default meta;
type Story = StoryObj<typeof Separator>;
export const Horizontal: Story = {
  render: () => (
    <div className="w-80 space-y-3">
      <span>Empresa</span>
      <Separator />
      <span className="text-sm text-text-muted">Configurações</span>
    </div>
  ),
};
