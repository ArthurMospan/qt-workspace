import sys

path = r'c:\Users\Arthu\QuickTeam\qt-workspace\src\app\workspace\team\page.js'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update MemberDetailPanel definition
target1 = "function MemberDetailPanel({ member, projects, onClose, isMe, isOwner, changeMemberRole, removeMember }) {"
replace1 = "function MemberDetailPanel({ member, projects, onClose, isMe, isOwner, changeMemberRole, removeMember, setMemberRate }) {"
if target1 in content:
    content = content.replace(target1, replace1)

# 2. Update where MemberDetailPanel is used
target2 = "changeMemberRole={changeMemberRole}"
replace2 = "changeMemberRole={changeMemberRole}\n            setMemberRate={setMemberRate}"
if target2 in content:
    content = content.replace(target2, replace2)

# 3. Add useOrganization hook destructing setMemberRate
target3 = "const { org, members, loading, inviteMember, changeMemberRole, removeMember } = useOrganization();"
replace3 = "const { org, members, loading, inviteMember, changeMemberRole, removeMember, setMemberRate } = useOrganization();"
if target3 in content:
    content = content.replace(target3, replace3)

# 4. Add Hourly Rate input to MemberDetailPanel
target4 = '''            <div className="flex flex-col gap-2 mb-6">
              <label className="text-[12px] font-bold text-[#1f1f1f]">'''

replace4 = '''            <div className="flex flex-col gap-2 mb-4">
              <label className="text-[12px] font-bold text-[#1f1f1f]">Погодинна ставка (USD)</label>
              <input
                type="number" min="0" step="1"
                value={member.hourlyRate || 0}
                onChange={async e => {
                  try {
                    await setMemberRate(member.id || member.uid, e.target.value);
                    showToast('Ставку оновлено');
                  } catch {
                    showToast('Помилка оновлення', 'error');
                  }
                }}
                className="w-full px-4 py-[12px] bg-[#f7f7f7] border border-[#e9e9e9] rounded-[14px] text-[13px] font-semibold text-[#1f1f1f]"
              />
            </div>
            
            <div className="flex flex-col gap-2 mb-6">
              <label className="text-[12px] font-bold text-[#1f1f1f]">'''

if target4 in content:
    content = content.replace(target4, replace4)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
print("Updated team page with Rate Card UI!")
