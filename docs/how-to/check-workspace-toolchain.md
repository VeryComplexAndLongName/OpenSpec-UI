# Check a workspace's toolchain

The project can commit `openspec/workbench-tools.json` with an exact OpenSpec
CLI version, fingerprints of instruction files, or both.

```json
{
  "openspecVersion": "1.13.2",
  "instructions": [
    {
      "path": "AGENTS.md",
      "sha256": "8ddb54826f913d306111ef8dbaea6f1be2c3745c188a864dc51c953edcfba5bf9"
    }
  ]
}
```

Replace the sample fingerprint with the SHA256 of your reviewed UTF-8 text.
The fingerprint is calculated with CRLF line endings converted to LF and a
UTF-8 BOM removed. This gives equivalent Windows and Unix checkouts the same
fingerprint. For example, from the project root:

```sh
node -e "const s=require('fs').readFileSync('AGENTS.md','utf8').replace(/^\uFEFF/,'').replace(/\r\n/g,'\n'); console.log(require('crypto').createHash('sha256').update(s).digest('hex'))"
```

In VS Code, select **Diagnose Workspace** in the Workspace view. From a
terminal, run `openspec-ui-cli diagnose workspace --cwd .`. The report names
the expected version, any missing or changed instruction, and what to check
next. Diagnosis leaves the declared pins and installed tools untouched.
