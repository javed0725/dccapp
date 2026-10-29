import sharp from "sharp";
import cvModule from "@techstark/opencv-js";
import type { OmrAnswer, OmrResponse, OmrSetCode } from "@shared/schema";

const TEMPLATE = {
  width: 1080,
  height: 1509,
  registrationFrame: { left: 80, top: 326, right: 1019, bottom: 691 },
  answerXs: [
    [137, 180, 223, 267],
    [356, 399, 442, 486],
    [575, 618, 662, 706],
  ],
  answerYs: [816, 882, 950, 1016, 1082, 1149, 1215, 1283, 1349, 1415],
  setXs: [776, 846, 916, 986],
  setY: 811,
  rollXs: [764, 811, 858, 905, 952, 999],
  rollYs: [915, 942, 970, 999, 1027, 1055, 1083, 1112, 1140, 1168],
};

const SET_CODES: OmrSetCode[] = ["ক", "খ", "গ", "ঘ"];
const ANSWERS: OmrAnswer[] = ["A", "B", "C", "D"];
const BUBBLE_RADIUS = 8;
const MARKED_THRESHOLD = 0.26;
const AMBIGUOUS_THRESHOLD = 0.12;

type Point = { x: number; y: number };
type BubbleState = "marked" | "blank" | "ambiguous";

export type OmrScan = {
  rollNumber: string | null;
  setCode: OmrSetCode | null;
  responses: OmrResponse[];
};

let openCvPromise: Promise<any> | undefined;

async function getOpenCv(): Promise<any> {
  if (!openCvPromise) {
    openCvPromise = (async () => {
      if (cvModule instanceof Promise) return await cvModule;
      if (cvModule.Mat) return cvModule;
      return await new Promise((resolve) => {
        cvModule.onRuntimeInitialized = () => resolve(cvModule);
      });
    })();
  }
  return openCvPromise;
}

function parseImageData(imageData: unknown): Buffer {
  if (typeof imageData !== "string") {
    throw new Error("Upload a JPG, PNG, or WebP image of the OMR sheet.");
  }
  const match = imageData.match(/^data:image\/(jpeg|jpg|png|webp);base64,([A-Za-z0-9+/=]+)$/i);
  if (!match) throw new Error("The uploaded image format is not supported.");

  const buffer = Buffer.from(match[2], "base64");
  if (buffer.byteLength < 8_000) throw new Error("The image is too small to scan.");
  if (buffer.byteLength > 4_000_000) throw new Error("The compressed image is too large. Choose a smaller photo.");
  return buffer;
}

function sortCorners(points: Point[]): [Point, Point, Point, Point] {
  if (points.length !== 4) throw new Error("The sheet alignment frame could not be detected.");
  const topLeft = points.reduce((best, point) => point.x + point.y < best.x + best.y ? point : best);
  const bottomRight = points.reduce((best, point) => point.x + point.y > best.x + best.y ? point : best);
  const topRight = points.reduce((best, point) => point.x - point.y > best.x - best.y ? point : best);
  const bottomLeft = points.reduce((best, point) => point.x - point.y < best.x - best.y ? point : best);
  return [topLeft, topRight, bottomRight, bottomLeft];
}

function findRegistrationFrame(cv: any, source: any): [Point, Point, Point, Point] {
  const hsv = new cv.Mat();
  const mask1 = new cv.Mat();
  const mask2 = new cv.Mat();
  const mask = new cv.Mat();
  const contours = new cv.MatVector();
  const hierarchy = new cv.Mat();
  const kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(5, 5));
  try {
    cv.cvtColor(source, hsv, cv.COLOR_RGB2HSV);
    const scalarMat = (a: number, b: number, c: number) =>
      new cv.Mat(hsv.rows, hsv.cols, hsv.type(), new cv.Scalar(a, b, c, 0));
    // The sample sheet's red border is the registration frame. Include both
    // ends of the HSV hue range so slightly magenta printed ink still matches.
    const lowerRed = scalarMat(0, 38, 45);
    const upperRed = scalarMat(18, 255, 255);
    const lowerHighRed = scalarMat(162, 38, 45);
    const upperHighRed = scalarMat(180, 255, 255);
    cv.inRange(hsv, lowerRed, upperRed, mask1);
    cv.inRange(hsv, lowerHighRed, upperHighRed, mask2);
    lowerRed.delete();
    upperRed.delete();
    lowerHighRed.delete();
    upperHighRed.delete();
    cv.bitwise_or(mask1, mask2, mask);
    cv.morphologyEx(mask, mask, cv.MORPH_CLOSE, kernel);
    cv.findContours(mask, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);

    const imageArea = source.cols * source.rows;
    const candidates: Array<{ area: number; points: Point[] }> = [];
    for (let index = 0; index < contours.size(); index++) {
      const contour = contours.get(index);
      try {
        const area = cv.contourArea(contour);
        if (area < imageArea * 0.035) continue;
        const rect = cv.boundingRect(contour);
        const ratio = rect.width / rect.height;
        const relativeWidth = rect.width / source.cols;
        const relativeHeight = rect.height / source.rows;
        const relativeTop = rect.y / source.rows;
        if (
          ratio < 2.15 || ratio > 3.05 ||
          relativeWidth < 0.34 ||
          relativeHeight < 0.07 || relativeHeight > 0.34 ||
          relativeTop < 0.08 || relativeTop > 0.62
        ) continue;

        const perimeter = cv.arcLength(contour, true);
        const approximation = new cv.Mat();
        try {
          cv.approxPolyDP(contour, approximation, perimeter * 0.02, true);
          if (approximation.rows !== 4) continue;
          const coords = approximation.data32S as Int32Array;
          const points: Point[] = [];
          for (let i = 0; i < 4; i++) points.push({ x: coords[i * 2], y: coords[i * 2 + 1] });
          candidates.push({ area, points });
        } finally {
          approximation.delete();
        }
      } finally {
        contour.delete();
      }
    }

    candidates.sort((a, b) => b.area - a.area);
    if (!candidates.length) {
      throw new Error("Could not find the sheet's red alignment frame. Keep the full page in view and try a clearer photo.");
    }
    return sortCorners(candidates[0].points);
  } finally {
    hsv.delete();
    mask1.delete();
    mask2.delete();
    mask.delete();
    contours.delete();
    hierarchy.delete();
    kernel.delete();
  }
}

