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
  /**
   * Templates to customise the output of each lesson
   */
  templates?: {
    /**
     * Title template
     * @default "%s - %r"
     */
    title?: string;
    /**
     * Info template
     * @default "%t\n%pn"
     */
    info?: string;
  };
  /**
   * Custom generators functions to customise the output of each lesson.
   */
  generators?: {
    /**
     * Custom function to generate lesson colour.
     * @param lessonTitle Lesson title
     * @returns Object containing RGB values. All values should be between 0 and 1.
     */
    colour?: (lessonTitle: string) => {
      r: number;
      g: number;
      b: number;
    };
    /**
     * Custom function to generate lesson body. This function takes priority over templates.
     * @param lesson Lesson object
     * @returns Object containing lesson title and body
     * @see templates
     */
    lessonBody?: (
      lesson: Lesson,
    ) => {
      title: string;
      info: string;
    };
  };
}

/**
 * Type of GenerateTimetableOptions with default values filled in.
 * Used in internal functions which are called by the public generateTimetable() function.
 * Since generateTimetable() sets default values.
 */
type DefaultedGenerateTimetableOptions = GenerateTimetableOptions & {
  numberOfDaysInWeek: NonNullable<
    GenerateTimetableOptions["numberOfDaysInWeek"]
  >;
};

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
    options: Omit<
      DefaultedGenerateTimetableOptions,
      "templates" | "generators"
    >,
  ) {
    try {
      await this.StudentClient.login();
    } catch {
      throw new Error(
        "Failed to login to ClassCharts. Check your login details",
      );
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
        try {
          const currentLessons = await this.StudentClient.getLessons({
            date: currentDate.format("YYYY-MM-DD"),
          });
          const currentDay = currentLessons.data;
          lessons.push(currentDay);
        } catch {
          lessons.push([]);
          // TODO: warn?
        }
        currentDate = currentDate.add(1, "day");
      }
      currentDate = currentDate.add(1, "week").startOf("week");
    }
    return lessons;
  }
  /**
   * Generates a lesson text object from a lesson and template object.
   * @param lesson Lesson to generate text from
   * @param templates Templates to use to generate text
   * @returns Template object
   */
  private _generateLessonTextFromLesson(
    lesson: Lesson,
    templates: NonNullable<GenerateTimetableOptions["templates"]>,
  ) {
    const keys = ["title", "info"] as const;
    const returned: Record<string, string> = {};
    for (const key of keys) {
      if (typeof templates[key] == "undefined") {
        switch (key) {
          case "title":
            templates[key] = "%s - %r";
            break;
          case "info":
            templates[key] = "%t\n%pn";
            break;
        }
      }
      /**
       * Generates a RegExp to match a given template string.
       * Accounts for when the template is escaped with a backslash.
       * @returns RegExp
       */
      const re = (template: string) => {
        return RegExp(`/(?<!\\)${template}/g`);
      };
      returned[key] = templates[key]!
        .replaceAll(re("%t"), lesson.teacher_name)
        .replaceAll(re("%n"), lesson.lesson_name)
        .replaceAll(re("%s"), lesson.subject_name)
        .replaceAll(re("%a"), String(lesson.is_alternative_lesson))
        .replaceAll(re("%pn"), lesson.period_name)
        .replaceAll(re("%pnum"), lesson.period_number)
        .replaceAll(re("%r"), lesson.room_name)
        .replaceAll(re("%d"), lesson.date)
        .replaceAll(re("%st"), lesson.start_time)
        .replaceAll(re("%et"), lesson.end_time)
        .replaceAll(re("%k"), String(lesson.key))
        .replaceAll(re("%na"), lesson.note_abstract)
        .replaceAll(re("%no"), lesson.note)
        .replaceAll(re("%pna"), lesson.pupil_note_abstract)
        .replaceAll(re("%pnote"), lesson.pupil_note)
        .replaceAll(re("%pnr"), lesson.pupil_note_raw);
    }
    return returned as Required<typeof templates>;
  }
  /**
   * Generates a ClassTimetable XML export from a nested array of lessons.
   * @param lessonsObject Nested array of lessons. One element for each day.
   * @param options See .generateTimetable()
   * @returns ClassTimetable XML export as a string.
   */
  private _lessonsToXml(
    lessonsObject: LessonsObject,
    options: Omit<DefaultedGenerateTimetableOptions, "startDate">,
  ) {
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
        const lessonText = typeof options.generators?.lessonBody === "function" // If a custom lesson body generator is provided, use it
          ? options.generators.lessonBody(lesson)
          : this._generateLessonTextFromLesson(
            lesson,
            options.templates ?? {},
          );
        jsonObject.WeekEvents.push({
          dayNum: dayNumber - 1,
          weekNum: weekNumber - 1,
          title: lessonText.title,
          // The following is a hacky workaround to make the time fields "real" instead of "integer"
          time: (dayjs(lesson.start_time).unix() -
            dayjs(lesson.start_time).startOf("day").unix()) + 0.123456789,
          endTime: (dayjs(lesson.end_time).unix() -
            dayjs(lesson.end_time).startOf("day").unix()) + 0.123456789,
          info: lessonText.info,
        });
        if (!coloursMap.has(lessonText.title)) {
          coloursMap.set(
            lessonText.title,
            typeof options.generators?.colour === "function" // If a custom colour generator is provided, use it
              ? options.generators.colour(lessonText.title)
              : {
                r: getRandomInt(0, 255) / 255,
                g: getRandomInt(0, 255) / 255,
                b: getRandomInt(0, 255) / 255,
              },
          );
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
    const plistXml = String(plist.build(jsonObject, { pretty: false }))
      .replaceAll(/.123456789/g, ""); // Remove the hacky workaround (see above)
    return plistXml;
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
    if (!options.numberOfDaysInWeek) {
      options.numberOfDaysInWeek = 5;
    }
    const allLessons = await this._getAllLessons({
      startDate: options.startDate,
      numberOfWeeks: options.numberOfWeeks,
      numberOfDaysInWeek: options.numberOfDaysInWeek,
    });
    const xml = this._lessonsToXml(allLessons, {
      numberOfWeeks: options.numberOfWeeks,
      numberOfDaysInWeek: options.numberOfDaysInWeek,
      templates: options.templates,
      generators: options.generators,
    });
    return xml;
  }
}
