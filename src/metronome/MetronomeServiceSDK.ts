import { v4 as uuid } from 'uuid';

import { plansCharges } from './data.json';
import { CreateCustomerDto, EventDto, PaginationDto } from './MetronomeDtos';
import Metronome from '@metronome/sdk';

export class MetronomeServiceSDK {
  private readonly metronome: Metronome;
  constructor() {
    this.metronome = new Metronome();
  }

  async createCustomer({ email, name, stripeId, externalId }: CreateCustomerDto) {
    return this.metronome.customers.create({
      name,
      ingest_aliases: [email, externalId],
      billing_config: {
        billing_provider_type: 'stripe',
        billing_provider_customer_id: stripeId,
        stripe_collection_method: 'charge_automatically',
      },
    });
  }

  async findCustomer(customerId: string) {
    return this.metronome.customers.retrieve(customerId);
  }

  async findCustomerByIngestAlias(ingestAlias: string) {
    const { data } = await this.metronome.customers.list({
      ingest_alias: ingestAlias.toLowerCase(),
    });

    return data[0] || null;
  }

  async listCustomerPlans(customerId: string, pagination?: PaginationDto) {
    const plans = await this.metronome.customers.plans.list(customerId, pagination);

    return plans.data;
  }

  async addCustomerToPlan(customerId: string, planId: string) {
    // Today UTC midnight
    const todayUTC = new Date().setUTCHours(0, 0, 0, 0);

    return this.metronome.customers.plans.add(customerId, {
      plan_id: planId,
      starting_on: new Date(todayUTC).toISOString(),
    });
  }

  async endCustomerPlan(customerId: string, customerPlanId: string, endingBefore?: string) {
    let endingDate = new Date(endingBefore).setUTCHours(0, 0, 0, 0);

    if (isNaN(endingDate)) {
      endingDate = new Date().setUTCHours(0, 0, 0, 0);
    }

    return this.metronome.customers.plans.end(customerId, customerPlanId, {
      ending_before: new Date(endingDate).toISOString(),
    });
  }

  async createCreditGrant(customerId: string, creditId: number) {
    const credit = plansCharges.find((c) => c.id === creditId);
    if (!credit) {
      throw new Metronome.APIError(400, undefined, 'Invalid credit ID', undefined);
    }

    const {
      data: { pending },
    } = await this.getCustomerCreditsTotal(customerId);
    if (pending > 0) {
      throw new Metronome.APIError(
        400,
        undefined,
        'Cannot purchase credits while there are pending credits',
        undefined,
      );
    }

    const now = new Date();
    const today = new Date(new Date().setUTCHours(0, 0, 0));
    const yearLater = new Date(today.getFullYear() + 1, today.getMonth(), today.getDate());

    const payload: Metronome.CreditGrantCreateParams = {
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
      effective_at: today.toISOString(),
      invoice_date: now.toISOString(),
      expires_at: yearLater.toISOString(),
      reason: `Purchased ${credit.amount} credits for $${credit.cost}`,
      credit_grant_type: 'credits',
    };

    return this.metronome.creditGrants.create(payload);
  }

  async listCustomerCreditLedgers(customerId: string) {
    const { data } = await this.metronome.creditGrants.listEntries({
      customer_ids: [customerId],
      credit_type_ids: [process.env.METRONOME_ATOMICA_TYPE_ID],
    });

    return {
      data: data[0].ledgers[0] || null,
    };
  }

  async listCustomerCreditGrants(customerId: string, pagination?: PaginationDto) {
    const credits = await this.metronome.creditGrants.list({
      customer_ids: [customerId],
      credit_type_ids: [process.env.METRONOME_ATOMICA_TYPE_ID],
      ...pagination,
    });

    return credits.data;
  }

  async findCreditGrant(grantId: string) {
    const { data } = await this.metronome.creditGrants.list({
      credit_grant_ids: [grantId],
    });

    if (!data.length) {
      throw new Metronome.APIError(404, undefined, 'Credit grant not found', undefined);
    }

    return { data: data[0] };
  }

  async voidCreditGrant(customerId: string, grantId: string) {
    const { data: grant } = await this.findCreditGrant(grantId);

    if (grant.customer_id !== customerId) {
      throw new Metronome.APIError(404, undefined, 'Credit grant not found', undefined);
    }

    if (grant.balance.including_pending !== grant.balance.excluding_pending) {
      throw new Metronome.APIError(400, undefined, 'Cannot void a credit grant with consumed credits', undefined);
    }

    await this.metronome.creditGrants.void({
      id: grantId,
      void_credit_purchase_invoice: true,
    });

    return this.getCustomerInvoice(customerId, grant.invoice_id);
  }

  async listPlanCharges(plan_id: string, { limit, next_page }: PaginationDto = { limit: 10, next_page: null }) {
    return this.metronome.plans.listCharges(plan_id, {
      limit,
      next_page,
    });
  }

  async listCustomerBillableMetrics(customerId: string) {
    return this.metronome.customers.listBillableMetrics(customerId, {
      on_current_plan: true,
    });
  }

  async ingestEvent(customerId: string, { eventType, properties }: EventDto) {
    const [activePlan] = await this.listCustomerPlans(customerId, { limit: 1 });

    const [{ data: planCharges }, { data: billableMetrics }, { data: credits }] = await Promise.all([
      this.listPlanCharges(activePlan.plan_id),
      this.listCustomerBillableMetrics(customerId),
      this.getCustomerCreditsTotal(customerId),
    ]);

    const metric = billableMetrics.find((metric) =>
      metric.event_type_filter.in_values.find((eventValue) => eventValue === eventType),
    );
    if (!metric) {
      throw new Metronome.APIError(400, undefined, 'Invalid event type', undefined);
    }

    const charge = planCharges.find((charge) => charge.name === metric.name);
    if (!charge) {
      throw new Metronome.APIError(400, undefined, 'Invalid event type', undefined);
    }

    if (charge.prices[0].value > credits.available) {
      throw new Metronome.APIError(400, undefined, 'Insufficient credits', undefined);
    }

    return this.metronome.usage.ingest([
      {
        transaction_id: uuid(),
        timestamp: new Date().toISOString(),
        customer_id: customerId,
        event_type: eventType,
        properties,
      },
    ]);
  }

  async listCustomerInvoices(customerId: string, queryParams: { [key: string]: string | number | boolean } = {}) {
    const invoices = await this.metronome.customers.invoices.list(customerId, {
      ...queryParams,
      sort: 'date_desc',
      status: 'FINALIZED',
    });

    return {
      data: invoices.data,
      next_page: invoices.next_page,
    };
  }

  async getCustomerInvoice(customerId: string, invoiceId: string) {
    return this.metronome.customers.invoices.retrieve(customerId, invoiceId);
  }

  async getCustomerCreditsTotal(customerId: string): Promise<{
    data: { pending: number; available: number; consumed: number; total: number };
  }> {
    const credits = {
      pending: 0,
      available: 0,
      consumed: 0,
      total: 0,
    };

    const { data: ledgers } = await this.listCustomerCreditLedgers(customerId);

    if (!ledgers) {
      return { data: credits };
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

    return { data: credits };
  }
}
