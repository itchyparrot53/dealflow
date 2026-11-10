# Campaigns

Campaigns send designed email to a group of contacts, then show you what happened: who received it, who opened it, who clicked, who unsubscribed and who bounced. Dealflow also has automated campaigns (sequences) for follow-ups that run on their own.

Campaigns are separate from your day-to-day email in [Email](email.md). Everyday email goes from your own mailbox; campaign email goes through the campaign sending account an admin sets up below.

## Before you start

You need one of these permissions:

- **Campaigns: view** to see campaigns, reports and insights.
- **Campaigns: edit** to build and change campaigns and sequences.
- **Campaigns: send** to send, schedule, pause and cancel.
- **Marketing: manage** to change the sending settings, senders, postal address and consent defaults.

Admins have all four. An admin also needs to set up a sending account and a postal address before anyone can send.

## How to set up sending

1. Go to **Settings › Campaigns**.
2. Under **Senders**, select **Add sender**, enter the **From name** and **From email**, then select **Add and verify**.
3. Open the verification email and select the verification link.

**Result:** the sender shows **Verified**. A campaign cannot send until its sender is verified.

4. Under **Postal address**, enter your company's postal address and select **Save settings**.

**Result:** the address appears in the footer of every campaign. Campaigns cannot send without it.

5. Under **Consent**, decide whether form sign-ups need **double opt-in**. Leave it on unless you have a specific reason to change it.
6. Under **Sending**, check the **Send rate per minute**. The number is a ceiling set by the server; you can lower it here for a smaller sending account.
7. Under **Domain check**, enter your sending **Domain** and **DKIM selector**, then select **Check**.

**Result:** Dealflow checks the SPF, DKIM and DMARC records it can find and shows a pass or an item to fix for each.

**Tips:**

- Use a real role address such as `news@yourcompany.com` rather than a person's address, so replies and bounces have one owner.
- The bounce mailbox is optional. When an admin configures it, the **Bounces** section shows when it was last checked and how many messages it processed.

## How to change a contact's marketing status

1. Open the person from **Contacts › People**.
2. In the **Marketing** section, select **Change status**.
3. Choose the new status and, for **Subscribed**, choose the **Consent basis** that applies.

4. Select **Save**.

**Result:** the status changes, the person is included in or excluded from future campaigns, and the change is added to their consent history.

**Statuses:**

| Status | What it means |
|---|---|
| **Subscribed** | The person agreed to receive campaign email. They are included in campaigns. |
| **Pending** | A double opt-in email was sent but the person has not confirmed yet. They are excluded until they confirm. |
| **Not subscribed** | No marketing consent on record. They are excluded. |
| **Unsubscribed** | The person opted out, through a campaign link or a manual change. They are excluded. |
| **Bounced** | The address hard-bounced. They are suppressed from future sends. |

Select **Consent history** to see every status change with its date, source and consent basis. Keep this history: it is the record that shows why each person is on your list.

## How double opt-in works

When **Require double opt-in for form sign-ups** is on:

1. A visitor submits a form with the marketing consent box ticked.
2. Dealflow creates the person as **Pending** and sends them a confirmation email.
3. The visitor selects the confirmation link. The link opens a page that asks them to confirm.
4. After they confirm, the person becomes **Subscribed**.

The link expires after 30 days. A pending person is never included in a campaign. If they do not confirm, they stay pending and receive no campaign email.

The confirmation page can be opened once. A confirmation email is only sent when the form's consent box was ticked; a form submission without it does not change anyone's marketing status.

**Tip:** the daily number of confirmation emails is capped for the whole install. If a form is being abused, the cap slows the abuse rather than letting it consume your sending account.

## How to build a campaign

1. Go to **Campaigns** and select **+ Campaign** for a blank campaign, or open the **Templates** tab and select **Use** on a starter (Newsletter, Announcement, Event invitation or Simple text).
2. In **Details**, fill in:
   - **Name**: internal only; recipients never see it.
   - **Type**: newsletter, announcement, promotion, event, nurture or other. It is used for reporting.
   - **Sender**: a verified sender from Settings.
   - **Subject** and **Preview line**.
   - **Reply-to**, if replies should go somewhere other than the sender.
