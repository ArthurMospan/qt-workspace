import sys

path = r'c:\Users\Arthu\.gemini\antigravity\brain\32547596-851f-4f9f-92c3-c4c928fa9dae\task.md'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

replacements = [
    ('- [ ] Plan upgrade flow (manual toggle API)', '- [x] Plan upgrade flow (manual toggle API)'),
    ('- [ ] Org deletion flow', '- [x] Org deletion flow'),
    ('- [ ] Organization logo/branding settings', '- [x] Organization logo/branding settings')
]

for old, new in replacements:
    content = content.replace(old, new)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print('Checked off completed tasks in task.md!')
