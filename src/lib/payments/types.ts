export interface PaymentRow {
  id: string;
  projectId: string;
  projectName: string;
  clientName: string;
  projectActive: boolean;
  name: string;
  dueDate: string | null;
  amountDue: number | null;
  paidDate: string | null;
  amountPaid: number | null;
  status: string;
}
