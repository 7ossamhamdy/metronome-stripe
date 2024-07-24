export interface SessionData {
  customerId: string;
  product: {
    name: string;
    price: number;
    description: string;
  };
}

export interface ConfirmPaymentData {
  amount: number;
  cardId: string;
  customerId: string;
}
