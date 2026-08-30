import type { Meta, StoryObj } from "@storybook/react";
import { Textarea } from "./textarea.js";

const meta: Meta<typeof Textarea> = {
  title: "Textarea",
  component: Textarea,
  tags: ["autodocs"],
};
export default meta;
type Story = StoryObj<typeof Textarea>;
export const Default: Story = { args: { placeholder: "Descrição do plano" } };
export const Error: Story = {
  args: {
    error: true,
    defaultValue: "Valor inválido",
    "aria-label": "Descrição inválida",
  },
};
