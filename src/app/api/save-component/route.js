import fs from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';

const MAPPINGS = {
  Button: 'src/components/ui/Button.jsx',
  Badge: 'src/components/ui/Badge.jsx',
  Input: 'src/components/ui/Input.jsx',
  Select: 'src/components/ui/Select.jsx',
  Tabs: 'src/components/ui/Tabs.jsx',
  DatePicker: 'src/components/ui/Forms/DatePicker.jsx',
  ToggleSwitch: 'src/components/ui/Forms/ToggleSwitch.jsx',
  Textarea: 'src/components/ui/Forms/Textarea.jsx',
  Card: 'src/components/ui/Layout/Card.jsx',
  Dialog: 'src/components/ui/Dialog.jsx',
};

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const component = searchParams.get('component');

    if (!component || !MAPPINGS[component]) {
      return NextResponse.json({ error: 'Invalid component name' }, { status: 400 });
    }

    const filePath = path.join(process.cwd(), MAPPINGS[component]);
    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    const code = fs.readFileSync(filePath, 'utf8');
    return NextResponse.json({ code });
  } catch (error) {
    console.error('Error reading component:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { component, code } = await request.json();

    if (!component || !MAPPINGS[component]) {
      return NextResponse.json({ error: 'Invalid component name' }, { status: 400 });
    }

    if (!code) {
      return NextResponse.json({ error: 'Code is required' }, { status: 400 });
    }

    const filePath = path.join(process.cwd(), MAPPINGS[component]);
    
    // Write code to file
    fs.writeFileSync(filePath, code, 'utf8');

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error writing component:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
