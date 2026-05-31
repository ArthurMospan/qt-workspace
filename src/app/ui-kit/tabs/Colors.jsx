'use client';
import Surface from '@/components/ui/Surface';

export default function ColorsTab() {
  const colorPalette = [
    { name: 'Dark', hex: '#1f1f1f', desc: 'Основний темний колір' },
    { name: 'Light', hex: '#f4f4f5', desc: 'Легкий фон' },
    { name: 'Surface', hex: '#ffffff', desc: 'Білі поверхні' },
    { name: 'Border', hex: '#e9e9e9', desc: 'Границі' },
    { name: 'Text Muted', hex: '#9a9a9a', desc: 'Приглушений текст' },
    { name: 'Success', hex: '#10b981', desc: 'Успіх' },
    { name: 'Warning', hex: '#eab308', desc: 'Попередження' },
    { name: 'Danger', hex: '#ef4444', desc: 'Небезпека' },
    { name: 'Error', hex: '#f97316', desc: 'Помилка' },
    { name: 'Info', hex: '#6366f1', desc: 'Інформація' },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-[24px] font-bold text-[#1f1f1f] mb-4">Палітра кольорів</h2>
        <div className="grid grid-cols-2 gap-4">
          {colorPalette.map((color) => (
            <Surface key={color.hex} padding="md" className="flex items-center gap-4">
              <div
                style={{ backgroundColor: color.hex }}
                className="w-[64px] h-[64px] rounded-[8px] border border-[#e9e9e9]"
              />
              <div className="flex-1">
                <p className="text-[14px] font-bold text-[#1f1f1f]">{color.name}</p>
                <p className="text-[12px] text-[#9a9a9a]">{color.hex}</p>
                <p className="text-[11px] text-[#9a9a9a] mt-1">{color.desc}</p>
              </div>
            </Surface>
          ))}
        </div>
      </div>
    </div>
  );
}
