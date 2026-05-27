import sys, io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

path = r'c:\Users\Arthu\QuickTeam\qt-workspace\src\app\workspace\[projectId]\issue\[issueId]\page.js'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

start_str = '<p className="text-[8px] font-bold text-[#cfcfcf] uppercase tracking-widest mb-[5px]">Дедлайн</p>'
idx1 = content.find(start_str)
if idx1 == -1:
    print('Failed to find start_str')
    sys.exit(1)

start_grid = content.rfind('<div className="grid', 0, idx1)
if start_grid == -1:
    start_grid = content.rfind('<div>', 0, idx1)

end_str = '{/* Parent Epic */}'
idx2 = content.find(end_str)
if idx2 == -1:
    print('Failed to find end_str')
    sys.exit(1)

new_block = '''<div className="grid grid-cols-3 gap-2">
            <div>
              <p className="text-[8px] font-bold text-[#cfcfcf] uppercase tracking-widest mb-[5px]">Дедлайн</p>
              {isEditing ? (
                <input type="date" value={draft.dueDate || ''}
                  onChange={e => setDraft(d => ({ ...d, dueDate: e.target.value }))}
                  className="w-full text-[10px] font-semibold bg-[#f5f5f5] rounded-[7px] px-2 py-[4px] outline-none border border-transparent focus:border-[#e9e9e9] cursor-pointer"
                />
              ) : (
                <div className={`text-[10px] font-semibold px-2 py-[4px] rounded-[7px] ${
                  isOverdue ? 'bg-red-50 text-red-600' : due ? 'bg-[#f5f5f5] text-[#1f1f1f]' : 'bg-[#f5f5f5] text-[#cfcfcf]'
                }`}>
                  {isOverdue && '⚠️ '}{dueStr || '—'}
                </div>
              )}
            </div>
            <div>
              <p className="text-[8px] font-bold text-[#cfcfcf] uppercase tracking-widest mb-[5px]">Оцінка</p>
              {isEditing ? (
                <div className="flex items-center gap-1 bg-[#f5f5f5] rounded-[7px] px-2 py-[4px]">
                  <input type="number" min="0" step="0.5"
                    value={draft.estimateMinutes ? (draft.estimateMinutes / 60).toFixed(1).replace('.0', '') : ''}
                    onChange={e => setDraft(d => ({ ...d, estimateMinutes: Math.round(parseFloat(e.target.value || '0') * 60) }))}
                    placeholder="0"
                    className="w-full text-[10px] font-semibold bg-transparent outline-none text-[#1f1f1f]"
                  />
                  <span className="text-[8px] text-[#cfcfcf] shrink-0">год</span>
                </div>
              ) : (
                <div className="text-[10px] font-semibold px-2 py-[4px] rounded-[7px] bg-[#f5f5f5] text-[#1f1f1f]">
                  {estimMin ? fmtMin(estimMin) : '—'}
                </div>
              )}
            </div>
            <div>
              <p className="text-[8px] font-bold text-[#cfcfcf] uppercase tracking-widest mb-[5px]">Story Points</p>
              {isEditing ? (
                <input type="number" min="0" step="1"
                  value={draft.storyPoints || ''}
                  onChange={e => setDraft(d => ({ ...d, storyPoints: e.target.value ? parseInt(e.target.value) : null }))}
                  placeholder="0"
                  className="w-full text-[10px] font-semibold bg-[#f5f5f5] rounded-[7px] px-2 py-[4px] outline-none border border-transparent focus:border-[#e9e9e9] cursor-pointer"
                />
              ) : (
                <div className="text-[10px] font-semibold px-2 py-[4px] rounded-[7px] bg-[#f5f5f5] text-[#1f1f1f]">
                  {issue.storyPoints || '—'}
                </div>
              )}
            </div>
          </div>

          '''

new_content = content[:start_grid] + new_block + content[idx2:]
with open(path, 'w', encoding='utf-8') as f:
    f.write(new_content)
print('Fixed layout successfully!')
