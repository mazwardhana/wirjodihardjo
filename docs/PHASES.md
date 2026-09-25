# Phase 0: Database Finalization
- [x] Write updated schema with all new fields and models
- [x] One migration: `finalize_admin_and_family_support`
- [ ] Seed data: family with divorce/remarriage (Rangga-Sari-Wati)

# Phase 1: Foundation UI Kit & Helpers
- [ ] requireRole() helper function
- [ ] logAudit() helper function
- [ ] Zod validations per entity
- [ ] Shared components: DataTable, Dialog, ConfirmDialog, FormField, Toast, Pagination

# Phase 2: Kinship Relation Engine
- [ ] getParents, getChildren, getSpouses, getSiblings functions
- [ ] classifySibling() → FULL / PATERNAL_HALF / MATERNAL_HALF / STEP / ADOPTED
- [ ] generationLevel auto-calculation + cycle detection
- [ ] Javanese kinship labels for all relation types
- [ ] Tests for scenarios A-E

# Phase 3: Profile & Family Panel
- [ ] Inline family section: Bapak, Ibu, Bojo, Saudara (per type), Anak
- [ ] Mini-graph modal (React Flow, 1-hop default, 2-hop toggle)
- [ ] Javanese labels + original-term tooltip
- [ ] Responsive, keyboard, contrast verified

# Phase 4: Tree Upgrade
- [ ] Couple-grouped layout (children grouped per partnership)
- [ ] Half-sibling rendering
- [ ] Dashed lines: divorce, step-child, adopted
- [ ] Marriage status badges (current/former spouse)
- [ ] Filter: branch, generation, status, sibling type

# Phase 5: Member Submission Flow
- [ ] New submission form: /dashboard/pengajuan/baru
- [ ] "From which marriage" selector for add-child
- [ ] Detail page: /dashboard/pengajuan/[id]
- [ ] Notification on status change

# Phase 6: Admin Shell + Overview
- [ ] Sidebar with 9 menu items, breadcrumb, role indicator
- [ ] /admin overview page with statistics
- [ ] Role-based menu visibility

# Phase 7: Member CRUD (Data Anggota)
- [ ] List with search, filter (branch, generation, status), pagination
- [ ] Create / Edit Person (public + private data)
- [ ] Mark deceased (birthDate, deathDate, isDeceased)
- [ ] Soft delete + restore
- [ ] Relation editor: parents, partners (order/status/divorce), children
- [ ] Upload profile photo
- [ ] AdminNote CRUD

# Phase 8: Submission Approval
- [ ] Queue + filter (status, branch, type, date)
- [ ] Detail with before/after diff
- [ ] Approve (transaction + appliedPersonId) / Reject (note required)
- [ ] Duplicate detection
- [ ] Recalculate generationLevel after approval

# Phase 9: Gallery Moderation
- [ ] Album CRUD + publish/unpublish
- [ ] Upload media + moderate (approve/reject + reason)
- [ ] Album publishing metadata

# Phase 10: Hall of Fame CRUD
- [ ] CRUD entries + publish/unpublish + upload photo + filter

# Phase 11: Reunion CRUD
- [ ] CRUD reunion + status transitions + upload hero
- [ ] Participant management (confirm/cancel/waitlist)

# Phase 12: Branch CRUD
- [ ] CRUD branch + set root person + set admin + activate/deactivate + cover photo

# Phase 13: User CRUD
- [ ] List + create account + change role + activate/deactivate + verify
- [ ] Password reset (mustChangePassword) + delete account (User only)

# Phase 14: Audit Log
- [ ] List + filter (actor, entity type, date range, action)
- [ ] Detail entry + before/after JSON diff viewer

# Phase 15: Notifications & Overview
- [ ] Auto-notifications: submission, moderation, upcoming reunion
- [ ] Enhanced admin overview statistics

# Phase 16: QA & Delivery Gate
- [ ] Clean build, click-through every control (R-35)
- [ ] Test 3 roles + responsive + keyboard + WCAG AA contrast
- [ ] Antislop audit
- [ ] Update README + docs/