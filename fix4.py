import sys

path = r'c:\Users\Arthu\QuickTeam\qt-workspace\src\app\workspace\chat\page.js'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add states
state_target = "const [messageText, setMessageText] = useState('');"
state_replace = state_target + '''
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');'''

if state_target in content:
    content = content.replace(state_target, state_replace)

# 2. Update Header
header_target = '''          <div className="flex items-center gap-[16px] text-[#9a9a9a]">
            <button className="hover:text-[#1f1f1f] transition-colors"><Search size={18} /></button>
            <button className="hover:text-[#1f1f1f] transition-colors"><Info size={18} /></button>
          </div>'''

header_replace = '''          <div className="flex items-center gap-[16px] text-[#9a9a9a]">
            {showSearch && (
              <div className="flex items-center bg-[#f5f5f5] rounded-md px-2 py-1">
                <Search size={14} className="text-[#9a9a9a] mr-2" />
                <input type="text" placeholder="Пошук..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="bg-transparent text-[13px] outline-none text-[#1f1f1f] w-[150px]" autoFocus />
                <button onClick={() => { setShowSearch(false); setSearchQuery(''); }} className="ml-2 text-[#9a9a9a] hover:text-[#1f1f1f]"><X size={14} /></button>
              </div>
            )}
            {!showSearch && <button onClick={() => setShowSearch(true)} className="hover:text-[#1f1f1f] transition-colors"><Search size={18} /></button>}
            <button className="hover:text-[#1f1f1f] transition-colors"><Info size={18} /></button>
          </div>'''

if header_target in content:
    content = content.replace(header_target, header_replace)

# 3. Filter messages
messages_target = 'messages.map((msg, i) => {'
messages_replace = '''(searchQuery.trim() ? messages.filter(m => m.text?.toLowerCase().includes(searchQuery.toLowerCase())) : messages).map((msg, i, arr) => {
               const prevMsg = arr[i - 1];'''
if messages_target in content:
    content = content.replace(messages_target, messages_replace)
    # Let's fix the prevMsg line manually
    content = content.replace('const prevMsg = messages[i - 1];', '')

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
print('Search added!')
