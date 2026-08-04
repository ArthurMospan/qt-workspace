// src/lib/design/icons.js
// The glyph the product uses for each of its own things.
//
// These three were chosen once and then copied into two dozen files by hand, so
// "change the calendar icon" meant finding every `CalendarDays` import and
// hoping none had been missed — and some had: the sidebar, the mobile bar, the
// command palette and the notification list did not always agree. An icon that
// means a feature is a product decision, and a product decision belongs in one
// place, the same way a control height does.
//
// Only the semantic ones live here. A tick that means "this succeeded" and a
// tick that means «Мої завдання» are different decisions that happen to look
// alike, so the first keeps its own icon at its own call site.
import { Calendar, MessageCircle, SquareCheckBig } from 'lucide-react';

/** «Мої завдання», a task, a task list. A tick in a rounded square. */
export const TaskIcon = SquareCheckBig;

/** «Календар», a calendar event, a date range. The grid without its dots. */
export const CalendarIcon = Calendar;

/** «Чат», a message, a comment. The round bubble, not the square one. */
export const ChatIcon = MessageCircle;
