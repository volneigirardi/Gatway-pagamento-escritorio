import type { Meta, StoryObj } from "@storybook/react";
import { Input } from "./input.js";

const meta: Meta<typeof Input> = {
  title: "Input",
  component: Input,
  tags: ["autodocs"],
  args: {
    placeholder: "voce@empresa.com",
  },
};
export default meta;
type Story = StoryObj<typeof Input>;
export const Default: Story = {};
export const Password: Story = {
  args: { type: "password", defaultValue: "password" },
};
export const Error: Story = {
  args: { error: true, "aria-label": "E-mail inválido" },
};
export const Disabled: Story = {
  args: { disabled: true },
};
