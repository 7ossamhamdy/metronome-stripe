import { v4 as uuid } from 'uuid';
import axios, { AxiosError, AxiosInstance } from 'axios';
import {
  CreateCustomerRequest,
  CreateCustomerResponse,
  GetCustomerResponse,
  GetInvoiceResponse,
  ListCustomerBillableMetricsResponse,
  ListCustomersResponse,
  ListInvoicesResponse,
  GetLedgersResponse,
  MetronomeListResponse,
  MetronomeResponse,
  GetGrantsResponse,
} from './MetronomeService.d';

import DATA from '../data.json';
import { CreateCustomerDto, EventDto, PaginationDto } from './MetronomeDtos';

export class MetronomeAPIError extends Error {
  constructor(message: string, public statusCode: number = 400) {
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

  async createCustomer({ email, name, stripeId, externalId }: CreateCustomerDto): Promise<CreateCustomerResponse> {
    const data: CreateCustomerRequest = {
      name,
      ingest_aliases: [email, externalId],
      billing_config: {
        billing_provider_type: 'stripe',
        billing_provider_customer_id: stripeId,
        stripe_collection_method: 'charge_automatically',
      },
    };

    return this.api.post<CreateCustomerRequest, CreateCustomerResponse>('/customers', data);
  }

  async findCustomer(customerId: string) {
    return this.api.get<never, GetCustomerResponse>(`/customers/${customerId}`);
  }

  async findCustomerByIngestAlias(ingestAlias: string): Promise<GetCustomerResponse> {
    const { data } = await this.api.get<never, ListCustomersResponse>(`/customers`, {
      params: {
        ingest_alias: ingestAlias.toLowerCase(),
      },
    });

    if (!data.length) {
      throw new MetronomeAPIError('Customer not found', 404);
    }

    return { data: data[0] };
  }

  async listCustomerPlans(customerId: string, { limit, next_page }: PaginationDto) {
    return this.api.get(`/customers/${customerId}/plans`, {
      params: {
        limit,
        next_page,
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

    const { pending } = await this.getCustomerCreditsTotal(customerId);
    if (pending > 0) {
      throw new MetronomeAPIError('Cannot purchase credits while there are pending credits', 400);
    }

    const now = new Date();
    const today = new Date(new Date().setUTCHours(0, 0, 0, 0));
    const yearLater = new Date(today.getFullYear() + 1, today.getMonth(), today.getDate());

    const payload = {
      name: `${credit.amount} Credits`,
      customer_id: customerId,
      uniqueness_key: uuid(),
      grant_amount: {
        amount: credit.amount,
        credit_type_id: process.env.METRONOME_ATOMICA_TYPE_ID,
      },
      paid_amount: {
        amount: credit.cost * 100, // convert to cents
        credit_type_id: process.env.METRONOME_USD_TYPE_ID,
      },
      priority: 1,
      effective_at: now.toISOString(),
      invoice_date: now.toISOString(),
      expires_at: yearLater.toISOString(),
      reason: `Purchased ${credit.amount} credits for $${credit.cost}`,
      credit_grant_type: 'credits',
      // prepaid_options: {
      //   billing_provider_type: 'stripe',
      //   stripe_options: {
      //     redirect_url: 'https://api.metronome.com/v1',
      //     invoice_custom_fields: [{ key: 'credit_purchase', value: 'true' }],
      //     invoice_metadata: {
      //       metronome_id: uniqueness_key,
      //       service_period: `${today.toISOString()} - ${yearLater.toISOString()}`,
      //     },
      //   },
      // },
    };

    return this.api.post('/credits/createGrant', payload);
  }

  async listCustomerCreditLedgers(customerId: string): Promise<GetLedgersResponse> {
    const { data } = await this.api.post<never, MetronomeListResponse>(`/credits/listEntries`, {
      customer_ids: [customerId],
      credit_type_ids: [process.env.METRONOME_ATOMICA_TYPE_ID],
    });

    return {
      data: data[0].ledgers[0] || null,
    };
  }

  async listCustomerCreditGrants(customerId: string, pagination?: PaginationDto): Promise<GetGrantsResponse> {
    return await this.api.post<any, any>(
      `/credits/listGrants`,
      {
        customer_ids: [customerId],
        credit_type_ids: [process.env.METRONOME_ATOMICA_TYPE_ID],
      },
      { params: pagination },
    );
  }

  async findCreditGrant(grantId: string): Promise<GetGrantsResponse> {
    const { data } = await this.api.post<any, any>(`/credits/listGrants`, {
      credit_grant_ids: [grantId],
    });

    if (!data.length) {
      throw new MetronomeAPIError('Credit grant not found', 404);
    }

    return { data: data[0] };
  }

  async voidCreditGrant(customerId: string, grantId: string) {
    const { data: grant } = await this.findCreditGrant(grantId);

    if (grant.customer_id !== customerId) {
      throw new MetronomeAPIError('Credit grant not found', 404);
    }

    if (grant.balance.including_pending !== grant.balance.excluding_pending) {
      throw new MetronomeAPIError('Cannot void a credit grant with consumed credits', 400);
    }

    await this.api.post(`/credits/voidGrant`, {
      id: grantId,
      void_credit_purchase_invoice: true,
    });

    return this.getCustomerInvoice(customerId, grant.invoice_id);
  }

  async listPlans({ limit, next_page }: PaginationDto) {
    return this.api.get('/plans', {
      params: {
        limit,
        next_page,
      },
    });
  }

  async listCustomerBillableMetrics(customerId: string): Promise<ListCustomerBillableMetricsResponse> {
    return this.api.get<never, ListCustomerBillableMetricsResponse>(`/customers/${customerId}/billable-metrics`, {
      params: {
        on_current_plan: true,
      },
    });
  }

  async ingestEvent(customerId: string, { eventType, properties }: EventDto) {
    const { data: billableMetrics } = await this.listCustomerBillableMetrics(customerId);

    const metric = billableMetrics.find((metric) =>
      metric.event_type_filter.in_values.find((eventValue) => eventValue === eventType),
    );

    if (!metric) {
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

  async listCustomerInvoices(
    customerId: string,
    queryParams: { [key: string]: string | number | boolean } = {},
  ): Promise<ListInvoicesResponse> {
    return this.api.get<never, ListInvoicesResponse>(`/customers/${customerId}/invoices`, {
      params: {
        ...queryParams,
        sort: 'date_desc',
        status: 'FINALIZED',
      },
    });
  }

  async getCustomerInvoice(customerId: string, invoiceId: string): Promise<GetInvoiceResponse> {
    return this.api.get<never, GetInvoiceResponse>(`/customers/${customerId}/invoices/${invoiceId}`);
  }

  async getCustomerCreditsTotal(customerId: string) {
    const credits = {
      pending: 0,
      available: 0,
      consumed: 0,
      total: 0,
    };

    const { data: ledgers } = await this.listCustomerCreditLedgers(customerId);

    if (!ledgers) {
      return credits;
    }

    credits.available = ledgers.ending_balance.including_pending;
    credits.total = ledgers.ending_balance.excluding_pending;
    credits.consumed = credits.total - credits.available;

    const lastEntry = ledgers.entries[ledgers.entries.length - 1];

    const { data: invoice } = await this.getCustomerInvoice(customerId, lastEntry.invoice_id);

    if (!invoice.external_invoice || invoice.external_invoice.external_status !== 'PAID') {
      credits.pending = lastEntry.amount;
      credits.available -= credits.pending;
    }

    return credits;
  }
}
