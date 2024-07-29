import express, { urlencoded, Response } from 'express';
import dotenv from 'dotenv';
import { StripeService } from './stripe/StipeService';
import { errorHandler, asyncHandler } from './errorHandler';
import { MetronomeService } from './metronome/MetronomeService';

dotenv.config({ path: './.env' });

const app = express();

const stripeService = new StripeService();
const metronomeService = new MetronomeService();

app.use(express.json());
app.use(urlencoded({ extended: true }));

app.get('/', async (_, res: Response) => {
  res.send('🤞');
});

app.get(
  '/plans',
  asyncHandler(async (req, res) => {
    const plans = await metronomeService.listPlans(req.query);

    return res.json(plans);
  }),
);

app.post(
  '/customers',
  asyncHandler(async (req, res) => {
    const { email, name, externalId } = req.body;

    const { id: stripeId } = await stripeService.createCustomer(email, name);

    const customer = await metronomeService.createCustomer({ email, name, stripeId, externalId });

    return res.json(customer);
  }),
);

app.get(
  '/customers/:customerId',
  asyncHandler(async (req, res) => {
    const { customerId } = req.params;

    const customer = await metronomeService.findCustomer(customerId);

    return res.json(customer);
  }),
);

app.get(
  '/customers',
  asyncHandler(async (req, res) => {
    const { ingestAlias } = req.query as { ingestAlias: string };

    const customer = await metronomeService.findCustomerByIngestAlias(ingestAlias);

    return res.json(customer);
  }),
);

app.post(
  '/customers/:customerId/plans',
  asyncHandler(async (req, res) => {
    const { customerId } = req.params;
    const { planId } = req.body;

    const customer = await metronomeService.addCustomerToPlan(customerId, planId);

    return res.json(customer);
  }),
);

app.get(
  '/customers/:customerId/plans',
  asyncHandler(async (req, res) => {
    const { customerId } = req.params;

    const plans = await metronomeService.listCustomerPlans(customerId, req.query);

    return res.json(plans);
  }),
);

app.post(
  '/customers/:customerId/plans/:customerPlanId/end',
  asyncHandler(async (req, res) => {
    const { customerId, customerPlanId } = req.params;

    const customer = await metronomeService.endCustomerPlan(customerId, customerPlanId);

    return res.json(customer);
  }),
);

app.post(
  '/customers/:customerId/ingest',
  asyncHandler(async (req, res) => {
    const { customerId } = req.params;
    const event = await metronomeService.ingestEvent(customerId, req.body);

    return res.json(event);
  }),
);

app.get(
  '/customers/:customerId/cards',
  asyncHandler(async (req, res) => {
    const { customerId } = req.params;

    const cards = await stripeService.listCustomerCards(customerId);

    return res.json(cards);
  }),
);

app.post(
  '/customers/:customerId/credits',
  asyncHandler(async (req, res) => {
    const { creditId } = req.body;
    const { customerId } = req.params;

    const credit = await metronomeService.createCreditGrant(customerId, creditId);

    return res.json(credit);
  }),
);

app.post(
  '/customers/:customerId/credits/void',
  asyncHandler(async (req, res) => {
    const { customerId } = req.params;
    const { grantId } = req.body;

    const { data: invoice } = await metronomeService.voidCreditGrant(customerId, grantId);
    await stripeService.voidOrRefundInvoice(invoice.external_invoice.invoice_id);

    return res.json(invoice);
  }),
);

app.get(
  '/customers/:customerId/credits',
  asyncHandler(async (req, res) => {
    const { customerId } = req.params;

    const credits = await metronomeService.getCustomerCreditsTotal(customerId);

    return res.json(credits);
  }),
);

app.get(
  '/customers/:customerId/credits/ledgers',
  asyncHandler(async (req, res) => {
    const { customerId } = req.params;

    const credits = await metronomeService.listCustomerCreditLedgers(customerId);

    return res.json(credits);
  }),
);

app.get(
  '/customers/:customerId/credits/grants',
  asyncHandler(async (req, res) => {
    const { customerId } = req.params;

    const credits = await metronomeService.listCustomerCreditGrants(customerId, req.query);

    return res.json(credits);
  }),
);

app.get(
  '/customers/:customerId/invoices',
  asyncHandler(async (req, res) => {
    const { customerId } = req.params;
    const reqQuery = req.query as { [key: string]: string };

    const invoices = await metronomeService.listCustomerInvoices(customerId, reqQuery);

    return res.json(invoices);
  }),
);

app.get(
  '/customers/:customerId/invoices/:invoiceId',
  asyncHandler(async (req, res) => {
    const { customerId, invoiceId } = req.params;

    const invoices = await metronomeService.getCustomerInvoice(customerId, invoiceId);

    return res.json(invoices);
  }),
);

app.post(
  '/customers/:customerId/invoices/charge',
  asyncHandler(async (req, res) => {
    const { invoiceId, paymentId } = req.body;

    const invoices = await stripeService.chargeInvoice(invoiceId, paymentId);

    return res.json(invoices);
  }),
);

// @ts-expect-error
app.use(errorHandler);

app.listen(3000, () => console.log(`Node server listening on http://localhost:${3000}`));
