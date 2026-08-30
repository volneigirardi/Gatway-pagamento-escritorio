import type { Meta, StoryObj } from "@storybook/react";
import { Button } from "./button.js";
import { PageHeader } from "./page-header.js";

const meta: Meta<typeof PageHeader> = {
  title: "Page Header",
  component: PageHeader,
  tags: ["autodocs"],
};
export default meta;
type Story = StoryObj<typeof PageHeader>;
export const Default: Story = {
  args: {
    title: "Empresas",
    description: "Gerencie clientes e acompanhe o provisionamento.",
    actions: <Button>Nova empresa</Button>,
  },
};
