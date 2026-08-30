# SaaS Billing Metrics

## Scope

These metrics describe Blupo's internal subscription and billing records. Until an external payment/Pix provider is integrated, `paid` means an authorized platform operator recorded the payment; it is not independent proof of bank settlement.

All monetary values use integer BRL cents.

## Definitions

| Metric               | Definition                                                                                                                                      |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| MRR                  | Sum of `active` and `past_due` subscription prices normalized monthly; yearly prices are divided by 12 and rounded to cents.                    |
| ARR                  | Current MRR multiplied by 12.                                                                                                                   |
| Active tenants       | Tenants whose current lifecycle status is `active`.                                                                                             |
| Trialing tenants     | Distinct tenants with a `trialing` subscription.                                                                                                |
| New tenants          | Tenants created during the selected UTC period.                                                                                                 |
| Received             | Sum of `paid` payment records whose `paid_at` is inside the period.                                                                             |
| Outstanding          | Sum of collectible `open`/`overdue` invoice totals minus recorded paid amounts, never below zero.                                               |
| ARPA                 | MRR divided by active tenants; zero when there are no active tenants.                                                                           |
| Payment success rate | Paid attempts divided by paid plus failed attempts in the period, expressed as a percentage with two decimal places.                            |
| Churn rate           | Subscriptions canceled in the period divided by subscriptions active at the period start, expressed as a percentage with two decimal places.    |
| Subscription value   | Historical chart approximation using current subscription price snapshots for subscriptions created before each month and not canceled by then. |

## Periods

- `30d`: rolling 30 days.
- `90d`: rolling 90 days.
- `12m`: rolling 12 months.

Period boundaries are UTC and the response includes exact `from`/`to` timestamps.

## Integrity Rules

- Invoice totals equal subtotal minus discount plus tax.
- Invoice-item totals equal unit amount times quantity.
- Paid amounts cannot exceed invoice balance.
- A fully paid invoice transitions to `paid` in the same transaction as the completing payment.
- Financial records are not hard deleted through the API; corrections use void/refund/status history in future increments.
- Every mutation is idempotent, audited, and emits a transactional outbox record.

## Known Limitations

- No external settlement or reconciliation exists yet.
- Historical MRR uses current subscription snapshots; precise expansion/contraction history will require a subscription-change ledger/read model.
- Tax calculation and Brazilian fiscal document issuance are out of scope.
- Refund workflow is represented in the schema but not exposed until billing-state transition rules are implemented.
