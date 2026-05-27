import sys

path = r'c:\Users\Arthu\QuickTeam\qt-workspace\src\app\workspace\settings\page.js'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Import deleteDoc
content = content.replace("import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';", 
                          "import { doc, getDoc, setDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';")

# 2. Add orgLogo state
target_orgName = "const [orgName,         setOrgName]         = useState('');"
replace_orgName = "const [orgName,         setOrgName]         = useState('');\n  const [orgLogo,         setOrgLogo]         = useState('');"
content = content.replace(target_orgName, replace_orgName)

# 3. Load orgLogo
target_load_orgName = "if (org?.name && !orgName) setOrgName(org.name);"
replace_load_orgName = "if (org?.name && !orgName) setOrgName(org.name);\n    if (org?.logo && !orgLogo) setOrgLogo(org.logo);"
content = content.replace(target_load_orgName, replace_load_orgName)
# Need to update useEffect dependency for org?.logo
content = content.replace("}, [org?.name]); // eslint-disable-line", "}, [org?.name, org?.logo]); // eslint-disable-line")

# 4. Save orgLogo
target_save_orgName = "await updateDoc(doc(db, 'organizations', activeOrgId), { name: orgName.trim(), updatedAt: serverTimestamp() });"
replace_save_orgName = "await updateDoc(doc(db, 'organizations', activeOrgId), { name: orgName.trim(), logo: orgLogo.trim(), updatedAt: serverTimestamp() });"
content = content.replace(target_save_orgName, replace_save_orgName)

# 5. UI for Logo
target_ui_orgName = '''<Input value={orgName} onChange={setOrgName} className="w-[200px]" />
              </Row>'''
replace_ui_orgName = '''<Input value={orgName} onChange={setOrgName} className="w-[200px]" />
              </Row>
              <Row label="URL Логотипу" desc="Вставте посилання на зображення для вашої організації">
                <Input value={orgLogo} onChange={setOrgLogo} className="w-[300px]" placeholder="https://example.com/logo.png" />
              </Row>'''
content = content.replace(target_ui_orgName, replace_ui_orgName)

# 6. Delete Organization UI
target_delete_btn = '''<button
                  onClick={() => { if (confirm('Вийти з акаунта?')) signOut(); }}
                  className="flex items-center gap-2 text-[12px] font-medium text-[#1f1f1f] hover:text-red-500 transition-colors"
                >
                  <LogOut size={13} /> Вийти
                </button>
              </Row>'''

replace_delete_btn = '''<button
                  onClick={() => { if (confirm('Вийти з акаунта?')) signOut(); }}
                  className="flex items-center gap-2 text-[12px] font-medium text-[#1f1f1f] hover:text-red-500 transition-colors"
                >
                  <LogOut size={13} /> Вийти
                </button>
              </Row>
              <Row label="Видалити організацію" desc="Незворотня дія. Видаляє всі дані організації." danger>
                <button
                  onClick={async () => {
                    if (confirm('Ви впевнені, що хочете видалити організацію НАЗАВЖДИ?')) {
                      await deleteDoc(doc(db, 'organizations', activeOrgId));
                      window.location.href = '/workspace';
                    }
                  }}
                  className="flex items-center gap-2 text-[12px] font-bold text-red-500 hover:text-red-600 transition-colors"
                >
                  <Trash2 size={13} /> Видалити Організацію
                </button>
              </Row>'''
content = content.replace(target_delete_btn, replace_delete_btn)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
print("Updated settings/page.js")