3. Select **Recipients** and choose a **Saved filter**, or select **Build a filter** to make the audience for this campaign.

**Result:** the page shows how many people will receive the campaign and why the others are excluded: not subscribed, pending, unsubscribed, bounced, suppressed, without an email or a duplicate email.

4. Select **Content** and build the email. Add blocks from the left, select a block in the preview to edit it on the right, and use **Desktop** or **Mobile** to check both widths.
5. Select **Send test**, enter up to five email addresses of active Dealflow users, choose a sample person for merge fields, and select **Send test**.

**Result:** the test email arrives with the real subject, content and footer. Its unsubscribe link is a test placeholder, so it does not change anyone's marketing status. The Review checklist records that a test was sent.

6. Select **Review** and read the checklist. Every **fail** blocks sending; **warning** items do not.

The checklist covers the subject, a verified sender, the postal address, at least one recipient, image alt text, button URLs, the 100 KB size limit and the domain check.

## How to send now or schedule

1. On **Review**, select **Send now**.
2. Confirm the number of recipients.

**Result:** the campaign status changes to **Sending**, then **Sent**. The report link appears on the campaign list.

To send later:

1. On **Review**, select **Schedule**.
2. Pick the date and time and select **Schedule**.

**Result:** the campaign waits as **Scheduled** and sends at that time. The time is shown in your browser's time zone.

While a campaign is **Sending**, **Pause** stops the next batch. **Resume** continues it. **Cancel campaign** stops it for good; recipients who already received it keep their copy.

**Tips:**

- Send a test to yourself after any change to the content, the merge fields or the footer.
- To reuse a sent campaign, open its row menu and select **Duplicate**. The copy is a draft with the same content and audience, so you can change it before sending.
- Drafts can be deleted from the same row menu.

## How to read a campaign report

1. Go to **Campaigns** and select **Report** on a **Sending**, **Paused** or **Sent** campaign.
2. Read the tiles: recipients, delivered, unique opens, unique clicks, click-to-open rate, unsubscribes, bounces and spam reports.
3. Open the chart to see opens and clicks over time. A new campaign is grouped by hour; older campaigns are grouped by day.
4. Scroll to **Links** to see clicks per link, and to **Recipients** to see each person's status.

**Result:** you can tell whether the subject worked (opens), whether the content worked (clicks) and whether the list is healthy (bounces and unsubscribes).

**Tips:**

- Mail apps and security scanners often load the tracking image without a person reading the email. Leave **Include machine opens** off for the most useful open rate, and turn it on when you need to match a mail provider's number.
- The recipients table can be filtered by status. **Download CSV** exports the full recipient list, subject to your **Export data** permission.
- Opens are counted only when the recipient's mail app loads images. A missing open does not always mean the email was not read.

## How to compare campaigns

1. Go to **Campaigns** and open the **Insights** tab.
2. Choose a date range, a campaign **Type** and a **Sender**.
3. Read the table: each row is a campaign, with its sent date, recipients and rates.
4. Select a column heading to sort. The **Your average** row shows the average rate across the campaigns in view.
5. Use the arrow next to a rate to see whether it is more than 10% above or below your average.

The **Automated** tab shows the same measures for each active or paused sequence and for each step, so you can see where people drop off in a follow-up.

**Tip:** compare campaigns of the same type and audience size. A small campaign with three recipients will swing the average much more than a campaign with three thousand.

## How to automate follow-ups with a sequence

A sequence is a series of email steps and waits that runs for each enrolled person. Each email step sends through its own hidden campaign, so it uses the same sender, footer, tracking and unsubscribe rules as a normal campaign.

1. Go to **Campaigns** and open the **Automated** tab.
2. Select **+ Sequence**.
3. Give it a **Name** and choose a verified **Sender**.
4. Add steps:
   - **Email**: write the subject and content.
   - **Wait**: choose how long to wait before the next step.