function warpToTemplate(cv: any, source: any): any {
  const corners = findRegistrationFrame(cv, source);
  const { left, top, right, bottom } = TEMPLATE.registrationFrame;
  const sourcePoints = cv.matFromArray(4, 1, cv.CV_32FC2, corners.flatMap((point) => [point.x, point.y]));
  const targetPoints = cv.matFromArray(4, 1, cv.CV_32FC2, [
    left, top,
    right, top,
    right, bottom,
    left, bottom,
  ]);
  const transform = cv.getPerspectiveTransform(sourcePoints, targetPoints);
  const warped = new cv.Mat();
  try {
    cv.warpPerspective(
      source,
      warped,
      transform,
      new cv.Size(TEMPLATE.width, TEMPLATE.height),
      cv.INTER_LINEAR,
      cv.BORDER_CONSTANT,
      new cv.Scalar(255, 255, 255, 255),
    );
    return warped;
  } catch (error) {
    warped.delete();
    throw error;
  } finally {
    sourcePoints.delete();
    targetPoints.delete();
    transform.delete();
  }
}

function detectBubbleCenters(cv: any, warped: any) {
  const gray = new cv.Mat();
  const blurred = new cv.Mat();
  const circles = new cv.Mat();
  try {
    cv.cvtColor(warped, gray, cv.COLOR_RGB2GRAY);
    cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 1.2, 1.2, cv.BORDER_DEFAULT);
    cv.HoughCircles(blurred, circles, cv.HOUGH_GRADIENT, 1, 22, 100, 24, 8, 19);

    const values = circles.data32F as Float32Array;
    const found: Point[] = [];
    for (let i = 0; i + 2 < values.length; i += 3) {
      found.push({ x: values[i], y: values[i + 1] });
    }
    const refine = (expected: Point) => {
      let nearest: Point | null = null;
      let nearestDistance = 10;
      for (const candidate of found) {
        const distance = Math.hypot(candidate.x - expected.x, candidate.y - expected.y);
        if (distance < nearestDistance) {
          nearest = candidate;
          nearestDistance = distance;
        }
      }
      return nearest ? { x: Math.round(nearest.x), y: Math.round(nearest.y) } : expected;
    };
    const detectedNear = (point: Point) =>
      found.some((candidate) => Math.hypot(candidate.x - point.x, candidate.y - point.y) < 10);

    const expectedAnswers = TEMPLATE.answerXs.flatMap((xs) =>
      TEMPLATE.answerYs.flatMap((y) => xs.map((x) => ({ x, y }))),
    );
    const expectedRolls = TEMPLATE.rollXs.flatMap((x) =>
      TEMPLATE.rollYs.map((y) => ({ x, y })),
    );
    const expectedSets = TEMPLATE.setXs.map((x) => ({ x, y: TEMPLATE.setY }));

    // If the printed circles are not visible enough to locate, fail instead of
    // silently reading arbitrary pixels at the calibrated template locations.
    if (
      expectedAnswers.filter(detectedNear).length < 60 ||
      expectedRolls.filter(detectedNear).length < 30 ||
      expectedSets.filter(detectedNear).length < 2
    ) {
      throw new Error("The bubble grids are too blurry to locate. Keep the sheet flat, well-lit, and fully in frame.");
    }

    const answerCenters = TEMPLATE.answerXs.map((xs) =>
      TEMPLATE.answerYs.map((y) => xs.map((x) => refine({ x, y }))),
    );
    const rollCenters = TEMPLATE.rollXs.map((x) =>
      TEMPLATE.rollYs.map((y) => refine({ x, y })),
    );
    const setCenters = TEMPLATE.setXs.map((x) => refine({ x, y: TEMPLATE.setY }));
    return { answerCenters, rollCenters, setCenters };
  } finally {
    gray.delete();
    blurred.delete();
    circles.delete();
  }
}

