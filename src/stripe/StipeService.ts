import Stripe from 'stripe';
import { v4 as uuid } from 'uuid';

export class StripeService {
  private readonly stripe: Stripe;

  constructor() {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error('Missing Stripe secret key');
    }

    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

    // this.sendToStripe('cus_QYcq5nr3HHSrey', '8ff9a5cd-1442-4975-8b00-edcd81bb48ac');
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

  async findCustomerByEmail(email: string): Promise<Stripe.Customer | null> {
    const customer = await this.stripe.customers.search({
      query: `email:"${email}"`,
    });

    return customer.data[0] || null;
  }

  async createCustomer(email: string, name: string): Promise<Stripe.Customer> {
    const customer = await this.findCustomerByEmail(email);

    if (!customer) {
      return this.stripe.customers.create({
        email,
        name,
      });
    }

    return customer;
  }

  async listCustomerCards(customerId: string): Promise<Stripe.PaymentMethod[]> {
    const response = await this.stripe.paymentMethods.list({
      customer: customerId,
      type: 'card',
    });

    return response.data;
  }

  async removeCustomerCard(cardId: string): Promise<Stripe.Response<Stripe.PaymentMethod>> {
    return this.stripe.paymentMethods.detach(cardId);
  }

  async setDefaultCustomerCard(customerId: string, cardId: string): Promise<Stripe.Customer> {
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
    return this.stripe.refunds.create({
      charge: chargeId,
    });
  }

  async voidOrRefundInvoice(invoiceId: string): Promise<Stripe.Refund | Stripe.Invoice> {
    const invoice = await this.retrieveInvoice(invoiceId);

    if (invoice.status === 'paid') {
      return this.refundInvoice(invoice.charge.toString());
    }

    return this.voidInvoice(invoiceId);
  }

  async createInvoice(customerId: string, metronomeId: string) {
    return this.stripe.invoices.create({
      customer: customerId,
      auto_advance: false,
      metadata: {
        metronome_id: metronomeId,
        metronome_client_id: 'f21094c8-99cb-4b68-8fd6-335c53ac39f0',
        metronome_environment: process.env.METRONOME_ENVIRONMENT,
      },
    });
  }

  async finalizeInvoice(invoiceId: string) {
    return this.stripe.invoices.finalizeInvoice(invoiceId, {
      auto_advance: true,
    });
  }

  async sendToStripe(custId: string, metId: string) {
    const invoice = await this.createInvoice(custId, metId);

    console.log(invoice);

    const finalizedInvoice = await this.finalizeInvoice(invoice.id);

    console.log(finalizedInvoice);
  }
}
