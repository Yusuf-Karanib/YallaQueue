# YallaQueue — WebMCP Challenge submission

## Tagline

WhatsApp booking meets an agent-native live queue for local service businesses.

## Project description

YallaQueue turns ordinary WhatsApp messages into confirmed appointments and a
live queue for small service businesses. A customer can message a natural phrase
such as “Tomorrow at 6:30 PM.” YallaQueue validates the time, prevents duplicate
or overlapping bookings, assigns a queue number, stores the appointment, replies
on WhatsApp, and shows the result in the shop dashboard.

The WebMCP extension lets a signed-in shop owner manage that live queue with a
browser agent. The owner can ask “Summarize today's queue” and receive a current,
structured answer instead of making the agent inspect page text. The owner can
then say “Mark queue 1 completed,” and the agent uses a purpose-built tool to
make that exact change. The dashboard refreshes immediately, so the human and
agent continue working from the same visible state.

## Why WebMCP is a strong fit

Queue management is fast-moving and action-oriented. Visual browser automation
would need to guess which card, dropdown, and button represent the requested
appointment. WebMCP removes that guesswork by exposing the shop's real actions
as typed tools with narrow inputs.

This creates a better experience because:

- The agent reads live application state rather than interpreting screenshots.
- Status changes target a queue number and an allowed status directly.
- The owner stays in the dashboard and sees agent changes appear immediately.
- The tools reuse the active login instead of creating a separate agent account.
- Customer phone numbers are intentionally excluded from tool results.

Before WebMCP, an owner had to manually scan the schedule and operate each status
control. With WebMCP, a person can manage the queue conversationally while the
agent performs safe, structured reads and updates in the same web experience.

## WebMCP implementation

The signed-in Next.js dashboard imperatively registers two tools with
`document.modelContext.registerTool()`:

1. `get_queue_summary` is read-only. It returns today's totals and upcoming
   appointments without customer phone numbers.
2. `update_queue_status` changes one appointment using a queue number, optional
   service date, and an allowed status: confirmed, completed, cancelled, or
   no-show.

Each tool calls a same-origin route using the active Supabase login cookie. Every
route re-checks authentication, shop membership, input validation, appointment
ownership, and Supabase row-level security. The update tool's description also
states that it should only run after a clear user request.

## What was added during the challenge

YallaQueue's WhatsApp booking pipeline existed before the submission period.
Commit `712877c` on August 30, 2026 meaningfully extended it with browser-native
WebMCP tools, protected tool routes, an agent-ready dashboard panel, security
boundaries, tests, and deployment documentation.

## Links

- Live app: https://kdbqb3uvjahz6ij3mv4xto2ypu0rimxk.lambda-url.eu-central-1.on.aws/login
- Public repository: https://github.com/Yusuf-Karanib/YallaQueue

Add the private judge login credentials to the Devpost submission form, not to
the repository.

## Judge testing instructions

1. Open the live URL in ChatGPT's in-app browser, or in Chrome 149+ with
   `chrome://flags/#enable-webmcp-testing` enabled.
2. Sign in using the judge credentials supplied privately on Devpost.
3. Confirm that the dashboard says `2 agent tools ready`.
4. Ask: `Summarize today's queue.`
5. Ask: `Mark queue 1 completed.`
6. Confirm that queue 1 changes to Completed in the visible dashboard.

## Demo video script — under three minutes

### 0:00–0:20 — Problem

“Small service businesses often book through WhatsApp, then manually copy those
appointments into a queue. YallaQueue connects the customer message, the live
shop dashboard, and a browser agent.”

### 0:20–0:50 — WhatsApp booking

Show the customer chat. Send `Tomorrow at 6:30 PM`, then show the confirmation
with its appointment time and queue number.

### 0:50–1:10 — Shared dashboard

Open the dashboard and show that the WhatsApp appointment appears automatically.
Point out the date, time, queue number, and current status.

### 1:10–1:40 — Read with WebMCP

Show `2 agent tools ready`. Ask the browser agent: `Summarize today's queue.`
Show that the agent calls `get_queue_summary` and reports the live queue.

### 1:40–2:10 — Act with WebMCP

Ask: `Mark queue 1 completed.` Show the agent call
`update_queue_status`, then show the dashboard status update immediately.

### 2:10–2:35 — Why it matters

“The agent does not guess where to click. It uses typed tools, the owner's active
login, server-side authorization, and row-level security. Tool results exclude
customer phone numbers.”

### 2:35–2:50 — Close

“YallaQueue lets customers keep using WhatsApp while shop owners manage a live
queue together with their agent.”

## Final submission checklist

- [x] Working live URL
- [x] Public source repository
- [x] WebMCP implementation added during the submission period
- [x] Project description and testing instructions
- [x] Visible open-source license in the repository
- [ ] Public YouTube demo shorter than three minutes with audio
- [ ] Private judge credentials entered on Devpost
- [ ] Final Devpost submission saved before September 3, 2026 at 1:00 PM PT
