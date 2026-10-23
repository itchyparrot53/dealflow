# Troubleshooting and FAQ

## Signing in

**My sign-in link does not work.**
Links expire after 15 minutes and work once. Request a new one from the **Email link** tab.

**I did not get the sign-in email.**
Check your spam folder. The sign-in page shows the same message whether or not your address has an account, so also check you typed the address your admin invited. If it still does not arrive, ask your admin to check the server's email settings.

**I forgot my password.**
Sign in with an email link, then set a new password in **Settings › Personal preferences**.

**My invite link has expired.**
Ask an admin to invite you again from **Settings › Users**.

## Email

**Test and connect fails.**
Most failures are a mistyped app password, or using your normal mail password instead of an app password. Create a new app password with your mail provider and try again. For **Other IMAP/SMTP server**, check the server names and ports with your provider.

**An email is not linked to the right deal.**
Open the conversation and use **Link to existing** in the right-hand panel. Conversations that are not linked to anyone appear under **Unmatched**.

**A scheduled email has not gone out.**
Look in **Outbox**. Scheduled emails wait there until their send time.

**Images in an email are missing.**
Dealflow hides images from outside senders until you select **Show remote content**.

## Deals and data

**I cannot see a deal a colleague can see.**
What you can see depends on your visibility group and permission set. Ask your admin.

**A deal disappeared from the board.**
It may have been won, lost or archived. Check the list view with a filter for won or lost deals, or **Archived deals**. If it was deleted, it is in **Settings › Recycle bin** for 30 days.

**I deleted something by mistake.**
Select **Undo** in the message that appears straight away, or restore it from **Settings › Recycle bin** within 30 days.

**Totals in another currency look wrong.**
Totals are converted to your company's base currency using the rates in **Settings › Currencies**. Ask your admin to update them.

**My CSV import went wrong.**
Select **Undo** next to the import in **Settings › Import data** to remove the records it created, fix the file and import again.

## AI

**The AI buttons do nothing or show a limit message.**
Your company or your own monthly AI limit may have been reached, or an admin may have turned AI off. Ask your admin to check **Settings › AI**.

**The AI got something wrong.**
AI suggestions are drafts. Check them before you send or save. The assistant never changes data until you select **Confirm**.

<!-- hidden while NEXT_PUBLIC_PWA_UI is off -->
## Offline and mobile

**I see "You're offline".**
Your device has lost its connection. You can still open the records you viewed recently, read-only. Select **Try again** when you are back online.

**How do I install Dealflow on my phone?**
Open Dealflow in your phone's browser and use the browser's **Add to Home Screen** or **Install** option.
<!-- end hidden -->

## Quotes and invoices

**My customer cannot accept a quote.**
The quote may have passed its **Valid until** date. Duplicate it and send the new one.

**I sent an invoice by mistake.**
Open it and select **Void**. Issued invoices are never deleted, so the numbering stays complete.

## General

**Is my data shared with anyone?**
Dealflow runs on your company's own server. Data leaves it only for the services your admin sets up: your mail server, the AI provider (for AI features), and any enrichment provider.

**Where is the full list of keyboard shortcuts?**
Press `?` anywhere outside a text box.

**Who do I ask for help?**
Your Dealflow admin. Admins can find the technical guides in the `docs` folder of the Dealflow repository.
