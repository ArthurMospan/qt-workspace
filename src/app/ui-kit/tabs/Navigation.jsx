'use client';
import Surface from '@/components/ui/Surface';

export default function NavigationTab() {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-[24px] font-bold text-[#1f1f1f] mb-4">Навігаційні компоненти</h2>
        <Surface padding="lg">
          <p className="text-[14px] text-[#9a9a9a]">
            Breadcrumb, Pagination, Menu, Popover, Tooltip, Stepper — компоненты відключені для оптимізації продуктивності
          </p>
          <div className="mt-6 space-y-2 text-[13px] text-[#1f1f1f]">
            <p>✅ Breadcrumb - навігація з path</p>
            <p>✅ Pagination - навігація сторінками</p>
            <p>✅ Stepper - кроки процесу</p>
            <p>✅ Menu - випадаюче меню</p>
            <p>✅ Popover - спливаючі вікна</p>
            <p>✅ Tooltip - підказки при наведенні</p>
          </div>
        </Surface>
      </div>
    </div>
  );
}
