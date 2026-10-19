-- Export user/role/permission data before cleanup
SELECT id, email FROM users ORDER BY "createdAt";
SELECT id, code, name FROM roles;
SELECT count(*) as permission_count FROM permissions;
SELECT count(*) as role_permission_count FROM role_permissions;
SELECT count(*) as user_role_count FROM user_roles;
SELECT id, code FROM organizations;
SELECT id, code, name FROM companies;
