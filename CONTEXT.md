# Waiver Director

Waiver Director is the domain of waiver operations for businesses that need participant waivers before delivering scheduled experiences, services, or activities. The language here keeps product discussions centered on waiver-specific operations rather than generic form building.

## Language

**Waiver Operator**:
A business that collects waivers as part of running activities, services, events, rentals, classes, tours, or similar customer experiences.
_Avoid_: Account, client, tenant

**Workspace**:
An isolated waiver-operations boundary that can represent a distinct business or a specific operational unit or location of a larger business.
_Avoid_: Legal entity, global account

**Waiver Operations**:
The business process of creating waiver requirements, collecting signed submissions, connecting them to bookings or participants, and using the resulting records for follow-up, reporting, analytics, and customer feedback.
_Avoid_: Form management, document collection

**Booked Experience**:
A scheduled customer experience that can have waiver requirements, participants, signed submissions, and follow-up workflows attached to it.
_Avoid_: Appointment, reservation

**Walk-In Collection**:
Waiver collection for a customer or participant who did not originate from a pre-existing scheduled experience in Waiver Director.
_Avoid_: Unscheduled booking, offline booking

**Booking Provider**:
An external system that supplies booking data for a waiver operator and may also be used by the operator to record walk-ins.
_Avoid_: Source of truth, authorization provider

**Provider Booking**:
A booking record imported or synchronized from a booking provider; Waiver Director uses provider bookings for waiver operations without becoming the operator's primary booking system.
_Avoid_: Manual booking, internal reservation

**Unlinked Signing**:
Public waiver signing that is not connected to a provider booking, typically through a general waiver link or QR code.
_Avoid_: Provider booking, manual booking

**Public Signing Entry**:
A public-facing entry point where customers can find their booking-linked waiver using identifying booking details or start an unlinked signing flow for walk-ins.
_Avoid_: Operator app, booking system

**Waiver Kiosk**:
A public signing entry intended for on-site use where customers find upcoming booking-linked waivers or start unlinked signing from a shared device or posted QR code.
_Avoid_: Operator dashboard, booking checkout

**Public Kiosk Entry**:
A public workspace-scoped kiosk URL that customers can use without an operator login, constrained to upcoming booking lookup, minimal results, public signing, rate limiting, and automatic reset behavior.
_Avoid_: Authenticated operator session, unrestricted booking access

**Kiosk Lookup Window**:
The limited booking time range available through public kiosk lookup, covering recently started bookings and near-term upcoming bookings rather than the workspace's full booking history.
_Avoid_: Full booking search, historical lookup

**Booking Lookup Signing**:
A kiosk signing path where a customer finds an upcoming provider booking using identifying details before completing a booking-linked waiver, without requiring participant-level selection.
_Avoid_: Broad booking search, operator lookup, participant matching

**Booking Waiver Link**:
A public booking-linked waiver URL that opens the normal signing flow for a specific provider booking and can be shared among people on that booking.
_Avoid_: Participant-specific waiver link, kiosk-only flow

**Kiosk Lookup Result**:
Minimal booking information shown after kiosk lookup, such as activity, start time, booking number, and lead name when needed, without exposing broad customer or participant data.
_Avoid_: Customer profile, booking detail view

**Public Signing Prefill**:
Editable basic signer information prefilled during a public signing flow from a workspace-scoped email match, such as name and date of birth.
_Avoid_: Signature prefill, customer history exposure, public customer search

**Walk-In Signing Path**:
A kiosk signing path where a customer completes an unlinked waiver without first finding a provider booking.
_Avoid_: Provider booking, booking checkout

**Signed Submission**:
An immutable record of a signer completing a published waiver version at a specific time, including signer details, answers, signature, minors when present, and any booking context captured at signing time.
_Avoid_: Filled form, response

**Operational Note**:
A workspace-scoped, timestamped, append-only note added by a workspace member around a signed submission, customer, booking, or follow-up for internal operations; it is not part of the signed record.
_Avoid_: Submission edit, legal annotation

**Booking Context**:
Booking information associated with a signed submission for operational use, reporting, follow-up, and later review.
_Avoid_: Validity source, authorization source

**Booking Snapshot**:
The booking context captured on a signed submission at signing time, preserved even if the provider booking later changes.
_Avoid_: Current booking state, live provider data

**Customer**:
A reachable person recognized within one waiver operator's workspace, usually by normalized email, who may sign waivers, appear on bookings, receive follow-up emails, and accumulate history or analytics.
_Avoid_: Participant, account, user

**Participant**:
A person who takes part in a booked experience or walk-in collection and may need waiver coverage, whether or not Waiver Director can contact or recognize them as a customer.
_Avoid_: Customer, user

**Covered Minor**:
A minor participant included under an adult signer's signed submission for waiver coverage.
_Avoid_: Customer, signer

**Waiver Template**:
An operator-managed waiver configuration that can be edited before publication and used to produce published waiver versions for signing.
_Avoid_: Form, document

**Published Waiver Version**:
A frozen waiver version that signers accept and signed submissions reference permanently.
_Avoid_: Current template, live form

**Custom Field**:
An operator-defined intake question on a waiver template whose answer is captured inside a signed submission, such as referral source, agreement checkbox, dropdown selection, or date.
_Avoid_: Survey response, mutable answer

**Custom Field Analytics**:
Aggregated views of custom field answers within a workspace, such as dropdown distribution charts or filtered summaries, without changing the underlying signed submissions.
_Avoid_: Post-signing edits, survey dashboard

