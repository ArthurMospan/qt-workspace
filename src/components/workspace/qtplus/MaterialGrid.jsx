'use client';
import MaterialCard from './MaterialCard';

export default function MaterialGrid({ materials, onOpen }) {
  return (
    // 12px — це відстань між сусідніми картками в сітці з двох-трьох колонок,
    // де вона працює і по горизонталі. Нижче md колонка одна, і той самий зазор
    // між картками на всю ширину читався як злиплий стос; 16px — той самий крок,
    // що й поля панелі навколо сітки.
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-md:gap-4">
      {materials.map((m) => <MaterialCard key={m.id} raw={m} onOpen={onOpen} />)}
    </div>
  );
}
