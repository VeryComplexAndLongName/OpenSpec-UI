# Launch Workbench from npm

Use a current Node 24 runtime (development and CI use 24.21.0). From the project you want to inspect:

```sh
npx @openspec-ui/cli open workbench
```

Or name the project explicitly and let the OS select an available local port:

```powershell
npx @openspec-ui/cli open workbench --cwd "C:\Projects\my-app" --port 0
```

No OpenSpec-UI checkout, npm workspace install or source build is required. npm may ask to install the public package on first use. Open the exact localhost URL printed in the terminal; its fragment contains the server's ephemeral access token. Keep that terminal open and press Ctrl+C when finished. Do not share the tokenized URL.

The default port is 4317. Use `--port 4320` or `--port 0` if it is occupied. Ports must be integers from 0 through 65535. The launcher accepts an existing directory and binds only to 127.0.0.1. It has no remote-host, external-cwd, autonomous or approval-bypass option. `--format json` prints one ready object containing `url`, `workspaceRoot` and the included Core/server versions, then remains running until stopped. Finish or stop active agent runs through their existing controls before closing the host; the launcher adds no new run-cancellation policy.

The package includes the existing standalone server and prebuilt shared UI, including browser chunks. The footer reports the actual included Core/server/webui versions; the CLI package can have a different version. Existing commands such as `validate changes` keep their own behavior and do not start a server.

Git, the OpenSpec CLI and agent executables are separate prerequisites for the operations that use them. Launching does not install those tools or start an agent. You can open the built-in PR Review example before configuring a real workflow. Existing configured schedules, permissions, review gates and spending limits keep their normal Workbench behavior.

For development from a checkout, the existing server build/start commands remain available. The npm command runs the published version, so development changes require a local build or a new release before they appear in that installed delivery.
