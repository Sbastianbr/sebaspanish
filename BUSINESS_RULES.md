# SebaSpanish — Business Rules V1

Status updated: 2026-09-29 — Phase 2C Development private read-only portal.

This document is the source of truth for SebaSpanish business rules.

Codex and future backend implementations must follow these rules.
Do not invent or modify business rules without Sebastián's explicit approval.

## Implementation scope

- **Implemented and connected (Phase 1):** development availability and guest bookings,
  authoritative prices/durations, 12-hour notice, 60-day horizon, overlap prevention,
  idempotency, ES/EN/PL frontend. These continue without requiring payment or credits.
- **Implemented as private backend domain operations (Phase 2A):** normalized students,
  pending/active purchases, individual credits, allocation/history, six-month expiry,
  cancellation/rescheduling credit outcomes, no-show and teacher cancellation.
  Only trusted server RPCs may use this foundation; the current frontend does not call them.
- **Implemented in Development (Phase 2B):** server-side paid-customer eligibility,
  passwordless invitation/magic links, safe Auth binding, technical callback, public signup
  disabled, and the approved 30-day teacher-return exception. Its callback is upgraded by Phase 2C.
- **Implemented in Development (Phase 2C):** private read-only Mis clases, SDK-managed
  persistent/renewable sessions and logout, own profile/credits/purchases/classes via auth.uid().
  No direct table access, client-selected identity or automatic email-based legacy booking linkage.
- **Decided for future phases, not implemented:** payment verification/provider,
  payment holds, one free trial per email, transactional booking with student credits,
  full atomic rescheduling flow, student-facing cancellation, admin tools, refunds,
  emails, Calendar, materials, currency conversion, and DELE activation.

Product rules below describe the target product. They do not imply that all those
features already exist. Details and tested boundaries: `supabase/PHASE2A.md`, `supabase/PHASE2B.md` and `supabase/PHASE2C.md`.

---

# 1. General principles

The existing SebaSpanish frontend is considered finished.

Do not redesign:

- home
- navbar
- hero
- classes
- plans
- DELE section
- testimonials
- FAQ
- footer
- booking visual design
- responsive behavior
- ES / EN / PL translations

Backend changes must integrate with the current frontend.

Base business currency:
PLN.

Base timezone:
Europe/Warsaw.

---

# 2. Weekly availability

Monday:
10:00–20:00

Tuesday:
10:00–20:00

Wednesday:
10:00–20:00

Thursday:
10:00–20:00

Friday:
10:00–20:00

Saturday:
11:00–16:00

Sunday:
Closed.

Booking grid:
30-minute intervals.

No automatic buffer between lessons in V1.

Sebastián must be able to manually block:

- individual hours
- partial days
- complete days
- holidays
- vacations
- personal appointments

Availability shown to students must be calculated from:

weekly availability

- manual exceptions

* existing active bookings
* temporary payment holds

---

# 3. Booking window

Minimum booking notice:
12 hours before lesson start.

Maximum booking horizon:
60 days.

Students cannot reserve outside this range.

---

# 4. General Spanish products

## Trial lesson

Duration:
30 minutes.

Price:
Free.

Maximum:
One free trial per email.

The trial can be used for:

- general Spanish
- DELE diagnostic

A student cannot obtain one general trial and another DELE trial using the same email.

No aggressive anti-abuse system is required in V1 beyond reasonable email-based protection.

---

## Single Spanish lesson

Duration:
60 minutes.

Price:
65 PLN.

Credits:

1.

---

## Spanish Pack 4

Price:
230 PLN.

Credits: 4.

Effective price:
57.50 PLN per lesson.

---

## Spanish Pack 8

Price:
440 PLN.

Credits: 8.

Effective price:
55 PLN per lesson.

---

# 5. DELE products

DELE preparation is a separate, more specialized service.

Duration:
60 minutes per lesson.

## Single DELE lesson

Price:
80 PLN.

Credits:

1.

## DELE Pack 4

Price:
300 PLN.

Credits: 4.

## DELE Pack 8

Price:
560 PLN.

Credits: 8.

DELE preparation requires more specialized preparation, corrections, exam strategy and mock-exam work than general Spanish lessons.

Do not present Sebastián as an official Instituto Cervantes examiner.

Do not imply affiliation with Instituto Cervantes.

---

# 6. Currency

Official/base currency:
PLN.

All official prices are stored and validated server-side in PLN.

Public pricing cards on the home page remain in PLN only.

During booking/checkout, the interface may display approximate conversions to:

- EUR
- USD

Example:

65 PLN
≈ €XX
≈ $XX

These conversions are informational only.

They must be clearly identified as approximate.

Do NOT hard-code permanent EUR/USD prices.

Exchange rates may change.

