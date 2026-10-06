# Lammetna Frontend ↔ Backend Parity

Updated after Phases 1–8 and runtime contract audit.

## Connected UI
- Discovery: vibe, mystery, voice-first, interest, attention, super-interest, rewind.
- Social hub: visitors, daily question, daily missions, prompts, temporary social status.
- Chat: messages, blurred media flow, gifts, voice call scaffold, private-photo consent, speed intro, duo challenge, surprise/restart prompts.
- Lamma: group voice scaffold, seats, mic queue, Star Chair requests, Pair Spotlight, Mystery Guest controls, host moderation foundations.
- Finance: wallet, localized star-pack display, host earnings, IAP debt/hold state, payout history/methods, KYC state.
- Settings: privacy, block list, themes, boost, audio intro.

## External production blockers
- Apple IAP server verification + App Store Server Notifications V2.
- Google Play purchase verification + RTDN.
- Production TURN credentials.
- Real KYC/Liveness provider.
- Real payout providers and sandbox/production credentials.
- Reliable SMTP + Confirm Email and leaked-password protection before launch.
- Legal review and final security/E2E testing.

## Release rule
Do not merge/promote to production until Preview mobile E2E and financial/security tests pass. Backend scaffolds must not be presented as live external integrations.
