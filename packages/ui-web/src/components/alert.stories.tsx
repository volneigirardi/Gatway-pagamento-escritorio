import type { Meta, StoryObj } from "@storybook/react";
import { Alert, AlertDescription, AlertTitle } from "./alert.js";

const meta: Meta<typeof Alert> = {
  title: "Alert",
  component: Alert,
  tags: ["autodocs"],
};
export default meta;
type Story = StoryObj<typeof Alert>;
export const Warning: Story = {
  render: () => (
    <Alert variant="warning" className="max-w-lg">
      <AlertTitle>Pagamento pendente</AlertTitle>
      <AlertDescription>Revise a fatura antes do vencimento.</AlertDescription>
    </Alert>
  ),
};