function readFillDensity(hsvData: Uint8Array, width: number, height: number, x: number, y: number): number {
  let pixels = 0;
  let darkInk = 0;
  for (let dy = -BUBBLE_RADIUS; dy <= BUBBLE_RADIUS; dy++) {
    for (let dx = -BUBBLE_RADIUS; dx <= BUBBLE_RADIUS; dx++) {
      if (dx * dx + dy * dy > BUBBLE_RADIUS * BUBBLE_RADIUS) continue;
      const px = x + dx;
      const py = y + dy;
      if (px < 0 || py < 0 || px >= width || py >= height) continue;
      const offset = (py * width + px) * 3;
      const hue = hsvData[offset];
      const saturation = hsvData[offset + 1];
      const value = hsvData[offset + 2];
      const printedRed = saturation > 36 && (hue <= 18 || hue >= 162);
      if (!printedRed && value < 180) darkInk++;
      pixels++;
    }
  }
  return pixels ? darkInk / pixels : 0;
}

function classifyBubble(density: number): BubbleState {
  if (density >= MARKED_THRESHOLD) return "marked";
  if (density >= AMBIGUOUS_THRESHOLD) return "ambiguous";
  return "blank";
}

function readSingleChoice(
  hsvData: Uint8Array,
  width: number,
  height: number,
  centers: Array<{ x: number; y: number }>,
): number | null {
  const states = centers.map(({ x, y }) =>
    classifyBubble(readFillDensity(hsvData, width, height, x, y)),
  );
  const marked = states.flatMap((state, index) => state === "marked" ? [index] : []);
  const ambiguous = states.some((state) => state === "ambiguous");
  if (marked.length !== 1 || ambiguous) return null;
  return marked[0];
}

export async function scanOmrSheet(imageData: unknown, questionCount: number): Promise<OmrScan> {
  if (!Number.isInteger(questionCount) || questionCount < 1 || questionCount > 30) {
    throw new Error("This OMR sheet supports between 1 and 30 questions.");
  }

  const input = parseImageData(imageData);
  const normalized = await sharp(input, { limitInputPixels: 24_000_000 })
    .rotate()
    .resize({ width: 1800, height: 2500, fit: "inside", withoutEnlargement: true })
    .removeAlpha()
    .toColourspace("srgb")
    .raw()
    .toBuffer({ resolveWithObject: true });

  const cv = await getOpenCv();
  const source = new cv.Mat(normalized.info.height, normalized.info.width, cv.CV_8UC3);
  source.data.set(normalized.data);
  let warped: any;
  const hsv = new cv.Mat();
  try {
    warped = warpToTemplate(cv, source);
    const bubbleCenters = detectBubbleCenters(cv, warped);
    cv.cvtColor(warped, hsv, cv.COLOR_RGB2HSV);
    const data = hsv.data as Uint8Array;
    const width = warped.cols;
    const height = warped.rows;

    const rollDigits: string[] = [];
    let rollIsValid = true;
    for (const centers of bubbleCenters.rollCenters) {
      const selected = readSingleChoice(
        data,
        width,
        height,
        centers,
      );
      if (selected === null) {
        rollIsValid = false;
        break;
      }
      rollDigits.push(String(selected));
    }

    const selectedSet = readSingleChoice(
      data,
      width,
      height,
      bubbleCenters.setCenters,
    );
    const setCode = selectedSet === null ? null : SET_CODES[selectedSet];
    if (setCode === null) {
      throw new Error("The set-code bubbles are blank, multiple, or unclear. Mark exactly one set code and scan again.");
    }

    const responses: OmrResponse[] = [];
    for (let question = 0; question < questionCount; question++) {
      const column = Math.floor(question / 10);
      const row = question % 10;
      const centers = bubbleCenters.answerCenters[column][row];
      const densities = centers.map(({ x, y }) => readFillDensity(data, width, height, x, y));
      const states = densities.map(classifyBubble);
      const marked = states.flatMap((state, index) => state === "marked" ? [index] : []);
      const hasAmbiguous = states.some((state) => state === "ambiguous");

      if (marked.length > 1) {
        responses.push({ question: question + 1, selected: null, status: "multiple" });
      } else if (hasAmbiguous || (marked.length === 1 && states.some((state) => state !== "blank" && state !== "marked"))) {
        responses.push({ question: question + 1, selected: null, status: "ambiguous" });
      } else if (marked.length === 1) {
        responses.push({ question: question + 1, selected: ANSWERS[marked[0]], status: "valid" });
      } else {
        responses.push({ question: question + 1, selected: null, status: "blank" });
      }
    }

    return {
      rollNumber: rollIsValid ? rollDigits.join("") : null,
      setCode,
      responses,
    };
  } finally {
    source.delete();
    hsv.delete();
    warped?.delete();
  }
}
