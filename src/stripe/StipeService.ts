import Stripe from 'stripe';
import { v4 as uuid } from 'uuid';

export class StripeService {
  private readonly stripe: Stripe;

  constructor() {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error('Missing Stripe secret key');
    }

    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  }

  async createCustomer(email: string, name: string): Promise<Stripe.Customer> {
    const customer = await this.findCustomerByEmail(email);

    if (!customer) {
      return this.stripe.customers.create({ email, name });
    }

    return customer;
  }

  async findCustomerByEmail(email: string): Promise<Stripe.Customer | null> {
    const { data } = await this.stripe.customers.list({ email, limit: 1 });

    return data[0] || null;
  }

  async retrieveCustomer(customerId: string): Promise<Stripe.Customer> {
    const customer = await this.stripe.customers.retrieve(customerId);

    if (customer.deleted) {
      throw new Stripe.errors.StripeError({
        type: 'api_error',
        statusCode: 404,
        message: 'Customer is deleted',
      });
    }

    return customer as Stripe.Customer;
  }

  async listCustomerCards(customerId: string): Promise<Stripe.PaymentMethod[]> {
    const response = await this.stripe.paymentMethods.list({ customer: customerId, type: 'card' });

    return response.data;
  }

  async removeCard(cardId: string): Promise<Stripe.Response<Stripe.PaymentMethod>> {
    return this.stripe.paymentMethods.detach(cardId);
  }

  async updateDefaultCard(customerId: string, cardId: string): Promise<Stripe.Customer> {
    return this.stripe.customers.update(customerId, {
      invoice_settings: {
        default_payment_method: cardId,
      },
    });
  }

  async retrieveInvoice(invoiceId: string): Promise<Stripe.Invoice> {
    return this.stripe.invoices.retrieve(invoiceId);
  }

  async chargeInvoice(invoiceId: string, paymentId: string): Promise<Stripe.Invoice> {
    return this.stripe.invoices.pay(invoiceId, {
      payment_method: paymentId,
    });
  }

  async voidInvoice(invoiceId: string): Promise<Stripe.Invoice> {
    return this.stripe.invoices.voidInvoice(invoiceId);
  }

  async refundInvoice(chargeId: string): Promise<Stripe.Refund> {
    return this.stripe.refunds.create({ charge: chargeId });
  }

  async voidOrRefundInvoice(invoiceId: string): Promise<Stripe.Refund | Stripe.Invoice> {
    const invoice = await this.retrieveInvoice(invoiceId);

    if (invoice.status === 'paid') {
      return this.refundInvoice(invoice.charge.toString());
    }

    return this.voidInvoice(invoiceId);
  }

  async createInvoice() {
    // Create an invoice item first
    await this.stripe.invoiceItems.create({
      description: 'Atomica Credit credit purchase - 100 Credits',
      quantity: 100,
      metadata: {
        metronome_id: uuid(),
      },
      period: {
        start: Date.now(),
        end: Date.now(),
      },
      currency: 'usd',
      customer: 'cus_QYcq5nr3HHSrey', // Customer ID
      unit_amount_decimal: '100',
    });

    // Create an invoice with the pending invoice item
    const invoice = await this.stripe.invoices.create({
      customer: 'cus_QYcq5nr3HHSrey',
      collection_method: 'charge_automatically',
      pending_invoice_items_behavior: 'include', // includes pending invoice items in the invoice (from the previous step)
      currency: 'usd',
      auto_advance: false,
      automatic_tax: {
        enabled: false,
      },

      // Metronome adds metadata to the invoice to track the invoice in Metronome
      // metadata: {
      //   metronome_client_id: 'f21094c8-99cb-4b68-8fd6-335c53ac39f0',
      //   metronome_environment: 'SANDBOX',
      //   metronome_id: 'c67a2db9-4118-40c0-a934-172ec5cad875', // Metronome Invoice ID
      // },
    });

    // Finalize invoice:
    // 1. will change invoice status from `draft` to `open` and creates a payment intent (link to pay the invoice)
    // 2. charges the invoice if the invoice is set to `charge_automatically` with the default payment method
    //    (not immediately = smart retries), if the invoice is set to `send_invoice` the invoice will be sent to the customer
    await this.stripe.invoices.finalizeInvoice(invoice.id, {
      auto_advance: true,
    });

    // Charge this invoice immediately with throw if payment failed (e.g. insufficient funds, card declined, etc.)
    return this.stripe.invoices.pay(invoice.id, {
      payment_method: 'pm_1PiAIU2LWWEotPms8akQd1KF', // Payment Method ID
    });
  }
}
