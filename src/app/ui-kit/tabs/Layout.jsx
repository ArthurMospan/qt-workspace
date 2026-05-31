'use client';
import Surface from '@/components/ui/Surface';
import Card from '@/components/ui/Layout/Card';

export default function LayoutTab() {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-[24px] font-bold text-[#1f1f1f] mb-4">Layout Components</h2>
        <div className="grid grid-cols-2 gap-4">
          <Card variant="white" padding="lg">
            <h3 className="text-[16px] font-bold text-[#1f1f1f] mb-2">Card 1</h3>
            <p className="text-[13px] text-[#9a9a9a]">Макет карточки</p>
          </Card>
          <Card variant="white" padding="lg">
            <h3 className="text-[16px] font-bold text-[#1f1f1f] mb-2">Card 2</h3>
            <p className="text-[13px] text-[#9a9a9a]">Макет карточки</p>
          </Card>
          <Card variant="white" padding="lg">
            <h3 className="text-[16px] font-bold text-[#1f1f1f] mb-2">Card 3</h3>
            <p className="text-[13px] text-[#9a9a9a]">Макет карточки</p>
          </Card>
          <Card variant="white" padding="lg">
            <h3 className="text-[16px] font-bold text-[#1f1f1f] mb-2">Card 4</h3>
            <p className="text-[13px] text-[#9a9a9a]">Макет карточки</p>
          </Card>
        </div>
      </div>

      <div>
        <h2 className="text-[24px] font-bold text-[#1f1f1f] mb-4">Компоненты макету</h2>
        <Surface padding="lg" className="text-[13px] text-[#1f1f1f] space-y-2">
          <p>✅ Container - обгортка контенту</p>
          <p>✅ Grid - розірідна сітка</p>
          <p>✅ ListItem - елемент списку</p>
          <p>✅ Table - таблиця</p>
          <p>✅ Card - карточка з тінню</p>
          <p>✅ Panel - панель контенту</p>
          <p>✅ Flex - flex обгортка</p>
        </Surface>
      </div>
    </div>
  );
}
