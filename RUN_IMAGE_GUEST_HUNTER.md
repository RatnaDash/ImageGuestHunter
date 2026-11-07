# Run Image Guest Hunter

## Paths and invocation

Workspace: `C:\Users\ratna\RAT-CODE\Codex\ImageGuestHunter`.
Input: `SrcImages` (top-level JPG/JPEG/PNG/WEBP files only).
Persistent tracker: `guest-hunting.xlsx`.
Archive: `SrcImages/Archive/YYYY-MM-DD` using Asia/Kolkata dates.

Say **Run Image Guest Hunter** in this Codex project. The agent performs research; the helper does not make network calls. Read the spreadsheet skill before workbook edits and youtube-guest-hunter skill plus `references/ratna-fit.md` before fit assessment. User instructions here override the latter skill's separate tracker destination and default candidate counts.

## Workbook contract

Preserve the existing workbook and all unrelated values, styles, validation and sheets. Never recreate it over user edits. Close Excel before saving; if locked, stop writes and leave images untouched. Back up the workbook under `backups` before every change, export to a temporary XLSX, reopen and validate, then replace the original. No concurrent runs. If another run is active, stop.

`Guests` has these eight visible columns, in order:
1. Name
2. Social media link, alternate link or phone no
3. Description
4. Fitment as per YouTube Guest Hunter
5. Status
6. Remark
7. Next follow-up date
8. Follow-up action

Status choices: Not contacted, Contacted, Replied, Follow-up needed, Booked, Completed, Declined, Do not contact. New rows default to Not contacted. Leave other outreach fields blank. Dates are real Excel dates displayed dd-mmm-yyyy and entered manually. Highlight overdue dates for named guests except Booked, Completed, Declined, Do not contact. Never infer contact or booking occurred.

`Processing Log` columns: Filename, SHA-256, Guest identity, Processing status, Processed date, Archive path, Issue.
Statuses: Saved, Duplicate, Needs review, Needs research, Failed. Save all file hashes, including repeats and unresolved images. A guest identity is a verified canonical profile URL where possible; otherwise a name plus disambiguating profession/organization.

`Needs research` columns: Name or visible handle, Screenshot, Issue, Sources checked, Last checked. Keep identified guests without a contact route here; do not put them in Guests until reachable.

`Outreach History` columns: Date, Guest identity, Status, Remark, Next follow-up date, Follow-up action. Append dated entries when the user requests an outreach update; never overwrite earlier history. Preserve manual edits in Guests; do not invent historical events from changed cells.

## Execution

1. Run `scripts/image_queue.py scan` using bundled Python. It hashes files and reads the Excel log without editing anything. Never recurse into Archive. Use its manifest to prioritize unseen hashes and report previously logged issues without researching them repeatedly. Inspect the actual workbook and existing guest profiles before research.
2. Read screenshots with image tools. Extract only visible names, handles, captions or URLs. Never identify a person from their face. If no usable text identifies them, log Needs review and leave the screenshot in place. Multiple identifiable guests in one image require separate guest rows; archive only when every person has been accounted for. Do not interpret people merely visible in the background as guest requests.
3. Deduplicate by hash and verified canonical profiles/handles. Normalize names for comparison, including spacing, case and honorifics, but never merge on name alone. Match profession/organization and profile evidence. Different images of one guest enrich the existing row only when there is genuinely new visible information. Do not repeat completed background research otherwise. Do not overwrite Status, Remark, dates or follow-up actions during enrichment. Do not add names outside the screenshots.
4. Check available YouTubeGuestHunter shown history/tracker read-only to mark previously shared people in the fitment narrative. These screenshots explicitly request review, so prior recommendation history does not exclude them. Do not modify that application's files. If unavailable, disclose this limit; local deduplication still applies.
5. Research each new identity on the public web. Prefer official websites and social profiles, then credible interviews, reporting and booking profiles. Aim for at least two independent sources for background; disclose when only one is available. Verify social links belong to the person. Keep source URLs inline in contact/description/fitment cells and record the checked date. Do not invent quotes, biography, achievements, interest areas or contact details. Distinguish uncertain claims and inferred interview angles from established facts.
6. Require at least one actionable public route for Guests: official social account, public email, website contact form or usable bureau booking page. Include phone/WhatsApp only if explicitly published for business/booking; label the owner if an agent. If absent, say not publicly found rather than guessing. Store phone numbers as text. Blocked pages are not proof of a contact detail. A generic article is not an outreach route.
7. Write a concise 3–5-line description. Fitment is High/Medium/Low with concrete reasons for Beyond The Framework: lived tension, expertise, vulnerability/contradiction, India relevance, usefulness for Gen Z/students/young professionals, reachability and clip potential. Include 3–5 publicly supported expertise/interest topics and one suggested episode angle. Do not infer private or sensitive interests. Read the current ratna-fit reference rather than replacing it with generic popularity scoring.
8. Persist and verify the workbook before moving anything. Dates use Asia/Kolkata. For Saved/Duplicate log rows set an absolute planned Archive path inside today's archive folder. Preserve original filenames; choose a unique suffix if the destination exists. Reopen exported XLSX, check row counts, guest identities, sources, hashes, contact gate and unchanged outreach fields. Failed saves leave originals untouched. Do not regenerate guest rows after a crash if already saved.
9. Run `scripts/image_queue.py archive` to move only files with matching hash AND filename and a Saved/Duplicate log row with a valid archive destination. The helper rereads the workbook and verifies the saved records. Needs review, Needs research and Failed files remain in SrcImages for user review/retry; skip repeated research unless requested. For a resolved guest without contact, keep their row in Needs research, not Guests.
10. On move failure keep the saved research, report the issue and retry archiving on the next run without repeating research. Never delete originals before confirming an archive copy. Report workbook link, new/enriched guests, duplicates, archived files, unresolved and failed items. Do not claim a standalone/background service exists.

## Outreach commands

Accept natural-language commands such as `Set <guest> to Contacted; remark: emailed booking team; follow up on 2026-11-03; action: send reminder`. Resolve ambiguous names before updating. Change only requested fields in Guests and append a dated Outreach History entry. `Show due follow-ups` reads dates on or before today, excluding closed statuses above. Never send messages or schedule notifications implicitly.
