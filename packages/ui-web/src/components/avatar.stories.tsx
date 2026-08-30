import type { Meta, StoryObj } from "@storybook/react";
import { Avatar, AvatarFallback } from "./avatar.js";

const meta: Meta<typeof Avatar> = {
  title: "Avatar",
  component: Avatar,
  tags: ["autodocs"],
};
export default meta;
type Story = StoryObj<typeof Avatar>;
export const Fallback: Story = {
  render: () => (
    <Avatar>
      <AvatarFallback>BL</AvatarFallback>
    </Avatar>
  ),
};