Actual V1 payment is processed in PLN.

Suggested explanatory text:

"Approximate conversion. The final amount is charged in PLN and your bank or card provider may apply its own exchange rate."

Multi-currency checkout may be considered later but is not part of V1.

---

# 7. Packs and credits

All paid products are represented internally as entitlements/credits.

Single lesson:
1 credit.

Pack 4:
4 credits.

Pack 8:
8 credits.

The first lesson is selected during the initial booking/purchase flow.

After the first booking, remaining credits are managed through "Mis clases".

Students may later reserve:

- one remaining lesson
- several remaining lessons
- all remaining lessons

in the same visit if they wish.

Every lesson remains an individual booking.

In the future credit-backed flow, confirmation reserves one credit immediately.
The credit becomes consumed after completion, no-show or a late student cancellation/change.
A valid return frees that same unit again; historical allocations are preserved.
Current Phase 1 guest bookings remain independent of credits until that flow is connected.

Each booking immediately blocks its time slot.

If multiple valid packs exist for the same student, consume the valid credit that expires first.

Packs are personal and non-transferable.

---

# 8. Credit expiration

Paid credits expire:
6 calendar months after server-confirmed activation of the purchase.
A pending purchase has no usable credits. The activation timestamp and expiration
are calculated server-side in Europe/Warsaw, stored as timestamptz (UTC instants).

The lesson itself must take place on or before the expiration date.

Example:

If credits expire on April 30,
the student cannot reserve on April 29 for a lesson taking place in May.

Unused expired credits become unusable.

They are not automatically refunded.

If Sebastián cancels a lesson near the expiry date, the student must not lose the credit because of the teacher cancellation.

Sebastián/admin must be able to restore or reasonably extend that credit.

---

# 9. Mis clases

The student portal is called:

"Mis clases"

Not:
"Mis reservas"

It should eventually become the central private student area.

Students do NOT create a traditional username/password account in V1.

Access is passwordless through email magic links.

A request email is only a delivery/eligibility lookup, never proof of identity.
Verified identity comes from Supabase Auth / auth.uid(). At least one purchase
activated as paid is required, including one individual lesson. Pending, trial-only,
or no purchase cannot access. Exhausted/expired credits do not revoke customer access.

Access can be provided from:

- booking confirmation
- confirmation email
- "Mis clases" access point on the site

If the student loses the link, they can enter their email and request another magic link.

The response must remain neutral.

Example:

"If your email has access to SebaSpanish, you will receive a link."

Never publicly reveal whether a specific email belongs to a student.

The portal must be private and marked noindex.

---

# 10. Mis clases content — V1

The portal should eventually show:

- upcoming lessons
- previous lessons
- active packs
- remaining credits
- pack expiration date
- book another lesson
- reschedule lesson
- cancel lesson

Students may use remaining credits whenever they want within:

- real availability
- 12-hour minimum notice
- 60-day booking horizon
- credit expiration

---

# 11. Mis clases — future learning campus

Future feature, NOT required in the first backend implementation.

"Mis clases" should later evolve into a private learning area for every student.

Each lesson may contain:

- class PDF
- presentation
- homework
- exercises
- vocabulary
- new words
- teacher notes
- links/resources
- supporting material

Materials may be associated with a specific student and/or specific lesson.

Student materials must NOT be publicly accessible.

They must NOT be indexed by search engines.

Future implementation should use private storage and signed/private access URLs.

The current backend architecture should allow this feature to be added later without rebuilding the student portal.

---

# 12. General Spanish learning materials

General Spanish lessons prioritize:

- communication
- real-life situations
- conversation
- functional grammar
- vocabulary
- confidence when speaking
- practical Spanish

Lesson materials should follow the general SebaSpanish visual identity.

---

# 13. DELE learning materials

DELE materials are not identical to general Spanish materials.

Grammar and vocabulary resources may be reused when appropriate, but DELE preparation requires dedicated exam-focused materials.

DELE preparation should cover:

- initial diagnostic
- exam format
- reading comprehension
- listening comprehension
- written expression
- oral expression
- interaction
- exam strategies
- time management
- evaluation criteria
- mock exams

DELE presentations/materials should maintain the SebaSpanish identity while using the lavender/violet visual accent already associated with DELE on the website.

---

# 14. Rescheduling

Students may reschedule without losing a credit when the change is made:

12 hours or more before lesson start.

The operation should be atomic:

1. validate the new slot
2. reserve the new slot
3. release the previous slot

A failed reschedule must not accidentally lose the original booking.

With less than 12 hours remaining, the original credit is consumed/lost.
The future new booking must have another available credit and satisfy the unchanged
12-hour minimum notice, 60-day horizon and availability rules.

