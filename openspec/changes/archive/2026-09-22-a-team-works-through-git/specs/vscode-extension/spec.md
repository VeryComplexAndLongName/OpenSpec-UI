## ADDED Requirements

### Requirement: The editor joins a person to the team

The extension SHALL offer **OpenSpec Workbench: Join the Team**, which asks
for a handle, a name and an optional e-mail address. It SHALL suggest the
handle and the address from the git identity, and write the person's file
through the core. It SHALL say what it wrote, that the file goes in a pull
request, and offer to open the file.

#### Scenario: Joining from the palette

- **WHEN** a person runs Join the Team and gives a handle and a name
- **THEN** `openspec/people/<handle>.json` holds this machine's key, and
  nothing is committed
