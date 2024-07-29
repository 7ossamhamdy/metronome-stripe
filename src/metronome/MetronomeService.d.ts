export interface MetronomeResponse<T = Record<string, any>> {
  data: T;
}
export interface MetronomeListResponse<T = Record<string, any>> {
  data: T[];
  next_page: string | null;
}

export type BillingProviderType =
  | 'aws_marketplace'
  | 'stripe'
  | 'netsuite'
  | 'custom'
  | 'azure_marketplace'
  | 'quickbooks_online'
  | 'workday'
  | 'gcp_marketplace';
export type StripeCollectionMethod = 'charge_automatically' | 'send_invoice';

export type ExternalInvoiceStatus =
  | 'DRAFT'
  | 'FINALIZED'
  | 'PAID'
  | 'UNCOLLECTIBLE'
  | 'VOID'
  | 'DELETED'
  | 'PAYMENT_FAILED'
  | 'INVALID_REQUEST_ERROR'
  | 'SKIPPED'
  | 'SENT'
  | 'QUEUED';

export type InvoiceBillableStatus = 'billable' | 'unbillable';

export type Customer = {
  id: string;
  external_id: string;
  ingest_aliases: string[]; // (deprecated, use ingest_aliases instead)
  name: string;
  customer_config: {
    salesforce_account_id: string | null;
  };
  custom_fields: Record<string, string>;
  current_billable_status: {
    value: InvoiceBillableStatus;
    effective_at: string; // RFC 3339 timestamp
  };
};

export type BillableMetic = {
  // (DEPRECATED) use group_keys instead
  group_by: string[];

  // Property names that are used to group usage costs on an invoice. Each
  // entry represents a set of properties used to slice events into
  // distinct buckets.
  group_keys: string[][];

  name: string; // (required)

  id: string; // (required)

  // (DEPRECATED) use aggregation_type instead
  aggregate: string;

  // (DEPRECATED) use aggregation_key instead
  aggregate_keys: string[];

  // (DEPRECATED) use property_filters & event_type_filter instead
  filter: {
    string: any;
  };

  // Specifies the type of aggregation performed on matching events.
  aggregation_type: 'count' | 'latest' | 'max' | 'sum' | 'unique';

  // A key that specifies which property of the event is used to aggregate
  // data. This key must be one of the property filter names and is not
  // applicable when the aggregation type is 'count'.
  aggregation_key: string;

  // An optional filtering rule to match the 'event_type' property of an
  // event.
  event_type_filter: {
    // A list of event types that are explicitly included in the billable
    // metric. If specified, only events of these types will match the
    // billable metric. Must be non-empty if present.
    in_values: string[];

    // A list of event types that are explicitly excluded from the billable
    // metric. If specified, events of these types will not match the
    // billable metric. Must be non-empty if present.
    not_in_values: string[];
  };

  // A list of filters to match events to this billable metric. Each filter
  // defines a rule on an event property. All rules must pass for the event
  // to match the billable metric.
  property_filters: [
    {
      // The name of the event property.
      name: string; // (required)

      // Determines whether the property must exist in the event. If true,
      // only events with this property will pass the filter. If false,
      // only events without this property will pass the filter. If null or
      // omitted, the existence of the property is optional.
      exists: boolean;

      // Specifies the allowed values for the property to match an event.
      // An event will pass the filter only if its property value is
      // included in this list. If undefined, all property values will pass
      // the filter. Must be non-empty if present.
      in_values: string[];

      // Specifies the values that prevent an event from matching the
      // filter. An event will not pass the filter if its property value is
      // included in this list. If null or empty, all property values will
      // pass the filter. Must be non-empty if present.
      not_in_values: string[];
    },
  ];

  custom_fields: {
    string: string;
  };
};

export type Invoice = {
  id: string;
  start_timestamp: string; // RFC 3339 timestamp
  end_timestamp: string; // RFC 3339 timestamp
  customer_id: string;
  customer_custom_fields: Record<string, string>;
  type: string;
  credit_type: {
    id: string;
    name: string; // 'USD (cents)'
  };
  status: 'VOID' | 'ISSUED' | 'DRAFT' | 'FINALIZED';
  total: number;
  subtotal: number;
  external_invoice: {
    invoice_id: string;
    issued_at_timestamp: string; // RFC 3339 timestamp
    billing_provider_type: BillingProviderType;
    external_status: ExternalInvoiceStatus;
  } | null;
  line_items: Record<string, any>[];
  invoice_adjustments: Record<string, any>[];
  custom_fields: Record<string, string>;
  billable_status: InvoiceBillableStatus;
};

