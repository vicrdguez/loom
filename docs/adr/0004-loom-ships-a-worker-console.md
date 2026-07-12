# Loom Ships a Worker Console

Loom will ship a first-party, human-operated **Worker console** that owns board polling, scheduling,
and process supervision for Board-topology Workers. This supersedes ADR 0003's "Loom ships no runtime"
decision: lived use showed that delegating scheduling to each Harness displaced essential
coordination, observability, and intervention into user-written scripts; one-Change Worker
invocations and the Role trust boundary remain unchanged.
