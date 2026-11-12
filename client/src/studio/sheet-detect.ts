/** Peak centres of a darkness profile, ignoring single noisy rows. */
export function profilePeaks(profile: number[]): number[] {
  if (!profile.length) return [];
  const sorted = [...profile].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const max = sorted[sorted.length - 1];
  if (max - median < 1) return [];
  const threshold = median + (max - median) * 0.35;
  const peaks: number[] = [];
  let start = -1;
  profile.forEach((value, index) => {
    if (value > threshold && start < 0) start = index;
    if ((value <= threshold || index === profile.length - 1) && start >= 0) {
      const end = value > threshold ? index : index - 1;
      peaks.push((start + end) / 2);
      start = -1;
    }
  });
  return peaks;
}

/**
 * Finds evenly spaced writing lines (or dot and grid rows) in a profile of row
 * darkness. Returns the first line and the spacing in profile rows, or nothing
 * when the rows are not regular enough to trust.
 */
export function regularLines(
  profile: number[]
): { first: number; spacing: number } | undefined {
  const peaks = profilePeaks(profile);
  if (peaks.length < 6) return undefined;
  const gaps = peaks.slice(1).map((peak, index) => peak - peaks[index]);
  const sortedGaps = [...gaps].sort((a, b) => a - b);
  const median = sortedGaps[Math.floor(sortedGaps.length / 2)];
  if (median < 3) return undefined;
  const regular = gaps.filter(gap => Math.abs(gap - median) <= median * 0.15);
  if (regular.length < gaps.length * 0.7) return undefined;
  // Average over the whole run so small rounding errors do not add up down the page.
  const runs = peaks.filter(
    (peak, index) =>
      index === 0 || Math.abs(peak - peaks[index - 1] - median) <= median * 0.15
  );
  const spacing =
    runs.length > 1
      ? (runs[runs.length - 1] - runs[0]) / (runs.length - 1)
      : median;
  // Lines at the very top edge are page decoration, not a place to write.
  const first = peaks.find(peak => peak > spacing * 0.8) ?? peaks[0];
  return { first, spacing };
}

/** Measures the writing grid of a sheet image in millimetres. */
export function detectSheetLines(
  image: HTMLImageElement,
  pageHeightMm: number
): { firstLine: number; lineSpacing: number } | undefined {
  const width = 360;
  const height = Math.max(
    1,
    Math.round((image.naturalHeight / image.naturalWidth) * width)
  );
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return undefined;
  context.drawImage(image, 0, 0, width, height);
  const pixels = context.getImageData(0, 0, width, height).data;
  const profile: number[] = [];
  for (let y = 0; y < height; y += 1) {
    let darkness = 0;
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      darkness +=
        255 -
        (pixels[offset] * 0.3 +
          pixels[offset + 1] * 0.59 +
          pixels[offset + 2] * 0.11);
    }
    profile.push(darkness / width);
  }
  const lines = regularLines(profile);
  if (!lines) return undefined;
  const mmPerRow = pageHeightMm / height;
  return {
    firstLine: Number((lines.first * mmPerRow).toFixed(2)),
    lineSpacing: Number((lines.spacing * mmPerRow).toFixed(3)),
  };
}
