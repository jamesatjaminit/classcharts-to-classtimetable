# ClassCharts To ClassTimetable

A small Deno library to convert a ClassCharts timetable to a
[ClassTimetable](https://classtimetable.app/) export.

## CLI Usage

```bash
deno run --allow-net --allow-write https://deno.land/x/classcharts_to_classtimetable/cli.ts \
  --code "StudentCodeHere" \
  --dob "DD/MM/YYYY" \
  --number-of-weeks 2 \
  --out Timetable.timetable
```

For a list of all options use:

```bash
deno run https://deno.land/x/classcharts_to_classtimetable/cli.ts --help
```

## Library Usage

```typescript
import { ClassChartsToClassTimetable } from "https://deno.land/x/classcharts_to_classtimetable/mod.ts";

const client = new ClassChartsToClassTimetable({
  code: "StudentCodeHere",
  dateOfBirth: "DD/MM/YYYY",
});

const xml = await client.generateTimetable({
  numberOfWeeks: 2,
  numberOfDaysInWeek: 5,
  templates: {
    title: "",
    info: "",
  }, // Optional templates, see below
});

const encoder = new TextEncoder();
Deno.writeFile(`Timetable.timetable`, encoder.encode(xml));
```

## Templates

Templates can be used to customise the output of each lesson. The defaults are:

- Title: "%s - %r"
  - E.g. "Computer Science - 1.1"
- Info: "%t\n%pn"
  - E.g. "Mr. Smith\nPeriod 1"

### Available Variables

| Variable | Description           |
| -------- | --------------------- |
| %t       | Teacher name          |
| %n       | Lesson name           |
| %s       | Subject name          |
| %a       | Is alternative lesson |
| %pn      | Period name           |
| %pnum    | Period number         |
| %r       | Room name             |
| %d       | Lesson date           |
| %st      | Lesson start time     |
| %et      | Lesson end time       |
| %k       | Lesson key            |
| %na      | Lesson note abstract  |
| %no      | Lesson note           |
| %pna     | Pupil note abstract   |
| %pnote   | Pupil note            |
| $pnr     | Pupil note raw        |
