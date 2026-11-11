# Async

Async rents workspace gear by the week to remote workers in a city, through a storefront, an HTTP API and AI agents.

## Language

### Catalog

**Setup**:
A Product in the Setups category that rents several pieces of gear together as one item at one weekly price. Its parts are other Products.
_Avoid_: Bundle, kit, package

### Rentals

**Operator**:
A member of the Async team who delivers and collects gear and records it against Rentals.
_Avoid_: Admin, staff, shop

**Delivery**:
The Operator dropping off and setting up a Rental's gear at the customer's address. A delivered Rental is active.
_Avoid_: Fulfillment, drop-off

**Cancel**:
Calling off a Rental before its Delivery. It takes effect immediately.
_Avoid_: End (before Delivery), void

**End**:
The customer stopping a delivered Rental. Weekly billing stops after the week already paid, and the gear is then collected.
_Avoid_: Cancel (after Delivery), terminate

**Return**:
The Operator collecting a Rental's gear. A returned Rental is completed.
_Avoid_: Pickup, collection

**Deposit**:
Money paid with the first week and held against damage, missing gear or unpaid weeks. It goes back to the customer at the Return, less any amount the Operator keeps with a reason.
_Avoid_: Security, hold

### Billing

**Billing plan**:
The weekly charges a Rental makes to the customer's saved PayPal account after the first week, until the Rental ends. A plan that keeps being declined is paused until the customer pays again.
_Avoid_: Subscription, billing agreement
