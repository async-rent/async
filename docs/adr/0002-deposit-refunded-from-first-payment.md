# The Deposit is charged with the first week and refunded from that payment

The Deposit is part of the first payment, one PayPal capture together with the first week and the delivery fee. At the Return it goes back to the customer as a partial refund of that capture, less any amount the Operator keeps with a reason. We chose this over holding the Deposit as a separate PayPal authorization because an authorization expires long before an open-ended Rental ends, so it would have to be re-authorized again and again while the gear is out.

## Considered Options

- **A separate PayPal authorization hold for the Deposit**: the money never leaves the customer, but the hold expires within days to weeks. Re-authorizing a vaulted account every few weeks can be declined, which leaves Async holding nothing. Rejected.
- **A separate capture for the Deposit at checkout**: refunds would be whole captures, but the customer would approve two charges and core would track two first payments. Rejected for the extra checkout step.

## Consequences

- Refunds need an amount: the provider adapter and `refundPayment` support partial refunds, and the Deposit refund gets its own stable request key so a retry never pays twice.
- A first payment with its Deposit refunded stays succeeded, because the first week was still paid. Where the Deposit stands is tracked on the Rental.
- A Cancel refunds the first payment in full, Deposit included.
