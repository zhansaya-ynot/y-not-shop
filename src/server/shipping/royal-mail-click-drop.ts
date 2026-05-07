import type { CreateShipmentInput } from './provider';

const RM_BASE = 'https://api.parcel.royalmail.com/api/v1';

const WAREHOUSE = {
  fullName: 'YNOT London Despatch',
  companyName: 'YNOT London',
  addressLine1: '13 Elvaston Place',
  addressLine2: 'Flat 1',
  city: 'London',
  postcode: 'SW7 5QG',
  countryCode: 'GB',
  email: 'hello@ynotlondon.com',
  phone: '+44 20 0000 0000',
} as const;

/** Royal Mail Tracked 48 (outbound parcel). Click & Drop service code per
 *  the published integration list (TPN/TPN48 both rejected with "Service
 *  code could not be found or it's not supported"). */
const SERVICE_CODE_TRACKED_48 = 'TRN48';
/** Royal Mail Tracked Returns 48. Speculative — if rejected the operator's
 *  Click & Drop account → Settings → Integrations exposes a "View service
 *  codes" panel with the canonical list for that subscription. */
const SERVICE_CODE_TRACKED_RETURNS = 'TRR48';

export interface RoyalMailClickDropConfig {
  apiKey: string;
  /** Override outbound service code — defaults to the constant above if
   *  unset. Wire from env.ROYAL_MAIL_SERVICE_CODE so the operator can
   *  swap codes per subscription without redeploying. */
  serviceCode?: string;
  /** Override returns service code — same reasoning. */
  returnsServiceCode?: string;
  fetcher?: typeof fetch;
}

export interface CreateRmShipmentResult {
  trackingNumber: string;
  rmOrderId: string;
}

export interface CreateReturnLabelResult {
  rmOrderId: string;
  labelPdfBytes: Buffer;
}

interface RmCreatedOrder {
  orderIdentifier?: number | string;
  orderReference?: string;
  trackingNumber?: string;
}

interface RmFailedOrderError {
  errorCode?: string;
  errorMessage?: string;
  /** Click & Drop sometimes also embeds the offending field/value pair. */
  fields?: unknown;
}
interface RmFailedOrder {
  orderReference?: string;
  errors?: RmFailedOrderError[];
}
interface RmCreateOrdersResponse {
  createdOrders?: RmCreatedOrder[];
  failedOrders?: RmFailedOrder[];
  errorsCount?: number;
  successCount?: number;
}

/** Flatten Click & Drop's failedOrders payload into a single human message. */
function summariseRmFailures(failures: RmFailedOrder[] | undefined): string {
  if (!failures?.length) return 'no createdOrders and no failedOrders payload';
  return failures
    .map((f) => {
      const ref = f.orderReference ? `${f.orderReference}: ` : '';
      const errs = (f.errors ?? [])
        .map((e) => [e.errorCode, e.errorMessage].filter(Boolean).join(' '))
        .filter((s) => s.length > 0)
        .join('; ');
      return `${ref}${errs || 'no error detail'}`;
    })
    .join(' | ');
}

/**
 * Royal Mail Click & Drop API client.
 *
 * Used at fulfilment time to create outbound UK shipments (Tracked 48) and
 * return labels (Tracked Returns). UK rates remain a static £0 quote at
 * checkout — see {@link RoyalMailFreeProvider}.
 *
 * Tests inject `cfg.fetcher`; production passes nothing and the global
 * `fetch` is used.
 */
export class RoyalMailClickDropProvider {
  private readonly fetcher: typeof fetch;

  constructor(private readonly cfg: RoyalMailClickDropConfig) {
    this.fetcher = cfg.fetcher ?? fetch;
  }

