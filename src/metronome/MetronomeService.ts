import { v4 as uuid } from 'uuid';
import axios, { AxiosError, AxiosInstance } from 'axios';

import DATA from '../data.json';
import { CreateCustomerDto, EventDto, PaginationDto } from './MetronomeDtos';

export class MetronomeAPIError extends Error {
  constructor(message: string, public statusCode: number = 500) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class MetronomeService {
  private readonly api: AxiosInstance;

  constructor() {
    if (!process.env.METRONOME_API_KEY) {
      throw new Error('METRONOME_API_KEY is required');
    }

    this.api = axios.create({
      baseURL: 'https://api.metronome.com/v1',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.METRONOME_API_KEY}`,
      },
    });

    this.api.interceptors.response.use(
      (response) => response.data,
      (error: AxiosError) => {
        if (error.response) {
          throw new MetronomeAPIError((error.response.data as any).message, error.response.status);
        }

        throw new MetronomeAPIError(error.message, error.status);
      },
    );
  }

  async createCustomer({ email, name, stripeId, externalId }: CreateCustomerDto) {
    return this.api.post('/customers', {
      name,
      // external_id: email,
      ingest_aliases: [email, externalId],
      billing_config: {
        billing_provider_type: 'stripe',
        billing_provider_customer_id: stripeId,
        stripe_collection_method: 'charge_automatically',
      },
      // custom_fields: {
      //   email,
      // },
    });
  }

  async findCustomer(externalId: string) {
    const { data } = await this.api.get<any>(`/customers?ingest_alias=${externalId}`);

    return data[0] || null;
  }

  async listCustomerPlans(customerId: string, { limit, nextPage }: PaginationDto) {
    return this.api.get(`/customers/${customerId}/plans`, {
      params: {
        limit,
        next_page: nextPage,
      },
    });
  }

  async addCustomerToPlan(customerId: string, planId: string) {
    // Today UTC midnight
    const todayUTC = new Date().setUTCHours(0, 0, 0, 0);

    return this.api.post(`/customers/${customerId}/plans/add`, {
      plan_id: planId,
      starting_on: new Date(todayUTC).toISOString(),
    });
  }

  async endCustomerPlan(customerId: string, planId: string, endingBefore?: string) {
    let endingDate = new Date(endingBefore).setUTCHours(0, 0, 0, 0);

    if (isNaN(endingDate)) {
      endingDate = new Date().setUTCHours(0, 0, 0, 0);
    }

    return this.api.post(`/customers/${customerId}/plans/${planId}/end`, {
      ending_before: new Date(endingDate).toISOString(),
      void_invoices: false,
      void_stripe_invoices: false,
    });
  }

  async createCreditGrant(customerId: string, creditId: number) {
    const credit = DATA.credits.find((c) => c.id === creditId);

    if (!credit) {
      throw new MetronomeAPIError('Credit not found', 400);
    }

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0);
    const yearLater = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate(), 0, 0);

    // 'prepaid_options', 'customer_id', 'grant_amount', 'name', 'expires_at', 'invoice_date', 'paid_amount', 'priority';

    const key = uuid();
    const payload = {
      name: `${credit.amount} Credits`,
      customer_id: customerId,
      uniqueness_key: key,
      grant_amount: {
        amount: credit.amount,
        credit_type_id: process.env.METRONOME_ATOMICA_TYPE_ID,
      },
      paid_amount: {
        amount: credit.cost * 100, // convert to cents
        credit_type_id: process.env.METRONOME_USD_TYPE_ID,
      },
      priority: 1,
      // effective_at: today.toISOString(),
      expires_at: yearLater.toISOString(), // 1 year later
      invoice_date: today.toISOString(),
      reason: `Purchased ${credit.amount} credits for $${credit.cost}`,
      credit_grant_type: 'credits',
      prepaid_options: {
        billing_provider_type: 'stripe',
        stripe_options: {
          invoice_metadata: {
            metronome_id: key,
            service_period: `${today.toISOString()} - ${yearLater.toISOString()}`,
          },
        },
      },
    };

    return this.api.post('/credits/createGrant', payload);
  }

  async listCustomerCreditLedgers(customerId: string, pagination?: PaginationDto) {
    const { data, next_page } = await this.api.post<any, any>(
      `/credits/listEntries`,
      { customer_ids: [customerId] },
      {
        params: {
          limit: pagination?.limit,
          next_page: pagination.nextPage,
        },
      },
    );

    return {
      ledgers: data[0].ledgers,
      nextPage: next_page,
    };
  }

  async listCustomerCreditGrants(customerId: string, pagination?: PaginationDto) {
    const { data, next_page } = await this.api.post<any, any>(
      `/credits/listGrants`,
      { customer_ids: [customerId] },
      {
        params: {
          limit: pagination?.limit,
          next_page: pagination.nextPage,
        },
      },
    );

    return {
      grants: data,
      nextPage: next_page,
    };
  }

  async voidCreditGrant(grantId: string) {
    return this.api.post(`/credits/voidGrant`, {
      id: grantId,
      void_credit_purchase_invoice: true,
    });
  }

  async listPlans({ limit, nextPage }: PaginationDto) {
    return this.api.get('/plans', {
      params: {
        limit,
        next_page: nextPage,
      },
    });
  }

  async listCustomerBillableMetrics(customerId: string, pagination?: PaginationDto) {
    return this.api.get<any, any>(`/customers/${customerId}/billable-metrics`, {
      params: {
        on_current_plan: true,
        limit: pagination?.limit,
        next_page: pagination?.nextPage,
      },
    });
  }

  async ingestEvent(customerId: string, { eventType, properties }: EventDto) {
    const { data: billableMetrics } = await this.listCustomerBillableMetrics(customerId);

    const isValidEventType = billableMetrics.some((metric) =>
      metric.event_type_filter.in_values.some((eventValue) => eventValue === eventType),
    );

    if (!isValidEventType) {
      throw new MetronomeAPIError('Invalid event type', 400);
    }

    return this.api.post('/ingest', [
      {
        transaction_id: uuid(),
        timestamp: new Date().toISOString(),
        customer_id: customerId,
        event_type: eventType,
        properties,
      },
    ]);
  }

  async listCustomerInvoices(customerId: string, pagination?: PaginationDto) {
    return this.api.get(`/customers/${customerId}/invoices`, {
      params: {
        limit: pagination?.limit,
        next_page: pagination.nextPage,
      },
    });
  }

  async getCustomerInvoice(customerId: string, invoiceId: string) {
    return this.api.get<any, any>(`/customers/${customerId}/invoices/${invoiceId}`);
  }
}
