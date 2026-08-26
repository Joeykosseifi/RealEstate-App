# tests/

Cross-cutting test suites that span more than one app or exercise the
platform's security boundaries end-to-end — these do not belong to any
single app's own `test/` folder.

In particular, this is where the **Critical Security Tests** required by
the product spec live once the relevant milestones exist to test against
(workspaces in Milestone 2, properties in Milestone 3, collaboration in
Milestone 9, etc.):

1. Client cannot fetch a private property.
2. Client cannot fetch owner details.
3. Client cannot fetch private notes.
4. Client cannot fetch commission.
5. Company without collaboration cannot access freelance property.
6. Collaboration with `property.view` but without `property.view_owner` cannot access owner details.
7. Collaboration without `property.publish` cannot submit publication.
8. Company cannot edit another agent's property without explicit permission.
9. Removed workspace member loses access.
10. Ended collaboration loses future access.
11. Admin property moderator cannot automatically fetch unnecessary private professional data.
12. Private map coordinates are not exposed to clients.
13. Company employee leaving does not take company-owned records.
14. Freelance agent leaving a company retains personal-workspace property ownership.
15. Guessing UUIDs does not bypass authorization.

Nothing is implemented here yet (Milestone 0) — there is no auth,
workspace, or property model to test against. This file exists so the
location and intent are established before the first suite is added.

Per-app unit and e2e tests live alongside their app instead:
`apps/api/src/**/*.spec.ts`, `apps/api/test/*.e2e-spec.ts`.
