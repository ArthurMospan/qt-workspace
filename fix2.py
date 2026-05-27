import sys

path = r'c:\Users\Arthu\QuickTeam\qt-workspace\src\components\workspace\IssueModal.jsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

target = '''            {/* Estimate */}
            <div>
              <p className="text-[10px] font-bold text-[#9a9a9a] uppercase tracking-wide mb-2">Оцінка (год)</p>
              <input type="number" min="0" step="0.5"
                value={issue.estimateMinutes ? issue.estimateMinutes / 60 : ''}
                onChange={e => onUpdate({ estimateMinutes: Math.round(parseFloat(e.target.value || 0) * 60) })}
                placeholder="0"
                className="w-full px-3 py-[7px] rounded-[8px] text-[12px] font-medium border border-[#e9e9e9] bg-white text-[#1f1f1f]"
              />
            </div>'''

replacement = target + '''

            {/* Story Points */}
            <div>
              <p className="text-[10px] font-bold text-[#9a9a9a] uppercase tracking-wide mb-2">Story Points</p>
              <input type="number" min="0" step="1"
                value={issue.storyPoints || ''}
                onChange={e => onUpdate({ storyPoints: e.target.value ? parseInt(e.target.value) : null })}
                placeholder="0"
                className="w-full px-3 py-[7px] rounded-[8px] text-[12px] font-medium border border-[#e9e9e9] bg-white text-[#1f1f1f]"
              />
            </div>'''

if target in content:
    new_content = content.replace(target, replacement)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(new_content)
    print('Replaced successfully')
else:
    print('Target not found in IssueModal.jsx')
