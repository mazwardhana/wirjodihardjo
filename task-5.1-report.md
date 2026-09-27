# Task 5.1: Gallery Member Upload - Implementation Report

**Status**: ✅ Complete  
**Commit**: `feat: allow member gallery uploads with moderation`

## Summary

Implemented member-facing gallery upload endpoint that allows authenticated users (MEMBER, BRANCH_ADMIN, SUPER_ADMIN) to upload photos to published albums. All uploads automatically receive PENDING status and trigger admin notifications for moderation review.

## Implementation

### Files Created

1. **`src/app/api/galeri/upload/route.ts`** (139 lines)
   - POST endpoint for member uploads
   - Validates authentication (rejects guests with 401)
   - Validates album exists and is published (403 if unpublished, 404 if not found)
   - Validates file types (JPG, PNG, WebP) and size (10MB max per file)
   - Supports multiple file uploads via `files[]` field
   - Validates all files before saving any (atomic batch validation)
   - Creates GalleryMedia records with `status=PENDING`
   - Records `uploadedByUserId` for moderation feedback
   - Notifies all active SUPER_ADMIN and BRANCH_ADMIN users
   - Logs audit trail for each upload
   - Returns `{ ok: true, mediaIds: string[], count: number }`

2. **`src/app/api/galeri/upload/route.test.ts`** (197 lines)
   - Behavioral test suite using VM-based module loading
   - Mocks auth, prisma, fs/promises, and audit dependencies
   - Tests guest rejection (401)
   - Tests unpublished album rejection (403)
   - Tests successful single and multi-file uploads
   - Verifies PENDING status, uploader tracking, caption trimming
   - Verifies admin notifications (title, body, link to `/admin/galeri/{slug}`)
   - Tests file type and size validation (rejects PDF, >10MB files)
   - All 5 tests pass; confirmed RED before implementation

## Key Decisions

1. **10MB limit for members** (vs 5MB for admin uploads in `/api/admin/media`): Per brief requirement on line 14
2. **Multi-file support**: Accepts `files[]`, `files`, or `file` form fields for flexibility
3. **Atomic validation**: All files validated before any are saved, preventing partial uploads
4. **Inline notification**: Created notifications directly via Prisma instead of adding a new helper to `src/lib/notifications.ts`, keeping the implementation focused
5. **Caption applies to all files**: Single optional caption shared across batch; future UX can add per-file captions if needed
6. **Auto-moderation**: Every upload requires admin review; existing `/admin/galeri/[slug]` page handles approval/rejection

## Verification

```bash
$ npx tsx --test src/app/api/galeri/upload/route.test.ts
✅ 5/5 tests pass

$ npx eslint src/app/api/galeri/upload/route.ts src/app/api/galeri/upload/route.test.ts
✅ No errors

$ npx tsc --noEmit (task files only)
✅ No errors
```

### Test Coverage

- ✅ Guest rejection (401, no writes)
- ✅ Unpublished album rejection (403, no writes)
- ✅ Valid upload creates PENDING media
- ✅ Admin notifications sent to all active SUPER_ADMIN + BRANCH_ADMIN
- ✅ Multiple files accepted, all mediaIds returned
- ✅ Unsupported file types rejected (400)
- ✅ Files >10MB rejected (400)
- ✅ Caption whitespace normalized
- ✅ uploadedByUserId tracked for moderation feedback

## Integration Points

- **Existing moderation UI**: `/admin/galeri/[slug]` already exists with `MediaModeration` component
- **Notification link**: Points to `/admin/galeri/{albumSlug}` where admin can approve/reject
- **Schema**: Uses existing `GalleryMedia` table with `status` enum (PENDING/APPROVED/REJECTED)
- **Audit**: Logs `MEDIA_UPLOAD` action with albumId, url, and status

## Concerns

None. Implementation complete per brief requirements.

## Next Steps (deferred to separate tasks)

- UI integration: Add "Upload Foto" button to public `/galeri/[slug]` page (visible when logged in)
- Upload modal component calling `/api/galeri/upload`
