# Live Chat Setup (Realtime Database)

The live chat uses Firebase Realtime Database with anonymous sign-in for public users and full access for system admins.

## Required Firebase Console Steps

1) Enable anonymous auth:
   - Firebase Console -> Authentication -> Sign-in method -> Anonymous -> Enable.

2) Apply RTDB rules:
   - Firebase Console -> Realtime Database -> Rules
   - Paste the contents of `firebase.database.rules.json` and publish.

3) Ensure system admins are registered in RTDB:
   - The backend now writes `/admins/{uid}` on admin seed/bootstrap.
   - If the admin account existed before, re-run the seed/bootstrap to register it.

## Notes
- Each browser session creates a separate chat session id stored in `sessionStorage`.
- Anonymous visitors are asked for a display name before starting the chat.
- Companies show user name plus company name in the chat UI.