  private headers(json = true): HeadersInit {
    const h: Record<string, string> = {
      // Click & Drop accepts `Bearer <key>` — confirmed against the live API
      // (the alternative `ApiKey <key>` scheme returns HTTP 401). When the
      // request is authenticated but the order payload fails validation,
      // the API still returns HTTP 200 with createdOrders=[] and the per-
      // item failure detail under failedOrders. summariseRmFailures (below)
      // surfaces those errors so the operator sees the real reason instead
      // of a generic 'no createdOrders' string.
      Authorization: `Bearer ${this.cfg.apiKey}`,
      Accept: 'application/json',
    };
    if (json) h['Content-Type'] = 'application/json';
    return h;
  }

  /** POST /orders with the customer as recipient (warehouse is implicit sender). */
  async createShipment(input: CreateShipmentInput): Promise<CreateRmShipmentResult> {
    const body = {
      items: [buildOrderPayload(input, this.cfg.serviceCode ?? SERVICE_CODE_TRACKED_48, input.recipient)],
    };

    const resp = await this.fetcher(`${RM_BASE}/orders`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(body),
    });
    if (!resp.ok) {
      const err = await resp.text();
      throw new Error(`Royal Mail createShipment ${resp.status}: ${err}`);
    }
    const data = (await resp.json()) as RmCreateOrdersResponse;
    const created = data.createdOrders?.[0];
    if (!created) {
      throw new Error(
        `Royal Mail createShipment returned no createdOrders — ${summariseRmFailures(data.failedOrders)}`,
      );
    }
    if (created.orderIdentifier === undefined) {
      throw new Error(
        `Royal Mail createShipment response missing orderIdentifier (raw: ${JSON.stringify(created).slice(0, 200)})`,
      );
    }
    // Click & Drop assigns the trackingNumber when the order is "manifested"
    // (label generated). The initial POST /orders response can come back with
    // trackingNumber=null and that's fine — we save the rmOrderId now and
    // fetch tracking later via GET /orders/<id> after the label is created.
    return {
      trackingNumber: created.trackingNumber ?? '',
      rmOrderId: String(created.orderIdentifier),
    };
  }

  /**
   * Create a return label: original Order's customer becomes the **sender**,
   * the YNOT London warehouse becomes the **recipient**, service code is
   * `TPS` (Tracked Returns). Returns the new rmOrderId + the PDF bytes
   * fetched via {@link getLabel}.
   */
  async createReturnLabel(input: CreateShipmentInput): Promise<CreateReturnLabelResult> {
    const body = {
      items: [
        buildOrderPayload(
          input,
          this.cfg.returnsServiceCode ?? SERVICE_CODE_TRACKED_RETURNS,
          // recipient = warehouse
          {
            fullName: WAREHOUSE.fullName,
            companyName: WAREHOUSE.companyName,
            addressLine1: WAREHOUSE.addressLine1,
            addressLine2: WAREHOUSE.addressLine2,
            city: WAREHOUSE.city,
            postalCode: WAREHOUSE.postcode,
            countryCode: WAREHOUSE.countryCode,
            email: WAREHOUSE.email,
            phone: WAREHOUSE.phone,
          },
          // sender = original recipient (the customer)
          input.recipient,
        ),
      ],
    };

    const resp = await this.fetcher(`${RM_BASE}/orders`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(body),
    });
    if (!resp.ok) {
      const err = await resp.text();
      throw new Error(`Royal Mail createShipment ${resp.status}: ${err}`);
    }
    const data = (await resp.json()) as RmCreateOrdersResponse;
    const created = data.createdOrders?.[0];
    if (!created || created.orderIdentifier === undefined) {
      throw new Error(
        `Royal Mail createReturnLabel returned no createdOrders — ${summariseRmFailures(data.failedOrders)}`,
      );
    }
    const rmOrderId = String(created.orderIdentifier);
    const labelPdfBytes = await this.getLabel(rmOrderId);
    return { rmOrderId, labelPdfBytes };
  }

  /** GET /orders/:id/label?documentType=postageLabel — binary PDF response.
   *  Click & Drop returns 400 'documentType parameter or property was not
   *  provided' if the query string is omitted; postageLabel is the shipping
   *  label, customsDeclaration is the CN23 (handled by our own renderer
   *  for international returns, so we never request it from RM here).
   *
   *  Throws {@link RoyalMailLabelApiUnavailableError} on HTTP 403 — basic
   *  Click & Drop tiers don't grant programmatic label access; the operator
   *  prints from the RM dashboard and uploads via Manual label override. */
  async getLabel(rmOrderId: string): Promise<Buffer> {
    const url = `${RM_BASE}/orders/${rmOrderId}/label?documentType=postageLabel&pageFormat=A4`;
    const resp = await this.fetcher(url, {
      method: 'GET',
      headers: { ...this.headers(false), Accept: 'application/pdf' },
    });
    if (resp.status === 403) {
      throw new RoyalMailLabelApiUnavailableError(rmOrderId);
    }
    if (!resp.ok) {
      const err = await resp.text();
      throw new Error(`Royal Mail getLabel ${resp.status}: ${err}`);
    }
    return Buffer.from(await resp.arrayBuffer());
  }
}

