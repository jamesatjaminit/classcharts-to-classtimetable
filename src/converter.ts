import { Lesson, StudentClient } from "./deps.ts";
import { dayjs } from "./deps.ts";
dayjs.locale("en-gb");
import { plist } from "./deps.ts";
import { getRandomInt } from "./utils.ts";

type LessonsObject = (Lesson)[][];
export interface GenerateTimetableOptions {
  /**
   * Date to begin the timetable in format YYYY-MM-DD. Defaults to the start of the current week.
   */
  startDate?: string;
  /**
   * Number of days in a school week.
   * @default 5
   */
  numberOfWeeks: number;
  /**
   * Number of weeks in timetable cycle.
   */
  numberOfDaysInWeek?: number;
}

export interface ClassChartsToClassTimetableOptions {
  /**
   * ClassCharts student code. Usually given by the student's school.
   */
  code: string;
  /**
   * The student's date of birth, in format DD/MM/YYYY.
   */
  dateOfBirth?: string;
}

export class ClassChartsToClassTimetable {
  private StudentClient: StudentClient;
  constructor(authOptions: ClassChartsToClassTimetableOptions) {
    this.StudentClient = new StudentClient(
      authOptions.code,
      authOptions.dateOfBirth,
    );
  }
  /**
   * Generates a nested array of lessons for a given period from ClassCharts.
   * @param options See .generateTimetable()
   * @returns Nested array of lessons. One element for each day.
   */
  private async _getAllLessons(
    options: GenerateTimetableOptions,
  ) {
    try {
      await this.StudentClient.login();
    } catch {
      throw new Error(
        "Failed to login to ClassCharts. Check your login details",
      );
    }
    if (!options.numberOfDaysInWeek) {
      options.numberOfDaysInWeek = 5;
    }
    const startDate = options.startDate
      ? dayjs(options.startDate)
      : dayjs().startOf("week");
    let currentDate = startDate;
    const lessons: LessonsObject = [];
    for (
      let weekNumber = 1;
      weekNumber <= options.numberOfWeeks;
      weekNumber++
    ) {
      for (
        let dayNumber = 1;
        dayNumber <= options.numberOfDaysInWeek;
        dayNumber++
      ) {
        const currentDay = [];
        try {
          const currentLessons = await this.StudentClient.getLessons({
            date: currentDate.format("YYYY-MM-DD"),
          });
          for (const lesson of currentLessons.data) {
            currentDay.push(lesson);
          }
        } catch {
          // TODO: warn?
        }
        lessons.push(currentDay);
        currentDate = currentDate.add(1, "day");
      }
      currentDate = currentDate.add(1, "week").startOf("week");
    }
    return lessons;
  }

  /**
   * Generates a ClassTimetable XML export from a nested array of lessons.
   * @param lessonsObject Nested array of lessons. One element for each day.
   * @param options See .generateTimetable()
   * @returns ClassTimetable XML export as a string.
   */
  private _lessonsToXml(
    lessonsObject: LessonsObject,
    options: Omit<GenerateTimetableOptions, "startDate">,
  ) {
    if (!options.numberOfDaysInWeek) {
      options.numberOfDaysInWeek = 5;
    }
    const jsonObject = {
      Settings: {
        // deno-lint-ignore no-explicit-any
        ColorSettings: {} as any,
        NumberOfWeeks: options.numberOfWeeks,
        SelectedWeek: 0,
        SelectedWeekUpdateDate: dayjs().toISOString(),
        WeekendDaysAreActive: options.numberOfDaysInWeek === 7 ? true : false,
      },
      WeekEvents: [] as unknown[],
      TaskCategories: [],
      TaskEvents: [],
    };
    let dayNumber = 1;
    let weekNumber = 1;
    const coloursMap = new Map<string, { r: number; g: number; b: number }>();
    for (const day of lessonsObject) {
      for (const lesson of day) {
        const lessonTitle = `${lesson.subject_name} - ${lesson.room_name}`;
        jsonObject.WeekEvents.push({
          dayNum: dayNumber - 1,
          weekNum: weekNumber - 1,
          title: lessonTitle,
          // The following is a hacky workaround to make the time fields "real" instead of "integer"
          time: (dayjs(lesson.start_time).unix() -
            dayjs(lesson.start_time).startOf("day").unix()) + 0.123456789,
          endTime: (dayjs(lesson.end_time).unix() -
            dayjs(lesson.end_time).startOf("day").unix()) + 0.123456789,
          info:
            `Teacher: ${lesson.teacher_name}\nPeriod Name: ${lesson.period_name}`,
        });
        if (!coloursMap.has(lessonTitle)) {
          coloursMap.set(lessonTitle, {
            r: getRandomInt(0, 255) / 255,
            g: getRandomInt(0, 255) / 255,
            b: getRandomInt(0, 255) / 255,
          });
        }
      }
      dayNumber++;
      if (dayNumber > options.numberOfDaysInWeek) {
        weekNumber++;
        dayNumber = 1;
      }
    }
    for (const lessonTitle of coloursMap.keys()) {
      jsonObject.Settings.ColorSettings[lessonTitle] = Object.values(
        coloursMap.get(lessonTitle)!,
      );
    }
    const plistXml = String(plist.build(jsonObject, { pretty: false }));
    return plistXml.replace(/.123456789/g, "");
  }

  /**
   * Requests the timetable from ClassCharts and transforms it into a ClassTimetable XML export
   * @param options GenerateTimetable object
   * @returns XML string. This should be saved to a [filename].timetable file.
   *
   * ### Basic Example
   * ```typescript
   * import { ClassChartsToClassTimetable } from "./mod.ts";
   * const client = new ClassChartsToClassTimetable({
   *  code: "CODE",
   *  dateOfBirth: 01/01/2000",
   * });
   * const xml = await client.generateTimetable({
   *  numberOfWeeks: 2,
   *  numberOfDaysInWeek: 5,
   * });
   * const encoder = new TextEncoder();
   *
   * Deno.writeFile(`Timetable.timetable`, encoder.encode(xml));
   * ```
   */
  public async generateTimetable(
    options: GenerateTimetableOptions,
  ) {
    const allLessons = await this._getAllLessons({
      startDate: options.startDate,
      numberOfWeeks: options.numberOfWeeks,
      numberOfDaysInWeek: options.numberOfDaysInWeek,
    });
    const xml = this._lessonsToXml(allLessons, {
      numberOfWeeks: options.numberOfWeeks,
      numberOfDaysInWeek: options.numberOfDaysInWeek,
    });
    return xml;
  }
}
