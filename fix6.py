import sys

path = r'c:\Users\Arthu\QuickTeam\qt-workspace\src\app\workspace\[projectId]\issue\[issueId]\page.js'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

target = '''                  />
                  <div className="flex gap-2">
                    <button onClick={handleLogTime}'''

replace = '''                  />
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
                  <div className="flex gap-2">
                    <button onClick={handleLogTime}'''

if target in content:
    content = content.replace(target, replace)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print('Updated UI successfully!')
else:
    print('Target not found!')
