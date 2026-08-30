import type { Meta, StoryObj } from "@storybook/react";
import { Badge } from "./badge.js";

const meta: Meta<typeof Badge> = {
  title: "Badge",
  component: Badge,
  tags: ["autodocs"],
};
export default meta;
type Story = StoryObj<typeof Badge>;
export const Statuses: Story = {
  render: () => (
    <div className="flex gap-2">
      <Badge variant="success">Ativa</Badge>
      <Badge variant="warning">Pendente</Badge>
      <Badge variant="destructive">Suspensa</Badge>
      <Badge variant="outline">Rascunho</Badge>
    </div>
  ),
};
