import type { Meta, StoryObj } from "@storybook/react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./select.js";

const meta: Meta<typeof Select> = {
  title: "Select",
  component: Select,
  tags: ["autodocs"],
};
export default meta;
type Story = StoryObj<typeof Select>;
export const Default: Story = {
  render: () => (
    <Select defaultValue="active">
      <SelectTrigger className="w-56">
        <SelectValue placeholder="Selecione" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="active">Ativas</SelectItem>
        <SelectItem value="suspended">Suspensas</SelectItem>
      </SelectContent>
    </Select>
  ),
};
