import type { Meta, StoryObj } from "@storybook/react";
import { Button } from "./button.js";

const meta: Meta<typeof Button> = {
  title: "Button",
  component: Button,
  tags: ["autodocs"],
};
export default meta;
type Story = StoryObj<typeof Button>;
export const Default: Story = { args: { children: "Button" } };
export const Destructive: Story = {
  args: { variant: "destructive", children: "Delete" },
};
export const Outline: Story = {
  args: { variant: "outline", children: "Outline" },
};
export const Loading: Story = {
  args: { disabled: true, children: "Loading..." },
};
