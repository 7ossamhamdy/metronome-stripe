import Stripe from 'stripe';

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
}