Phase 2A implements settlement of the original allocation only, not the full
rescheduling operation. A future server transaction must validate/create the new
booking and settle/reallocate credits atomically; failure rolls everything back.

---

# 15. Cancellation

Cancellation 12 hours or more before lesson start:

- releases the slot
- restores the lesson credit

Cancellation/rescheduling with less than 12 hours:

- the original credit is consumed/lost (approved by Sebastián, 2026-09-29).

Exactly 12 hours qualifies for return. No-show consumes; teacher cancellation always returns.
These outcomes are implemented by the private Phase 2A domain RPC, not by a public UI/endpoint.

Cancellation of a lesson does NOT automatically mean monetary refund.

Credit cancellation and money refund are separate processes.

---

# 16. No-show

If the student does not attend:

the credit is consumed.

No automatic replacement credit.

Sebastián/admin may make exceptional manual decisions.

---

# 17. Late arrival

A late student does not extend the lesson end time.

Example:

Lesson:
18:00–19:00

Student arrives:
18:15

Lesson still ends:
19:00

---

# 18. Teacher cancellation

If Sebastián cancels a lesson:

the student always receives the credit back.

The student must never lose a credit because of teacher cancellation.

The slot becomes unavailable/cancelled accordingly.

Approved and implemented in Phase 2B: a still-valid teacher-returned unit keeps
its original expiry. A unit that expired while assigned becomes available with
30 calendar days from teacher cancellation, calculated in Europe/Warsaw.
It does NOT receive another six months. The original/new expiry is audited and
an idempotent retry does not extend it again.
The booking becomes cancelled. Blocking unavailable teacher time is a separate
availability/admin operation; this phase does not change offered schedules.

---

# 19. Payment provider

Planned provider:
Stripe.

Do not trust frontend values for:

- price
- plan
- duration
- credits
- payment state

All must be validated server-side.

---

# 20. Payment model

Paid products are paid in full upfront.

No installment payments in V1.

Single lesson:
full payment.

Pack 4:
full payment.

Pack 8:
full payment.

Trial:
no payment required.

---

# 21. Temporary checkout hold

When a student selects a paid lesson slot and enters checkout:

hold the selected slot for 15 minutes.

Possible flow:

available
→ held
→ confirmed

If verified payment succeeds:

held → confirmed.

If checkout fails or expires:

held → available.

This prevents two students from paying for the same lesson time.

Do not trust browser redirect as evidence of successful payment.

Paid booking confirmation must rely on verified server-side payment/webhook information.

---

# 22. Monetary refunds

Cancelling/rescheduling a lesson does not automatically trigger a Stripe refund.

Automatic student self-service monetary refunds are NOT part of V1.

Monetary refunds should initially be handled separately/manual according to the final legal/refund policy.

Legal wording must be finalized before real payments are enabled.

Do not invent refund law or legal policy.

---

# 23. Student data

Minimum booking data:

Name:
required.

Email:
required.

Phone:
optional if retained by the current form.

Do not collect unnecessary personal data.

Private student information must never be publicly readable.

---

# 24. Booking states

Booking state and payment state must remain separate.

Suggested booking states:

- held
- confirmed
- cancelled
- completed
- no_show

Where appropriate also record who cancelled:

- student
- teacher
- admin

Do not overload one status field with unrelated concepts.

---

# 25. Payment states

Suggested payment states:

- not_required
- pending
- paid
- failed
- expired
- refunded
- partially_refunded

Only implement states actually needed by the current phase.

---

# 26. Pack / entitlement states

Suggested states:

- active
- exhausted
- expired
- cancelled
- refunded

Again, avoid unnecessary complexity until needed.

---

# 27. Student notifications — future phase

When email integration is implemented, students should receive:

- booking confirmation
- purchase confirmation
- reschedule confirmation
- cancellation confirmation
- Mis clases magic link
- reminder 24 hours before class
- reminder 2 hours before class

Emails should use the student's selected language:

- ES
- EN
- PL

The timezone must be clear in booking-related messages.

---

# 28. Sebastián notifications — future phase

Sebastián should receive notifications for:

- new booking
- reschedule
- cancellation

Operational information should include at least:

- student name
- email
- plan
- date
- time
- booking status

---

# 29. Google Calendar — future phase

Confirmed booking:
create event.

Reschedule:
update event.

Cancellation:
cancel/remove event.

Future evolution:
external busy events in Sebastián's calendar may automatically block SebaSpanish availability.

Google Calendar integration is not part of the initial booking backend foundation.

---

# 30. Manual blocked availability

Sebastián must eventually be able to block:

- single slots
- hour ranges
- complete days
- multiple-day vacations

Initially this may be managed through Supabase/admin data.

A custom SebaSpanish Admin dashboard is NOT required for the first production iteration.

---

# 31. Admin functionality — future

