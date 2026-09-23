---
"@openspec-ui/core": minor
---

DeepSeek runs are refused before they start on a Node that cannot run
`dsh`. `dsh`'s entry point is guarded by `import.meta.main`, which Node
added in 24.2.0 and backported to 22.18.0; below that it exits with code 0
having said nothing, not even for `--version`. The adapter now asks the
Node on the PATH its version first and, where that Node is too old, fails
at once naming the version found and the versions that work, instead of
spending a run to end in silence. Where the version cannot be read the run
goes ahead as before. `HARNESS.md` and `README.md` state the real floor:
22.18 on the 22 line, or 24.2, rather than "newer than 22.11".
