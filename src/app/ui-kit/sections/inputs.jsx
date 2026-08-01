'use client';
import { useState } from 'react';
import Button from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Forms/Textarea';
import { Label, Checkbox, ToggleSwitch, DatePicker, TimePicker, ImageUpload, StatusVisibilityPicker } from '@/components/ui';
import { DEFAULT_STATUSES } from '@/lib/hooks/useWorkflowConfig';
import { Search, User, Calendar, Lock, Eye, EyeOff } from 'lucide-react';
import { PreviewBlock } from '../preview';

export default function InputsSection() {
  const [val, setVal] = useState('');
  const [pw, setPw] = useState('');
  const [show, setShow] = useState(false);
  const [chk, setChk] = useState(false);
  const [tgl, setTgl] = useState(true);
  const [dateSingle, setDateSingle] = useState('');
  const [timeSingle, setTimeSingle] = useState('09:00');
  const [hiddenStatusIds, setHiddenStatusIds] = useState(['done']);

  return (
    <div className="flex flex-col gap-[32px]">
      <PreviewBlock title="Named Input sizes — sm / md / lg" component="Input" description="Три живі висоти для Input та суміжних controls: sm 28px, md 32px, lg 36px. lg є стандартом за замовчуванням." fullWidth>
        <div className="max-w-[400px] flex flex-col gap-[12px]">
          <Input size="sm" placeholder="Small — 28px" />
          <Input size="md" placeholder="Medium — 32px" />
          <Input size="lg" placeholder="Large — 36px" value={val} onChange={e => setVal(e.target.value)} />
          <Input size="md" preset="money" suffix="₴/г" type="number" defaultValue="125" aria-label="Грошове значення" />
          <Input size="lg" placeholder="Заблоковане поле" disabled />
        </div>
      </PreviewBlock>

      <PreviewBlock title="Checkbox & Toggle" component="ToggleSwitch" description="Ті самі Checkbox і ToggleSwitch, які зараз використовує продукт.">
        <div className="flex items-center gap-[24px] flex-wrap">
          <Checkbox checked={chk} onChange={setChk} label="Я погоджуюся з умовами" id="chk-demo" />
          <ToggleSwitch checked={tgl} onChange={setTgl} label="Активний спринт" />
        </div>
      </PreviewBlock>

      <PreviewBlock title="Project Status Visibility" description="Shared picker для створення й налаштувань проєкту. Беклог заблокований як обов’язкова fallback-колонка." fullWidth>
        <div className="max-w-[520px]">
          <StatusVisibilityPicker
            statuses={DEFAULT_STATUSES}
            hiddenStatusIds={hiddenStatusIds}
            onChange={setHiddenStatusIds}
          />
        </div>
      </PreviewBlock>

      <PreviewBlock title="Date & Time Pickers" description="Живі DatePicker і TimePicker, які використовуються у задачах, календарі та налаштуваннях." fullWidth>
        <div className="grid max-w-[532px] gap-3 sm:grid-cols-2">
          <div>
            <label className="text-[11px] font-bold text-[#9a9a9a] uppercase tracking-wider mb-[6px] block">Оберіть дату</label>
            <DatePicker value={dateSingle} onChange={setDateSingle} placeholder="Оберіть день..." />
          </div>
          <div>
            <label className="text-[11px] font-bold text-[#9a9a9a] uppercase tracking-wider mb-[6px] block">Оберіть час</label>
            <TimePicker value={timeSingle} onChange={setTimeSingle} aria-label="Демонстраційний час" />
          </div>
        </div>
      </PreviewBlock>

      <PreviewBlock title="Brand image upload" description="Фактичний світлий ImageUpload із налаштувань профілю та брендування." filePath="src/app/(app)/settings/page.js" fullWidth>
        <div className="max-w-[380px] rounded-[16px] border border-line bg-white p-[20px]">
          <ImageUpload value="/favicon.ico" onChange={() => {}} theme="light" />
        </div>
      </PreviewBlock>

      <PreviewBlock title="With Icon" description="icon prop — Search, Calendar, User, etc." fullWidth>
        <div className="flex flex-col gap-[10px] max-w-[400px]">
          <Input placeholder="Пошук..." icon={Search} />
          <Input placeholder="Email адреса" icon={User} />
          <Input placeholder="Дата" icon={Calendar} />
        </div>
      </PreviewBlock>

      <PreviewBlock title="Password / Toggle" description="Pattern for password fields with show/hide toggle." fullWidth>
        <div className="max-w-[400px]">
          <div className="relative">
            <Input type={show ? 'text' : 'password'} placeholder="Пароль" value={pw} onChange={e => setPw(e.target.value)} icon={Lock} />
            <button
              onClick={() => setShow(s => !s)}
              className="absolute right-[10px] top-1/2 -translate-y-1/2 text-[#9a9a9a] hover:text-[#1f1f1f] transition-colors"
            >
              {show ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
        </div>
      </PreviewBlock>

      <PreviewBlock title="Validation State" description="error prop shows red border + error message below." fullWidth>
        <div className="max-w-[400px] flex flex-col gap-[10px]">
          <Input placeholder="Email" error="Невірна адреса електронної пошти" defaultValue="bad@" />
          <Input placeholder="Назва проєкту" error="Поле обов'язкове" />
        </div>
      </PreviewBlock>

      <PreviewBlock title="Inline: Input + Button" description="36px input + 36px button — zero-pixel alignment." fullWidth>
        <div className="flex items-center gap-[8px] max-w-[500px]">
          <Input placeholder="Введіть email для запрошення..." icon={User} />
          <Button style="primary" size="lg">Запросити</Button>
        </div>
      </PreviewBlock>

      <PreviewBlock title="Textarea" component="Textarea" description="Багаторядкові текстові області. Кольори: фон #f4f4f5, фокус-рамка #1f1f1f. Скруглення: 10px. Зміна розміру (resize) вимкнена за замовчуванням." fullWidth>
        <div className="max-w-[500px] flex flex-col gap-[10px]">
          <Textarea placeholder="Опис завдання або проєкту..." rows={3} />
          <Textarea placeholder="Великий опис..." rows={6} />
        </div>
      </PreviewBlock>

      <PreviewBlock title="Form label pattern" component="Label" description="Always 11px, bold, uppercase, tracking-wider, color #9a9a9a." fullWidth>
        <div className="max-w-[400px] flex flex-col gap-[16px]">
          <div>
            <Label htmlFor="kit-project-name" required className="mb-[6px] block">Назва проєкту</Label>
            <Input id="kit-project-name" placeholder="Наприклад: Редизайн сайту" />
          </div>
          <div>
            <Label htmlFor="kit-project-description" className="mb-[6px] block">Опис</Label>
            <Textarea id="kit-project-description" placeholder="Короткий опис..." rows={3} />
          </div>
        </div>
      </PreviewBlock>
    </div>
  );
}