/** Thrown when GET /orders/:id/label returns 403 because the merchant's
 *  Click & Drop tier doesn't include programmatic label access. carrier.ts
 *  catches this specifically and surfaces a manual-print instruction to
 *  the operator, instead of bubbling a generic 403 retry loop. */
export class RoyalMailLabelApiUnavailableError extends Error {
  constructor(public readonly rmOrderId: string) {
    super(
      `Royal Mail label API not enabled on this tier. RM order ID: ${rmOrderId}. ` +
        'Print from https://business.parcel.royalmail.com → Orders, then upload via Manual label override.',
    );
    this.name = 'RoyalMailLabelApiUnavailableError';
  }
}

interface RecipientLike {
  fullName: string;
  companyName?: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  postalCode: string;
  countryCode: string;
  email?: string;
  phone?: string;
}

function partyToRm(party: RecipientLike): Record<string, unknown> {
  return {
    address: {
      fullName: party.fullName,
      companyName: party.companyName ?? party.fullName,
      addressLine1: party.addressLine1,
      ...(party.addressLine2 ? { addressLine2: party.addressLine2 } : {}),
      city: party.city,
      postcode: party.postalCode,
      countryCode: party.countryCode,
    },
    ...(party.phone ? { phoneNumber: party.phone } : {}),
    ...(party.email ? { emailAddress: party.email } : {}),
  };
}

function buildOrderPayload(
  input: CreateShipmentInput,
  serviceCode: string,
  recipient: RecipientLike,
  sender?: RecipientLike,
): Record<string, unknown> {
  return {
    orderReference: input.orderRef,
    recipient: partyToRm(recipient),
    ...(sender ? { sender: partyToRm(sender) } : {}),
    billing: partyToRm(recipient),
    packages: [
      {
        weightInGrams: input.weightGrams,
        packageFormatIdentifier: 'smallParcel',
      },
    ],
    orderDate: new Date().toISOString(),
    subtotal: input.subtotalCents / 100,
    shippingCostCharged: 0,
    total: input.subtotalCents / 100,
    currencyCode: 'GBP',
    postageDetails: { serviceCode },
    orderLines: input.items.map((i) => ({
      name: i.name,
      SKU: i.sku,
      quantity: i.quantity,
      unitValue: i.unitPriceCents / 100,
      unitWeightInGrams: i.weightGrams,
      ...(i.countryOfOriginCode ? { customsOriginCountry: i.countryOfOriginCode } : {}),
      ...(i.hsCode ? { customsCode: i.hsCode } : {}),
    })),
  };
}

// Internal helpers re-exported for the return-label path.
export const __internal = {
  WAREHOUSE,
  SERVICE_CODE_TRACKED_48,
  SERVICE_CODE_TRACKED_RETURNS,
  RM_BASE,
  buildOrderPayload,
  partyToRm,
};
