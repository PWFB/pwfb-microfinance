# PWFB Branch Messenger and Voice Calls

## Branch Messenger
- Available to authenticated PWFB staff and administrators.
- Role channels are branch-scoped; group conversations require active staff memberships in the selected branch.
- Messages are limited to 5,000 characters.
- Unread counts are calculated using each user's own read-state record.
- Customers do not receive staff messenger access.

## Voice Calls
- Staff can place in-app voice calls to another active, linked PWFB staff account across the organisation.
- Staff-to-customer calls are restricted to customers in the caller's permitted branch scope.
- A customer must have a linked PWFB application login, a phone number on their PWFB profile, and must explicitly enable staff voice calls in the customer application before staff can call them.
- Customers can disable that permission at any time; the backend ends pending/active calls to that customer when consent is withdrawn.
- Calls are browser-based WebRTC audio. Call invitations, participant authorization, and offer/answer/ICE signalling are handled by the PWFB backend. This is not PSTN/mobile-network dialling.
- The PWFB app must remain open to receive incoming-call alerts. The application polls the call inbox while signed in.
- Google STUN is the default ICE server. Users behind restrictive carrier NAT/firewalls may require a TURN relay.

## Optional TURN configuration
Configure these variables on the backend only:
- `PWFB_TURN_URLS`: comma-separated TURN URLs.
- `PWFB_TURN_SHARED_SECRET`: shared secret used to mint time-limited TURN credentials.

Never add TURN secrets to frontend variables or commit actual secret values.

## Database and release
The communication migration files are:
- `20261109060000_branch_messaging`
- `20261109070000_pwfb_app_voice_calls`

They create branch conversation/message/read-state tables and customer call-consent/call-session/signalling tables. They must be applied to the intended staging database before enabling the feature in a live staging deployment. No migration is run by this documentation change. Do not apply these migrations to production without a separate explicit approval.
