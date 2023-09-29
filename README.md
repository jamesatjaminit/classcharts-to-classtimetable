# ClassCharts To ClassTimetable

A small Deno library to convert a ClassCharts timetable to a
[ClassTimetable](https://classtimetable.app/) export.

## Usage

```typescript
import { ClassChartsToClassTimetable } from "https://deno.land/x/classcharts_to_classtimetable/mod.ts";

const client = new ClassChartsToClassTimetable({
  code: "StudentCodeHere",
  dateOfBirth: "DD/MM/YYYY",
});

const xml = await client.generateTimetable({
  numberOfWeeks: 2,
  numberOfDaysInWeek: 5,
});

const encoder = new TextEncoder();
Deno.writeFile(`Timetable.timetable`, encoder.encode(xml));
```
