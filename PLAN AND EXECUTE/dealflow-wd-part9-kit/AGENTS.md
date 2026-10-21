# Agent notes for this repository

This folder is warpdrive, being extended into Dealflow by an autonomous build.

- If your task prompt names you the QA reviewer, follow `.dsh/qa.md` and ignore the rest of this file.
- Otherwise you are the builder: read `PLAN-PART9.md` in full (Parts 1 to 8 are finished) and follow its section 0 exactly. `PROGRESS.md` tracks the run; `ROADMAP.md` is context only.
- `CLAUDE.md` holds the coding conventions; they apply to every file you write.
- Nobody answers questions in this run: never call ask_user_question. Decide with the plan's decision policy and log the decision.
- Never touch /Users/cxt22/Downloads/DEALFLOW, never print `.env` values, never edit the kit files listed in PLAN-PART9.md rule 18.
