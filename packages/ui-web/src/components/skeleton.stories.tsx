import type { Meta, StoryObj } from "@storybook/react";
import { Skeleton } from "./skeleton.js";

const meta: Meta<typeof Skeleton> = {
  title: "Skeleton",
  component: Skeleton,
  tags: ["autodocs"],
};
export default meta;
type Story = StoryObj<typeof Skeleton>;
export const CardLoading: Story = {
  render: () => (
    <div className="space-y-3">
      <Skeleton className="h-5 w-40" />
      <Skeleton className="h-10 w-64" />
    </div>
  ),
};
