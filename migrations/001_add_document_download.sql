-- Migration 001: add document:download permission
-- Reason: the document detail page (apps/web/src/pages/ApplicationDetailPage.tsx)
--         checks `permissions.includes('document:download')` for the preview/download
--         buttons, but v1.0.22's seed only created document:upload and
--         document:preview. Without this row, every non-owner saw the buttons
--         grayed out even after admins "granted permission".
--
-- Safe to re-run: every INSERT is idempotent.

BEGIN;

-- 1) Ensure the permission row exists
INSERT INTO permissions (id, name, code)
SELECT uuid_generate_v4(), '下载文档', 'document:download'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE code = 'document:download');

-- 2) Grant to the standard roles (idempotent: skip if already linked)
INSERT INTO role_permissions ("roleId", "permissionId")
SELECT r.id, p.id
FROM roles r, permissions p
WHERE p.code = 'document:download'
  AND r.code IN ('sys_admin', 'sys_user01', 'sys_user02')
  AND NOT EXISTS (
    SELECT 1 FROM role_permissions rp
    WHERE rp."roleId" = r.id AND rp."permissionId" = p.id
  );

-- 3) Backfill: any custom role that already has document:preview also gets
--    document:download (so existing user-created roles don't lose the new
--    functionality). Easy to undo per role via the admin UI.
INSERT INTO role_permissions ("roleId", "permissionId")
SELECT rp_preview."roleId", p_download.id
FROM role_permissions rp_preview
JOIN permissions p_preview  ON p_preview.id  = rp_preview."permissionId"
JOIN permissions p_download ON p_download.code = 'document:download'
WHERE p_preview.code = 'document:preview'
  AND NOT EXISTS (
    SELECT 1 FROM role_permissions rp_existing
    WHERE rp_existing."roleId" = rp_preview."roleId"
      AND rp_existing."permissionId" = p_download.id
  );

COMMIT;

-- 4) Summary (read-only, just for the operator)
SELECT 'permission' AS kind, code, name FROM permissions WHERE code = 'document:download';
SELECT 'role_coverage' AS kind,
       (SELECT string_agg(r.code, ', ' ORDER BY r.code)
        FROM role_permissions rp
        JOIN roles r ON r.id = rp."roleId"
        WHERE rp."permissionId" = (SELECT id FROM permissions WHERE code = 'document:download'))
       AS roles_with_it;