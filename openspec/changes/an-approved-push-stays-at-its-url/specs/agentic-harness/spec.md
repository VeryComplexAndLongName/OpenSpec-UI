## ADDED Requirements

### Requirement: A Harness-approved HTTP push refuses redirects

For an approved push over HTTP or HTTPS, the Harness SHALL disable Git
redirects for the exact prepared endpoint. It SHALL refuse the operation
if it cannot verify that setting or if the endpoint responds with a redirect.

#### Scenario: Git configuration enables redirects for the remote URL

- **WHEN** the approved HTTP endpoint redirects and the repository's URL-specific Git configuration would follow that redirect
- **THEN** the push fails and the transport does not contact the redirected URL
