import { Command } from "https://deno.land/x/cliffy@v1.0.0-rc.3/command/mod.ts";
import { colors } from "https://deno.land/x/cliffy@v1.0.0-rc.3/ansi/mod.ts";

import { ClassChartsToClassTimetable } from "./mod.ts";

await new Command()
  .name("classcharts-to-classtimetable")
  .version("0.2.1")
  .description("ClassCharts timetable converter to ClassTimetable.app")
  .option("-c, --code <code:string>", "ClassCharts code", {
    required: true,
  })
  .env("CLASSCHARTS_CODE=<code:string>", "ClassCharts code")
  .option("-d, --dob <dateOfBirth:string>", "Date of birth")
  .env("CLASSCHARTS_DOB=<dateOfBirth:string>", "Date of birth")
  .option(
    "-w, --number-of-weeks <weeks:number>",
    "Number of weeks in timetable cycle",
    {
      required: true,
    },
  )
  .option(
    "-D, --number-of-days <days:number>",
    "Number of days in one timetable week",
    {
      default: 5,
    },
  )
  .option("-t, --title-template <template:string>", "Lessson title template")
  .option("-i, --info-template <template:string>", "Lesson info template")
  .option("-o, --out <path:string>", "Output to file")
  .option("-s, --silent", "Suppress console messages")
  .action(
    async (
      {
        code,
        dob,
        numberOfWeeks,
        numberOfDays,
        titleTemplate,
        infoTemplate,
        out,
        silent,
      },
      ..._args
    ) => {
      const client = new ClassChartsToClassTimetable({
        code: code,
        dateOfBirth: dob,
      });
      const xml = await client.generateTimetable({
        numberOfWeeks: numberOfWeeks,
        numberOfDaysInWeek: numberOfDays,
        templates: {
          title: titleTemplate,
          info: infoTemplate,
        },
      });
      if (typeof out == "undefined") {
        console.log(xml);
      } else {
        const encoder = new TextEncoder();
        Deno.writeFile(out, encoder.encode(xml));
        if (!silent) {
          console.log(
            colors.green("Success!") + " Written timetable to " + out,
          );
        }
      }
    },
  )
  .parse(Deno.args);
