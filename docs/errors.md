# Errors
## Why the server crashes on an unhandled rejection
Crashing on an unhandled rejection is the correct behavior, because it lowers the risk that a programmer error stays unnoticed.

A crash stops a "broken" process. The only reliable way to bring such a process back is a restart. The crash also cleans up hanging transactions.
