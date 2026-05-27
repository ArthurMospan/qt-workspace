import sys
import re

# Fix 1: IssueModal.jsx
path1 = r'c:\Users\Arthu\QuickTeam\qt-workspace\src\components\workspace\IssueModal.jsx'
with open(path1, 'r', encoding='utf-8') as f:
    content1 = f.read()

content1 = content1.replace("import { COLUMNS } from './AgileBoard';", "import { DEFAULT_COLUMNS as COLUMNS } from './BoardConfigModal';")

with open(path1, 'w', encoding='utf-8') as f:
    f.write(content1)

# Fix 2: issue page.js
path2 = r'c:\Users\Arthu\QuickTeam\qt-workspace\src\app\workspace\[projectId]\issue\[issueId]\page.js'
with open(path2, 'r', encoding='utf-8') as f:
    content2 = f.read()

# We can just remove the lines that redefine imports
# Looking at the file, lines 19-20 define:
#  ArrowUp, ArrowDown, MessageSquare, Clock, History,
#  Heart, MessageSquare, Clock, History, PanelRightClose...
# Let's just find "  ArrowUp, ArrowDown, MessageSquare, Clock, History,\n" and remove it

target_to_remove = "  ArrowUp, ArrowDown, MessageSquare, Clock, History,\n"
content2 = content2.replace(target_to_remove, "")

with open(path2, 'w', encoding='utf-8') as f:
    f.write(content2)

print("Fixed imports in both files!")
