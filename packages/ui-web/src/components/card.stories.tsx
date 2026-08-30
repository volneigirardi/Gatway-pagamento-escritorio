import type { Meta, StoryObj } from "@storybook/react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./card.js";

const meta: Meta<typeof Card> = {
  title: "Card",
  component: Card,
  tags: ["autodocs"],
};
export default meta;
type Story = StoryObj<typeof Card>;
export const Default: Story = {
  render: () => (
    <Card className="max-w-sm">
      <CardHeader>
        <CardTitle>Receita recorrente</CardTitle>
        <CardDescription>Resultado consolidado do período.</CardDescription>
      </CardHeader>
      <CardContent className="text-2xl font-semibold">R$ 19.900</CardContent>
    </Card>
  ),
};
