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

export type BillableStatus = 'billable' | 'unbillable';

export type ResellerType = 'AWS' | 'AWS_PRO_SERVICE' | 'GCP' | 'GCP_PRO_SERVICE';

export type ChargeType = 'usage' | 'fixed' | 'composite' | 'minimum' | 'seat';

export type RoundingBehavior = 'floor' | 'ceiling';

export type CustomFields = { [key: string]: string };

export type Customer = {
  // the Metronome ID of the customer
  id: string; // (required)

  // (deprecated, use ingest_aliases instead) the first ID (Metronome or
  // ingest alias) that can be used in usage events
  external_id: string; // (required)

  // aliases for this customer that can be used instead of the Metronome
  // customer ID in usage events
  ingest_aliases: [string]; // (required)

  name: string; // (required)

  // (required)
  customer_config: {
    // The Salesforce account ID for the customer
    salesforce_account_id: string | null; // (required)
  };

  // (required)
  custom_fields: CustomFields;

  // (required)
  current_billable_status: {
    value: BillableStatus; // (required) "billable" or "unbillable"

    effective_at: string; // RFC 3339
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

  custom_fields: CustomFields;
};

export type Invoice = {
  id: string; // (required)

  customer_id: string; // (required)

  customer_custom_fields: CustomFields;

  // This field's availability is dependent on your client's configuration.
  netsuite_sales_order_id: string;

  // This field's availability is dependent on your client's configuration.
  salesforce_opportunity_id: string;

  net_payment_terms_days: number;

  // (required)
  credit_type: {
    name: string; // (required)

    id: string; // (required)
  };

  invoice_adjustments: {
    name: string; // (required)

    total: number; // (required)

    // (required)
    credit_type: {
      name: string; // (required)

      id: string; // (required)
    };

    credit_grant_id: string;

    credit_grant_custom_fields: CustomFields;
  }[];

  // (required)
  line_items: {
    name: string; // (required)

    group_key: string;

    group_value: string | null;

    quantity: number;

    total: number; // (required)

    // only present for beta contract invoices
    unit_price: number;

    product_id: string;

    product_custom_fields: CustomFields;

    product_type: string;

    // only present for beta contract invoices. This field's availability
    // is dependent on your client's configuration.
    netsuite_item_id: string;

    // only present for beta contract invoices
    is_prorated: boolean;

    // (required)
    credit_type: {
      name: string; // (required)

      id: string; // (required)
    };

    // only present for beta contract invoices
    starting_at: string; // RFC 3339

    // only present for beta contract invoices
    ending_before: string; // RFC 3339

    // only present for beta contract invoices
    commit_id: string;

    commit_custom_fields: CustomFields;

    // only present for beta contract invoices
    commit_segment_id: string;

    // only present for beta contract invoices
    commit_type: string;

    // only present for beta contract invoices. This field's availability
    // is dependent on your client's configuration.
    commit_netsuite_sales_order_id: string;

    // only present for beta contract invoices. This field's availability
    // is dependent on your client's configuration.
    commit_netsuite_item_id: string;

    // only present for beta contract invoices
    postpaid_commit: {
      id: string; // (required)
    };

    reseller_type: ResellerType;

    sub_line_items: [
      {
        name: string; // (required)

        // the unit price for this charge, present only if the charge is
        // not tiered and the quantity is nonzero
        price: number;

        quantity: number; // (required)

        subtotal: number; // (required)

        charge_id: string;

        credit_grant_id: string;

        // when the current tier started and ends (for tiered charges only)
        tier_period: {
          starting_at: string; // (required) RFC 3339

          ending_before: string; // RFC 3339
        };

        tiers: {
          // at what metric amount this tier begins
          starting_at: number; // (required)

          quantity: number; // (required)

          price: number; // (required)

          subtotal: number; // (required)
        }[];

        custom_fields: CustomFields;

        // The start date for the charge (for seats charges only).
        start_date: string; // RFC 3339

        // The end date for the charge (for seats charges only).
        end_date: string; // RFC 3339
      },
    ];

    custom_fields: CustomFields;

    // if pricing groups are used, this will contain the values used to
    // calculate the price
    pricing_group_values: {
      string: string;
    };

    // if presentation groups are used, this will contain the values used
    // to break down the line item
    presentation_group_values: {
      string: string | null;
    };

    metadata: string;

    // The start date for the billing period on the invoice.
    netsuite_invoice_billing_start: string; // RFC 3339

    // The end date for the billing period on the invoice.
    netsuite_invoice_billing_end: string; // RFC 3339

    // only present for beta contract invoices
    professional_service_id: string;

    professional_service_custom_fields: CustomFields;
    // only present for beta contract invoices
    scheduled_charge_id: string;

    scheduled_charge_custom_fields: CustomFields;
  }[];

  // Beginning of the usage period this invoice covers (UTC)
  start_timestamp: string; // RFC 3339

  // End of the usage period this invoice covers (UTC)
  end_timestamp: string; // RFC 3339

  // When the invoice was issued (UTC)
  issued_at: string; // RFC 3339

  // When the invoice was created (UTC). This field is present for correction
  // invoices only.
  created_at: string; // RFC 3339

  status: string; // (required)

  subtotal: number;

  total: number; // (required)

  type: string; // (required)

  external_invoice: {
    billing_provider_type: BillingProviderType;

    invoice_id: string;

    issued_at_timestamp: string; // RFC 3339

    external_status: ExternalInvoiceStatus;
  };

  plan_id: string;

  plan_name: string;

  plan_custom_fields: CustomFields;

  contract_id: string;

  contract_custom_fields: CustomFields;

  amendment_id: string;

  correction_record: {
    reason: string; // (required)

    memo: string; // (required)

    corrected_invoice_id: string; // (required)

    corrected_external_invoice: {
      billing_provider_type: BillingProviderType;

      invoice_id: string;

      issued_at_timestamp: string; // RFC 3339

      external_status: ExternalInvoiceStatus;
    };
  };

  // only present for beta contract invoices with reseller royalties
  reseller_royalty: {
    reseller_type: ResellerType; // (required)

    netsuite_reseller_id: string; // (required)

    fraction: string; // (required)

    aws_options: {
      aws_account_number: string;

      aws_payer_reference_id: string;

      aws_offer_id: string;
    };

    gcp_options: {
      gcp_account_id: string;

      gcp_offer_id: string;
    };
  };

  custom_fields: CustomFields;

  billable_status: BillableStatus;
};

export type CustomerPlan = {
  // the ID of the customer plan
  id: string; // (required)

  // the ID of the plan
  plan_id: string; // (required)

  plan_name: string; // (required)

  plan_description: string; // (required)

  starting_on: string; // (required) RFC 3339

  ending_before: string; // RFC 3339

  net_payment_terms_days: number;

  trial_info: {
    ending_before: string; // (required) RFC 3339

    // (required)
    spending_caps: {
      // (required)
      credit_type: {
        name: string; // (required)

        id: string; // (required)
      };

      amount: number; // (required)

      amount_remaining: number; // (required)
    }[];
  };

  custom_fields: CustomFields;
};

export type PlanCharge = {
  id: string; // (required)

  name: string; // (required)

  charge_type: ChargeType; // (required)

  product_id: string; // (required)

  product_name: string; // (required)

  quantity: number;

  // Used in price ramps.  Indicates how many billing periods pass before
  // the charge applies.
  start_period: number;

  // Used in pricing tiers.  Indicates how often the tier resets. Default
  // is 1 - the tier count resets every billing period.
  tier_reset_frequency: number;

  // (required)
  credit_type: {
    name: string; // (required)

    id: string; // (required)
  };

  // Specifies how quantities for usage based charges will be converted.
  unit_conversion: {
    // The conversion factor
    division_factor: number; // (required)

    // Whether usage should be rounded down or up to the nearest whole
    // number. If null, quantity will be rounded to 20 decimal places.
    rounding_behavior: RoundingBehavior;
  };

  // (required)
  prices: {
    value: number; // (required)

    // Used in pricing tiers.  Indicates at what metric value the price
    // applies.
    tier: number; // (required)

    quantity: number;

    collection_schedule: string;

    collection_interval: number;
  }[];

  // (required)
  custom_fields: CustomFields;
};

export type LedgerEntry = {
  credit_type: {
    // (required)
    name: string; // (required)

    id: string; // (required)
  };

  // (required)
  starting_balance: {
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
  // (required)
  ending_balance: {
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

export type CreditGrant = {
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

  custom_fields: CustomFields;
};

export interface MetronomeResponse<T = Record<string, any>> {
  data: T;
}
export interface MetronomeListResponse<T = Record<string, any>> {
  data: T[];
  next_page: string | null;
}

export type CreateCustomerRequest = {
  name: string;
  ingest_aliases?: string[];
  billing_config?: {
    billing_provider_customer_id: string;
    billing_provider_type: BillingProviderType;
    stripe_collection_method: StripeCollectionMethod;
  };
  custom_fields?: CustomFields;
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

export type GetGrantsResponse = MetronomeResponse<CreditGrant>;