**Historical Answer**:
A custom field answer interpreted against the published waiver version and field definition that existed when the signed submission was created.
_Avoid_: Current answer, live field value

**Cross-Version Rollup**:
An explicit analytics view that combines answers from related custom fields across published waiver versions.
_Avoid_: Automatic merge, implicit field match

**Follow-Up**:
A post-submission or post-experience message tied to waiver or booking context, used for thank-yous, feedback requests, review asks, promotions, or other operator-defined outreach.
_Avoid_: Campaign, generic email automation

**Feedback Request**:
A follow-up purpose that asks a customer to share private experience feedback with the waiver operator.
_Avoid_: Public review ask, complaint form

**Review Request**:
A follow-up purpose that directs a customer toward a public review platform or similar external reputation channel.
_Avoid_: Private feedback, internal survey

**Hosted Feedback Page**:
A Waiver Director-hosted post-experience page linked from a follow-up where a customer can provide private feedback or a satisfaction rating.
_Avoid_: Waiver intake, public review page

**External Review Link**:
An operator-provided link in follow-up content to a public review platform or business profile where customers can leave reviews that benefit the operator's public reputation and SEO.
_Avoid_: Internal review, private feedback, single preferred platform

**Follow-Up Candidate**:
A follow-up record created from a signed submission before it is sent, queued, blocked, failed, or left for manual action.
_Avoid_: Draft campaign, missing email

**Follow-Up Schedule**:
The send timing for a follow-up candidate, initially calculated from the booking snapshot captured on the signed submission rather than silently recalculated from later provider changes.
_Avoid_: Live booking reschedule, implicit timing change

**Canceled Follow-Up**:
A follow-up candidate removed from automatic sending because its booking was canceled before delivery; it remains visible in follow-up history but is not part of the send queue.
_Avoid_: Automatic thank-you, deleted follow-up, queued follow-up

**Unscheduled Follow-Up**:
A follow-up candidate that exists for operator review but has no automatic send time, typically because the signed submission lacks usable booking timing.
_Avoid_: Failed follow-up, ignored submission

**Follow-Up Recipient**:
The signer or reachable customer email address that receives a follow-up; follow-ups are not sent separately to covered minors or participants without their own reachable identity.
_Avoid_: Participant, booking guest

**Follow-Up Content**:
Freeform rich message content for follow-ups, including ordinary links and Waiver Director variables, configured by the operator for a workspace or saved as reusable templates.
_Avoid_: Structured campaign block, review widget

**Analytics**:
Workspace-scoped operational and customer insight derived from bookings, signed submissions, custom fields, customers, and follow-ups.
_Avoid_: Cross-workspace benchmarking, global reporting

**Workspace-Scoped Reporting**:
Analytics and operational reporting limited to one workspace unless a future feature explicitly defines multi-workspace reporting permissions and behavior.
_Avoid_: User-wide reporting, automatic rollup

**Owner**:
A workspace member who can administer the workspace and change high-impact configuration such as waiver templates, integrations, members, sender identity, and billing-sensitive settings.
_Avoid_: Admin user, account owner

**Staff**:
A workspace member who can perform day-to-day waiver operations without changing high-impact workspace configuration.
_Avoid_: Viewer, read-only user

**High-Impact Configuration**:
Workspace settings and data-movement actions that Staff should not change or perform, including waiver templates, published waiver versions, follow-up content, reusable follow-up templates, members, booking integration management, email sender identity, workspace identity, billing-sensitive settings, and exports of signed submissions or customer lists.
_Avoid_: Daily operations, routine review, in-app viewing

**Analytics Event**:
A signed submission used as the central first-party counting event for Waiver Director analytics.
_Avoid_: Page view, booking event

**Waiver Gap**:
A booking condition where the expected participant count from booking context is greater than the number of covered participants represented by signed submissions.
_Avoid_: Violation, noncompliance

**Current Waiver Gap**:
A waiver gap for an active current provider booking; canceled bookings are excluded from current needs-attention views while their signed submissions remain available historically.
_Avoid_: Historical submission count, canceled booking alert

**Covered Participant Count**:
The number of participants represented by signed submissions for waiver-gap purposes, counting the signer and any covered minors on each submission.
_Avoid_: Submission count, customer count

**Waiver Requirement**:
A rule that an activity, participant type, or operator workflow requires one or more waiver templates to be signed; bookings inherit waiver requirements as scheduled instances of activities.
_Avoid_: Additive default, single waiver link

**Default Waiver Requirement**:
A workspace-level waiver requirement that applies to all activities unless the operator configures a more specific exception.
_Avoid_: Activity mapping prerequisite, setup blocker

**Activity-Specific Requirement**:
A waiver requirement that replaces the default waiver requirement for one activity and may explicitly require one or more waiver templates.
_Avoid_: Automatic add-on, hidden extra waiver

**Activity**:
An operator-defined offering that customers participate in, such as a tour, rental, class, event, or service; bookings are scheduled instances of activities.
_Avoid_: Experience, product, service item

**Provider-Synced Activity**:
An activity whose name and availability primarily come from a booking provider and should stay aligned with provider data while Waiver Director uses it for waiver requirements, analytics, and follow-up context.
_Avoid_: Raw provider label, local-only activity

**Activity Identity**:
The stable provider-supplied identifier that lets Waiver Director recognize the same provider-synced activity across name changes.
_Avoid_: Activity name, display label
