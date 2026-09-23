# Token audit

Measured 2026-09-22 by stream-parsing 579 Claude Code transcripts for this repo (381 sessions plus 181 subagent transcripts, 2026-08-04 through 09-15, 20,151 API calls, deduplicated by message id). Codex figures come from `~/.codex` session logs. The raw analysis was task-run output and was not retained in Git; these figures are its retained record.

Total was 4.00B tokens: 96.6% cache reads, 2.85% cache writes, 0.55% output.

Two sessions that never restarted used 87.8% of all tokens; their contexts reached 998k and 846k on the 1M-context setting.

Calls with more than 200k context were 38% of calls and 68% of tokens. Median context per call was 156k; p90 was 394k.

Subagent and workflow transcripts held 66% of tokens, across 181 subagents, all run at max effort.

Part-identification vision calls ran as full agent sessions rather than one-shot calls: 369 sessions, a median of 10 calls each, 7.5% of raw tokens and 15.8% of spend by price.

The fixed prefix repeated on every call was about 17.7% of tokens. The median first call of a session was 28.4k tokens for main threads and about 40k for subagents; one Sep-15 session's first call was 58.1k. Required-doc reads were about 3.7% of tokens.

About 34.8M tokens were spent per successful commit, over 115 commits.

Separately, 2026-08-29 through 09-08, Codex ran about 305 sessions and about 3.0B tokens, producing 0 commits.
