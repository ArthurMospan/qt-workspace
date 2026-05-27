import sys

path = r'c:\Users\Arthu\.gemini\antigravity\brain\32547596-851f-4f9f-92c3-c4c928fa9dae\task.md'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

replacements = [
    ('- [ ] `orgMemberships` separate collection', '- [x] `orgMemberships` separate collection'),
    ('- [ ] `can()` permission utility function', '- [x] `can()` permission utility function'),
    ('- [ ] Granular UI guards per RBAC matrix', '- [x] Granular UI guards per RBAC matrix'),
    ('- [ ] OrgAdmin vs TeamMember distinction in UI', '- [x] OrgAdmin vs TeamMember distinction in UI'),
    ('- [ ] Role management UI (change member roles)', '- [x] Role management UI (change member roles)'),
    ('- [ ] Workspace \' Portal', '- [x] Workspace -> Portal (Skipped - User explicitly rejected)'),
    ('- [ ] Magic Link generation from workspace', '- [x] Magic Link generation from workspace (Skipped - User uses Google Auth)'),
    ('- [ ] **Timesheet grid UI**', '- [x] **Timesheet grid UI**'),
    ('- [ ] **Billing Calculator dashboard**', '- [x] **Billing Calculator dashboard**'),
    ('- [ ] **Invoice generation**', '- [x] **Invoice generation**'),
    ('- [ ] **Invoice PDF export**', '- [x] **Invoice PDF export**'),
    ('- [ ] **Invoice collection**', '- [x] **Invoice collection**')
]

for old, new in replacements:
    content = content.replace(old, new)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print('Checked off completed and skipped tasks!')
