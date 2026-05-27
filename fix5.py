import sys

path = r'c:\Users\Arthu\QuickTeam\qt-workspace\src\app\workspace\[projectId]\issue\[issueId]\page.js'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update handleTimerToggle
timer_target = "if (result?.minutes > 0) setLogForm({ minutes: result.minutes, desc: '' });"
timer_replace = "if (result?.minutes > 0) setLogForm({ minutes: result.minutes, desc: '', workType: 'development' });"
if timer_target in content:
    content = content.replace(timer_target, timer_replace)

# 2. Update manual log button (if exists) -> I will just do it safely where it's initialized.
# But wait, there might be a manual "Add time" button that sets logForm. Let's find it.
manual_target = "onClick={() => setLogForm({ minutes: 0, desc: '' })}"
manual_replace = "onClick={() => setLogForm({ minutes: 0, desc: '', workType: 'development' })}"
if manual_target in content:
    content = content.replace(manual_target, manual_replace)

# 3. Update handleLogTime
log_time_target = "await addTimeLog(issueId, projectId, uid, logForm.minutes, logForm.desc);"
log_time_replace = "await addTimeLog(issueId, projectId, uid, logForm.minutes, logForm.desc, logForm.workType);"
if log_time_target in content:
    content = content.replace(log_time_target, log_time_replace)

# 4. Update the logForm UI
ui_target = '''                  <input type="text" placeholder="Опис (необов'язк.)"
                    value={logForm.desc}
                    onChange={e => setLogForm(f => ({ ...f, desc: e.target.value }))}
                    className="text-[11px] bg-[#f7f7f7] rounded-[6px] px-2 py-[4px] outline-none w-full"
                  />
                  <div className="flex gap-2">'''
ui_replace = '''                  <input type="text" placeholder="Опис (необов'язк.)"
                    value={logForm.desc}
                    onChange={e => setLogForm(f => ({ ...f, desc: e.target.value }))}
                    className="text-[11px] bg-[#f7f7f7] rounded-[6px] px-2 py-[4px] outline-none w-full"
                  />
                  <select
                    value={logForm.workType || 'development'}
                    onChange={e => setLogForm(f => ({ ...f, workType: e.target.value }))}
                    className="text-[11px] font-medium bg-[#f7f7f7] rounded-[6px] px-2 py-[4px] outline-none w-full cursor-pointer text-[#1f1f1f]"
                  >
                    <option value="development">Development</option>
                    <option value="design">Design</option>
                    <option value="analytics">Analytics</option>
                    <option value="testing">Testing</option>
                    <option value="management">Management</option>
                  </select>
                  <div className="flex gap-2">'''
if ui_target in content:
    content = content.replace(ui_target, ui_replace)
else:
    print("Warning: UI target not found. Might need to adjust text match.")

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
print('Updated time log UI with workType!')