export type LedgerEntry = {
  credit_type: {
    // (required)
    name: string; // (required)

    id: string; // (required)
  };

  starting_balance: {
    // (required)
    // the starting balance, including all posted grants, deductions,
    // and expirations that happened at or before the effective_at
    // timestamp
    excluding_pending: number; // (required)

    // the excluding_pending balance plus any pending activity that has
    // not been posted at the time of the query
    including_pending: number; // (required)

    // the starting_on request parameter (if supplied) or the first
    // credit grant's effective_at date
    effective_at: string; // (required) RFC 3339
  };

  // the effective balances at the end of the specified time window
  ending_balance: {
    // (required)
    // the ending balance, including the balance of all grants that
    // have not expired before the effective_at date and deductions
    // that happened before the effective_at date
    excluding_pending: number; // (required)

    // the excluding_pending balance plus any pending invoice
    // deductions and expirations that will happen by the effective_at
    // date
    including_pending: number; // (required)

    // the ending_before request parameter (if supplied) or the current
    // billing period's end date
    effective_at: string; // (required) RFC 3339
  };

  // (required)
  entries: {
    // an amount representing the change to the customer's credit
    // balance
    amount: number; // (required)

    reason: string; // (required)

    // the running balance for this credit type at the time of the
    // ledger entry, including all preceding charges
    running_balance: number; // (required)

    effective_at: string; // (required) RFC 3339

    created_by: string; // (required)

    // the credit grant this entry is related to
    credit_grant_id: string; // (required)

    // if this entry is a deduction, the Metronome ID of the invoice
    // where the credit deduction was consumed; if this entry is a
    // grant, the Metronome ID of the invoice where the grant's
    // paid_amount was charged
    invoice_id: string | null;
  }[];

  // (required)
  pending_entries: {
    // an amount representing the change to the customer's credit
    // balance
    amount: number; // (required)

    reason: string; // (required)

    // the running balance for this credit type at the time of the
    // ledger entry, including all preceding charges
    running_balance: number; // (required)

    effective_at: string; // (required) RFC 3339

    created_by: string; // (required)

    // the credit grant this entry is related to
    credit_grant_id: string; // (required)

    // if this entry is a deduction, the Metronome ID of the invoice
    // where the credit deduction was consumed; if this entry is a
    // grant, the Metronome ID of the invoice where the grant's
    // paid_amount was charged
    invoice_id: string | null;
  }[];
};

export type GrantEntry = {
  // the Metronome ID of the credit grant
  id: string; // (required)

  name: string; // (required)

  // the Metronome ID of the customer
  customer_id: string; // (required)

  // the Metronome ID of the invoice with the purchase charge for this
  // credit grant, if applicable
  invoice_id: string | null;

  // Prevents the creation of duplicates. If a request to create a record
  // is made with a previously used uniqueness key, a new record will not
  // be created and the request will fail with a 409 error.
  uniqueness_key: string | null; // between 1 and 128 characters

  reason: string | null;

  credit_grant_type: string | null;

  effective_at: string; // (required) RFC 3339

  expires_at: string; // (required) RFC 3339

  priority: number; // (required)

  // the amount of credits initially granted
  grant_amount: {
    // (required)
    amount: number; // (required)

    // the credit type for the amount granted
    credit_type: {
      // (required)
      name: string; // (required)

      id: string; // (required)
    };
  };

  // the amount paid for this credit grant
  paid_amount: {
    // (required)
    amount: number; // (required)

    // the credit type for the amount paid
    credit_type: {
      // (required)
      name: string; // (required)

      id: string; // (required)
    };
  };

  // The effective balance of the grant as of the end of the customer's
  // current billing period. Expiration deductions will be included only if
  // the grant expires before the end of the current billing period.
  // (required)
  balance: {
    // The grant's current balance including all posted deductions. If the
    // grant has expired, this amount will be 0.
    excluding_pending: number; // (required)

    // The grant's current balance including all posted and pending
    // deductions. If the grant expires before the end of the customer's
    // current billing period, this amount will be 0.
    including_pending: number; // (required)

    // The end_date of the customer's current billing period.
    effective_at: string; // (required) RFC 3339
  };

  // (required)
  deductions: {
    // an amount representing the change to the customer's credit balance
    amount: number; // (required)

    reason: string; // (required)

    // the running balance for this credit type at the time of the ledger
    // entry, including all preceding charges
    running_balance: number; // (required)

    effective_at: string; // (required) RFC 3339

    created_by: string; // (required)

    // the credit grant this entry is related to
    credit_grant_id: string; // (required)

    // if this entry is a deduction, the Metronome ID of the invoice
    // where the credit deduction was consumed; if this entry is a grant,
    // the Metronome ID of the invoice where the grant's paid_amount was
    // charged
    invoice_id: string | null;
  }[];

  // (required)
  pending_deductions: {
    // an amount representing the change to the customer's credit balance
    amount: number; // (required)

    reason: string; // (required)

    // the running balance for this credit type at the time of the ledger
    // entry, including all preceding charges
    running_balance: number; // (required)

    effective_at: string; // (required) RFC 3339

    created_by: string; // (required)

    // the credit grant this entry is related to
    credit_grant_id: string; // (required)

    // if this entry is a deduction, the Metronome ID of the invoice
    // where the credit deduction was consumed; if this entry is a grant,
    // the Metronome ID of the invoice where the grant's paid_amount was
    // charged
    invoice_id: string | null;
  }[];

  // The products which these credits will be applied to. (If unspecified,
  // the credits will be applied to charges for all products.)
  products?: {
    id: string; // (required)
    name: string; // (required)
  }[];

  custom_fields: Record<string, string>;
};

export type CreateCustomerRequest = {
  name: string;
  ingest_aliases?: string[];
  billing_config?: {
    billing_provider_customer_id: string;
    billing_provider_type: BillingProviderType;
    stripe_collection_method: StripeCollectionMethod;
  };
  custom_fields?: Record<string, string>;
};
export type CreateCustomerResponse = MetronomeResponse<
  Pick<Customer, 'id' | 'name' | 'external_id' | 'ingest_aliases' | 'custom_fields'>
>;

export type GetCustomerResponse = MetronomeResponse<Customer>;

export type ListCustomersResponse = MetronomeListResponse<Customer>;

export type ListCustomerBillableMetricsResponse = MetronomeListResponse<BillableMetic>;

export type GetInvoiceResponse = MetronomeResponse<Invoice>;

export type ListInvoicesResponse = MetronomeListResponse<Invoice>;

export type GetLedgersResponse = MetronomeResponse<LedgerEntry | null>;

export type GetGrantsResponse = MetronomeResponse<GrantEntry>;
