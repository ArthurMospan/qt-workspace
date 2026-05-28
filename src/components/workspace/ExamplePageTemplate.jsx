'use client';
// Example: How to structure workspace pages using the UI Kit
// This template demonstrates the strict design rules in action

import PageLayout from '@/components/ui/PageLayout';
import Tabs from '@/components/ui/Tabs';
import Surface from '@/components/ui/Surface';
import Stack from '@/components/ui/Stack';
import Spacer from '@/components/ui/Spacer';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Plus, Settings } from 'lucide-react';

export default function ExamplePageTemplate() {
  // ──────────────────────────────────────────────────────────────────────────
  // STEP 1: Create the page header
  // This sits at the top with white background and border separation
  // ──────────────────────────────────────────────────────────────────────────
  const header = (
    <div className="px-[32px] py-[20px] flex items-center justify-between gap-4">
      {/* Left: Title */}
      <div>
        <h1 className="text-[24px] font-bold text-[#1f1f1f]">Page Title</h1>
        <p className="text-[13px] text-[#9a9a9a] mt-1">Subtitle or description here</p>
      </div>

      {/* Right: Actions */}
      <Stack direction="horizontal" gap="md">
        <Button variant="secondary" size="md" icon={Settings}>Settings</Button>
        <Button variant="primary" size="lg" icon={Plus}>Action Button</Button>
      </Stack>
    </div>
  );

  // ──────────────────────────────────────────────────────────────────────────
  // STEP 2: Render using PageLayout
  // PageLayout enforces: white bg, px-8 padding, proper scrolling
  // ──────────────────────────────────────────────────────────────────────────
  return (
    <PageLayout header={header}>
      {/* Content is automatically: white bg, px-8 padding, scrollable */}

      {/* ────────────────────────────────────────────────────────────────────── */
      {/* Section 1: Tabs */}
      {/* ────────────────────────────────────────────────────────────────────── */}
      <div className="mb-[24px]">
        <Tabs
          tabs={[
            { id: 'tab1', label: 'Tab 1' },
            { id: 'tab2', label: 'Tab 2' },
            { id: 'tab3', label: 'Tab 3' },
          ]}
          activeTab={'tab1'}
          onTabChange={(id) => console.log('Tab changed:', id)}
        />
      </div>

      {/* ────────────────────────────────────────────────────────────────────── */}
      {/* Section 2: Form Inputs */}
      {/* Rule: All inputs are 36px (h-9), all buttons are 36px (h-9) or 32px (h-8) */}
      {/* ────────────────────────────────────────────────────────────────────── */}
      <div className="mb-[24px]">
        <h2 className="text-[18px] font-bold text-[#1f1f1f] mb-4">Form Example</h2>
        <Surface variant="card" padding="lg">
          <Stack direction="vertical" gap="lg">
            <div>
              <label className="text-[11px] font-bold text-[#9a9a9a] block mb-2">Label</label>
              <Input placeholder="Placeholder text..." />
            </div>
            <div className="flex gap-[12px]">
              <Button variant="primary" size="lg" className="flex-1">Save (36px)</Button>
              <Button variant="secondary" size="md" className="flex-1">Cancel (32px)</Button>
            </div>
          </Stack>
        </Surface>
      </div>

      {/* ────────────────────────────────────────────────────────────────────── */}
      {/* Section 3: Content Cards */}
      {/* Rule: Gray surfaces use rounded-2xl (rounded-[16px]), white cards with px-8 padding */}
      {/* ────────────────────────────────────────────────────────────────────── */}
      <div>
        <h2 className="text-[18px] font-bold text-[#1f1f1f] mb-4">Card Grid</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Surface key={i} variant="panel" padding="lg">
              <h3 className="text-[14px] font-bold text-[#1f1f1f] mb-2">Card {i}</h3>
              <p className="text-[13px] text-[#9a9a9a]">Content goes here</p>
            </Surface>
          ))}
        </div>
      </div>

      {/* ────────────────────────────────────────────────────────────────────── */}
      {/* Spacing Rules Applied: */}
      {/* - Page padding: px-[32px] (px-8) ✓ */}
      {/* - Section gaps: mb-[24px] (xxl spacing) ✓ */}
      {/* - Button heights: 36px primary (h-9), 32px secondary (h-8) ✓ */}
      {/* - Input heights: 36px (h-9) ✓ */}
      {/* - Surface radius: 16px rounded-[16px] (rounded-2xl) ✓ */}
      {/* - Typography: 24px h2 (text-2xl), 18px h3 ✓ */}
      {/* ────────────────────────────────────────────────────────────────────── */}
    </PageLayout>
  );
}