A future admin area may allow Sebastián to:

- see bookings
- see students
- see active packs
- block availability
- restore credits
- mark lessons completed
- mark no-shows
- handle manual refunds
- upload student materials

Do not build this dashboard until needed.

---

# 32. Backend platform

Backend:
Supabase / PostgreSQL.

Current Phase 1 architecture already includes:

- availability endpoint
- booking creation endpoint
- server-side price validation
- server-side duration validation
- private booking data
- RLS
- idempotency
- database-level overlap prevention
- explicit demo mode

Future backend work must preserve these protections.

---

# 33. Security requirements

Never place Supabase service_role credentials in frontend code.

Use RLS for private data.

Validate server-side:

- plan
- price
- currency
- duration
- credit count
- booking time
- booking horizon
- minimum notice
- availability
- payment status

Prevent:

- double booking
- overlapping active bookings
- price manipulation
- duration manipulation
- arbitrary booking creation
- unauthorized access to other students' data

Use idempotent operations where appropriate.

Production must never silently fall back to demo mode after backend failure.

---

# 34. Current Phase 1 status

The existing local implementation currently has:

UI:
reservas.js

Backend adapter:
booking-api.js

Configuration:
booking-config.js

Supabase Edge Functions:
booking-availability
booking-create

Private PostgreSQL schema:
booking_private

Phase 1 tables (preserved):

- offers
- availability_slots
- bookings (now has an optional student_id; old bookings remain valid)

Current DB protection includes:

- RLS
- server-side offer validation
- unique booking attempt identifiers
- bookings_no_active_overlap
- restricted RPC permissions

Current Phase 1 development status (2026-09-28):

- Supabase development is linked; private tables and both Edge Functions exist remotely.
- Frontend configuration explicitly uses that development backend; no frontend secrets.
- Initial migration was applied manually and its CLI history is now synchronized.
- Incremental migration 202609280002 aligns the previously active 24-hour notice with the approved 12 hours, in both RPCs. Frontend uses 12 hours too.
- Real concurrent booking was already tested: one 200 confirmed, one 409 SLOT_UNAVAILABLE.
- Edge preserves PostgreSQL 23P01 -> SLOT_UNAVAILABLE / 409.
- Browser E2E confirms a 65 PLN booking, persistence and occupied-slot handling with student data retained.
- 29 automated tests passed; 0 failed. The optional local concurrency runner is skipped without local PostgreSQL, independently of the completed remote concurrency validation.
- SQL assertions and both migrations pass in a temporary single-connection PostgreSQL WASM engine.

See supabase/README.md for evidence, configuration and remaining production work.
This closes the development connection, not the later product rules described above.

---

# 35. Source of truth

This BUSINESS_RULES.md document is the business/product source of truth.

Codex must:

- read this document before changing booking/backend behavior
- follow these rules
- not invent prices
- not invent availability
- not invent cancellation policies
- not invent credit behavior
- not invent payment behavior
- not redesign the frontend

If implementation conflicts with this document:

STOP and report the conflict before changing the business rule.


---

# 36. Implemented Phase 2A foundation

New private tables: students, purchases, credits, credit_allocations, credit_events.

- Email identity is lower(trim(email)), unique; it is not proof of email ownership.
  Phase 2A does not create Auth accounts; Phase 2B handles verified paid-customer
  access separately. No automatic migration of guest profiles is performed.
- Historical booking contact fields remain snapshots, even when the student profile changes.
- Purchase preparation snapshots the enabled server catalogue: PLN 65/230/440,
  60 minutes and 1/4/8 units. It cannot accept client prices, durations or counts.
- Activation, granting units and audit records are one transaction. Activation is
  a trusted administrative/backend operation, NOT proof that a real payment occurred.
- Neutral external source/payment/event identifiers are unique and idempotent.
  A future verified payment handler must validate the provider event and amount
  against the authoritative purchase before calling activation.
- No purchase creates bookings automatically. Trial remains free/30 minutes and
  outside purchases/paid credits. DELE remains inactive (future prices 80/300/560 PLN).
- Effective balances derive from units and allocations; there is no mutable
  remaining_credits counter. Expiry is evaluated when reading/allocating, without cron.
- Allocation reserves one unit with row locks and a unique active-allocation index.
  A consumed unit cannot be reused. Returned valid units are reusable with history.
- All new tables use RLS with no public/student policies. Only service_role can
  invoke the new public-schema RPCs. No direct table access, even for service_role.
- Future authenticated booking creation and credit allocation MUST share one SQL
  transaction. Do not wire them as independent browser calls.
- Production/payment wiring has not been enabled. Development Auth foundation is
  documented in PHASE2B.md. Phase 1 retains
  its existing RPC definitions, endpoints, frontend configuration and behavior.
