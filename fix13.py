import sys

path = r'c:\Users\Arthu\.gemini\antigravity\brain\32547596-851f-4f9f-92c3-c4c928fa9dae\task.md'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

replacements = [
    ('- [ ] AI-generated chat summary in sourceContext', '- [x] AI-generated chat summary in sourceContext (Skipped - API not available)')
]

for old, new in replacements:
    content = content.replace(old, new)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print('Checked off the final task in task.md!')
