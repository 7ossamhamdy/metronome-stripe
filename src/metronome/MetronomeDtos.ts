export interface CreateCustomerDto {
  externalId: string;
  name: string;
  email: string;
  stripeId: string;
}

export interface EventDto {
  customerId: string;
  eventType: string;
  properties: Record<string, any>;
}

export interface PaginationDto {
  limit?: number;
  next_page?: string;
}