5. Set the **Send window**: the start and end hour, whether to send on weekdays only, and the time zone it should use.
6. Choose the **Entry** rules: whether **Manual enrollment** and **Automation** may enroll people, and optionally a saved people filter. Choose the **Exit** rules: when the deal is won, when the person replies, or a saved filter.
7. Select **Save**, then **Activate**.

**Result:** the sequence status becomes **Active** and Dealflow starts any new enrollments on the next run.

To enroll people by hand:

1. Go to **Contacts › People** and filter to the people you want.
2. Tick their checkboxes.
3. In the bulk bar, choose **Enroll in sequence** and pick the sequence.

**Result:** each person is enrolled once. If they are already active in that sequence, Dealflow does not add them twice.

**Tips:**

- A person leaves the sequence when they finish the last step or when an exit rule matches. A deal won or a reply stops the remaining steps.
- **Pause** stops new sends without deleting the sequence. **Delete** removes it and its enrollments; the sent emails stay in each person's history.
- The **Enrolled** count on the sequence list shows its size at a glance.
- A sequence's send window is evaluated in the sequence's time zone, not your browser's.

## How to handle unsubscribes and bounces

Every campaign footer contains your postal address and an unsubscribe link.

- **Unsubscribe link**: opens a page where the person can confirm the unsubscribe, and resubscribe later if they change their mind. It does not require a Dealflow login.
- **One-click unsubscribe**: mail apps show an **Unsubscribe** button at the top of the message. It records the opt-out immediately, without opening a page.
- **Hard bounce**: the address is marked **Bounced** and suppressed from future sends.
- **Soft bounce**: recorded on the report. Dealflow does not suppress the address unless the bounce becomes hard.
- **Spam complaint**: recorded on the report. Treat it as an opt-out and look at what changed in that send.

**Result:** unsubscribed and bounced people are excluded from every later campaign and sequence, even if they match the filter.

**Tips:**

- Do not delete a person to "remove" them from a campaign. Deleted contacts keep their suppression record; use **Change status** instead.
- If someone asks to be forgotten, use the contact deletion flow rather than only unsubscribing, and follow your company's data-retention policy.
- Check the **Bounces** section in Settings if hard bounces suddenly rise. A bounce mailbox catches asynchronous bounces that arrive after the send.

## Compliance tips

- Send only to people who agreed to hear from you. Keep the consent basis and the consent history up to date.
- Always keep the postal address and unsubscribe link in the footer. Do not edit them out.
- Use a sending domain you control. Publish SPF, DKIM and DMARC records and check them on **Settings › Campaigns**.
- Use a reputable bulk SMTP provider for larger lists. Put its credentials in the campaign sending settings, not your everyday mailbox.
- Warm up a new domain or provider slowly. Start with engaged contacts and a lower rate, then increase it.
- Make the subject and the content match what the person signed up for. Clear, specific email gets fewer spam reports.
- Test every campaign before sending, including the merge fields and both the desktop and mobile preview.

## Troubleshooting

| Problem | What to check |
|---|---|
| **Send now** is disabled | A checklist item is a fail. Open **Review** and read the item; usually the sender is unverified or the postal address is empty. |
| The campaign says **Sending** for a long time | The rate per minute and the batch size limit each run. Large campaigns take several batches. Check the worker is running (see [Self-hosting](self-hosting.md)). |
| A person did not receive the campaign | Their marketing status may be pending, unsubscribed or bounced. Open their **Marketing** section and read the consent history. |
| The test email did not arrive | The recipient must be an active Dealflow user. Check the address you typed and your mail provider's spam folder. |
| Opens look too high | Turn off **Include machine opens** on the report. |
| A form sign-up stays pending | The person has not opened the confirmation link, or the link expired after 30 days. |

## Related

- [Email](email.md) for everyday email from your own mailbox.
- [Forms and booking pages](forms-and-booking.md) for the consent checkbox on a form.
- [Stats and reporting](stats-and-reporting.md) for dashboards and reports outside campaigns.
- [Self-hosting and install](self-hosting.md) for the campaign environment variables.
