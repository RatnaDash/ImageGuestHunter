# Image Guest Hunter

In this Codex project, say:

**Run Image Guest Hunter**

Add screenshots to `SrcImages` first. Codex reads visible names/handles, researches public sources and updates `guest-hunting.xlsx`. No API keys or terminal commands are needed for normal use. Close the workbook in Excel before a run.

The tracker includes contact routes, descriptions, podcast fit, status, remarks and follow-up dates/actions. Duplicate images and guests are checked before research. Successfully saved screenshots move to `SrcImages/Archive`; unresolved items stay in the input folder with a logged issue.

You can also say **Show due follow-ups** or **Update [guest]'s status to Contacted, remark [note], follow up [date], action [action]**.

The Excel workbook is authoritative. Keep it and its processing log when moving this project. `backups` holds pre-edit copies. Research depends on Codex image/web tools; this is not an unattended script. Telegram intake is reserved for Phase 2.

Setup does not process existing screenshots. See `RUN_IMAGE_GUEST_HUNTER.md` for the full command contract.
