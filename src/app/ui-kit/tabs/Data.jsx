'use client';
import Badge from '@/components/ui/DataDisplay/Badge';
import Tag from '@/components/ui/DataDisplay/Tag';
import Avatar from '@/components/ui/DataDisplay/Avatar';
import Progress from '@/components/ui/DataDisplay/Progress';
import StatusBadge from '@/components/ui/DataDisplay/StatusBadge';
import Surface from '@/components/ui/Surface';

export default function DataTab() {
  return (
    <div className="space-y-8">
      {/* Badges */}
      <div>
        <h2 className="text-[24px] font-bold text-[#1f1f1f] mb-4">Badges (3 розміри, 6 варіантів)</h2>
        <Surface padding="lg">
          <div className="space-y-4">
            <div className="flex gap-2 flex-wrap">
              <Badge variant="default">Default SM</Badge>
              <Badge variant="success">Success SM</Badge>
              <Badge variant="warning">Warning SM</Badge>
              <Badge variant="danger">Danger SM</Badge>
            </div>
          </div>
        </Surface>
      </div>

      {/* Tags */}
      <div>
        <h2 className="text-[24px] font-bold text-[#1f1f1f] mb-4">Tags (Removable)</h2>
        <Surface padding="lg" className="flex gap-2 flex-wrap">
          <Tag label="Vue" onRemove={() => {}} />
          <Tag label="React" onRemove={() => {}} />
          <Tag label="Angular" onRemove={() => {}} />
          <Tag label="Svelte" onRemove={() => {}} />
        </Surface>
      </div>

      {/* Avatars */}
      <div>
        <h2 className="text-[24px] font-bold text-[#1f1f1f] mb-4">Avatars (4 розміри)</h2>
        <Surface padding="lg" className="flex gap-4 items-end">
          <Avatar initials="AB" size="sm" />
          <Avatar initials="JD" size="md" />
          <Avatar initials="MS" size="lg" />
          <Avatar initials="CJ" size="xl" />
        </Surface>
      </div>

      {/* Progress Bars */}
      <div>
        <h2 className="text-[24px] font-bold text-[#1f1f1f] mb-4">Progress Bars (3 розміри, 4 варіанти)</h2>
        <Surface padding="lg" className="space-y-4">
          <div>
            <p className="text-[13px] font-semibold text-[#1f1f1f] mb-2">Малі (4px)</p>
            <Progress value={30} variant="default" size="sm" />
            <Progress value={60} variant="success" size="sm" />
            <Progress value={90} variant="warning" size="sm" />
          </div>
          <div>
            <p className="text-[13px] font-semibold text-[#1f1f1f] mb-2">Стандартні (6px)</p>
            <Progress value={45} variant="default" size="md" />
            <Progress value={75} variant="success" size="md" />
          </div>
        </Surface>
      </div>

      {/* Status Badges */}
      <div>
        <h2 className="text-[24px] font-bold text-[#1f1f1f] mb-4">Status Badges (для завдань)</h2>
        <Surface padding="lg" className="flex gap-2 flex-wrap">
          <StatusBadge status="todo" />
          <StatusBadge status="in-progress" />
          <StatusBadge status="done" />
          <StatusBadge status="blocked" />
        </Surface>
      </div>
    </div>
  );
}
