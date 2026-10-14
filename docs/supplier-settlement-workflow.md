# Supplier purchase and international settlement workflow

This workflow tracks customer collection, supplier procurement, and international settlement as separate records. It does not initiate a bank transfer or place an AliExpress order automatically.

## Preconditions

- The customer payment has been verified by the existing Click/Payme/Paynet callback flow and the Uriona order is `PAID`.
- The company has confirmed with its bank which contract/invoice and beneficiary documents are required for an international transfer.
- The supplier has confirmed that the proposed bank transfer is an accepted payment method for the intended order. A transfer to a seller does not automatically settle an AliExpress checkout order.
- AliExpress API order-placement and payment permissions are not assumed. Manual confirmation is required until those permissions are verified.

## Admin API

All routes require a valid bearer session for a user whose role is `ADMIN`.

1. `POST /api/v1/admin/supplier-purchases`
   Body: `{ "orderId": "...", "idempotencyKey": "..." }`
   Creates one supplier purchase for an already-paid order. Repeated calls with the same key are idempotent.

2. `POST /api/v1/admin/supplier-purchases/:id/ready`
   Body: `{ "supplierAmountMinor": 12000, "supplierShippingMinor": 2000, "currency": "CNY" }`
   Records the supplier quote in the smallest currency unit and moves the purchase to `READY`.

3. `POST /api/v1/admin/supplier-purchases/:id/settlements`
   Body: `{ "idempotencyKey": "...", "beneficiaryName": "...", "beneficiaryBank": "...", "beneficiaryAccountRef": "vault://...", "contractReference": "...", "currency": "CNY", "amountMinor": 14000 }`
   Creates a settlement draft. The amount and currency must exactly match supplier item amount plus shipping. `beneficiaryAccountRef` must be a reference to a protected vault/record, not the raw account number.

4. `POST /api/v1/admin/supplier-purchases/settlements/:settlementId/approve`
   Records an administrator approval. This does not send money.

5. `POST /api/v1/admin/supplier-purchases/settlements/:settlementId/mark-sent`
   Body: `{ "bankReference": "..." }`
   Records the bank's transfer reference after the transfer has actually been initiated.

6. `POST /api/v1/admin/supplier-purchases/settlements/:settlementId/mark-settled`
   Body: `{ "proofStorageKey": "private-storage://..." }`
   Records manual confirmation of settlement using a protected statement/proof reference. This endpoint does not independently verify the bank statement; restrict access and audit its use.

7. `POST /api/v1/admin/supplier-purchases/:id/mark-placed`
   Body: `{ "externalOrderId": "...", "confirmationReference": "..." }`
   Marks the supplier order as placed only after a settled supplier payment exists and an external order ID plus confirmation reference are supplied. This is an audited manual confirmation, not an AliExpress API call.

## Status semantics

- Customer order `PAID`: payment provider confirmed the customer's payment. It is not evidence that the bank settled an international transfer.
- Supplier purchase `READY`: supplier price and shipping are recorded.
- Supplier settlement `APPROVED`: internal approval recorded; no money has been sent yet.
- Supplier settlement `SENT`: bank transfer reference recorded.
- Supplier settlement `SETTLED`: a protected proof reference has been recorded by an administrator; reconcile it against a bank statement.
- Supplier purchase `PLACED`: an external supplier order ID and confirmation reference have been recorded after settlement.

## Production gaps

- Integrate bank statement import/reconciliation before treating a manual settlement confirmation as authoritative.
- Verify AliExpress Open Platform permissions and the supplier's accepted payment method before building an automatic purchase adapter.
- Add role separation (finance approver vs operator), immutable audit events, and dual approval if required by company policy.
- Test against the actual bank's documentation and a supplier sandbox/UAT flow before production use.
