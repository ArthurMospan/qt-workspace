import sys

path = r'c:\Users\Arthu\QuickTeam\qt-workspace\src\components\workspace\IssueCard.jsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

target = '''            {/* Due date */}
            {due && (
              <div className={`flex items-center gap-[5px] mb-[12px] text-[11px] font-semibold ${
                isOverdue ? 'text-[#ef4444]' : 'text-[#9a9a9a]'
              }`}>
                <Calendar size={11} strokeWidth={2.5} />
                <span>{fmtDate(due)}</span>
                {isOverdue && <span className="font-bold">• Overdue</span>}
              </div>
            )}'''

replacement = target + '''

            {/* Story Points */}
            {issue.storyPoints > 0 && (
              <div className="flex items-center gap-[4px] mb-[12px] px-2 py-[2px] bg-[#f5f5f5] rounded-md text-[10px] font-bold text-[#1f1f1f] w-fit">
                <span>{issue.storyPoints} SP</span>
              </div>
            )}'''

if target in content:
    new_content = content.replace(target, replacement)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(new_content)
    print('Replaced successfully')
else:
    print('Target not found in IssueCard.jsx')
