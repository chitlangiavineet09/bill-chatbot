// pdf-service.ts
import { promises as fs } from "fs";
import path from "path";
import os from "os";
import { spawn } from "child_process";
import crypto from "crypto";

type ConvertOptions = {
  maxWidth?: number;   // Max pixel width (pdftocairo/ImageMagick scale)
  dpi?: number;        // Render DPI when using ImageMagick/Ghostscript
  format?: "png";      // We return PNG data URLs
};

type PageImage = {
  pageIndex: number;        // 0-based
  base64Image: string;      // data:image/png;base64,....
};

async function which(cmd: string): Promise<string | null> {
  return new Promise((resolve) => {
    const child = spawn(process.platform === "win32" ? "where" : "which", [cmd]);
    let out = "";
    child.stdout.on("data", (d) => (out += String(d)));
    child.on("close", (code) => resolve(code === 0 ? out.split(/\r?\n/)[0]?.trim() || null : null));
    child.on("error", () => resolve(null));
  });
}

function run(cmd: string, args: string[], cwd?: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { cwd, stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    p.stderr.on("data", (d) => (stderr += String(d)));
    p.on("error", (err) => reject(err));
    p.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}: ${stderr}`))));
  });
}

async function readDirSorted(dir: string, prefix: string, ext = ".png"): Promise<string[]> {
  const entries = await fs.readdir(dir);
  const files = entries
    .filter((f) => f.startsWith(prefix) && f.toLowerCase().endsWith(ext))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  return files.map((f) => path.join(dir, f));
}

async function fileToDataUrl(p: string): Promise<string> {
  const buf = await fs.readFile(p);
  return `data:image/png;base64,${buf.toString("base64")}`;
}

export class PDFService {
  /**
   * Convert a PDF buffer into page PNGs (data URLs).
   * Tries: pdftocairo -> ImageMagick (magick/convert) -> Ghostscript.
   */
  static async convertPDFToImages(
    pdfBuffer: Buffer,
    opts: ConvertOptions = {}
  ): Promise<PageImage[]> {
    const { maxWidth = 1024, dpi = 144 } = opts;

    // Temp workspace
    const id = crypto.randomBytes(8).toString("hex");
    const workdir = await fs.mkdtemp(path.join(os.tmpdir(), `pdf2img-${id}-`));
    const inputPdf = path.join(workdir, "input.pdf");
    const outPrefix = path.join(workdir, "page"); // we'll produce page-001.png etc.

    try {
      await fs.writeFile(inputPdf, pdfBuffer);

      // 1) pdftocairo (Poppler) — preferred
      const pdftocairo = await which("pdftocairo");
      if (pdftocairo) {
        // -png outputs page-1.png, page-2.png...
        // -scale-to keeps aspect ratio; set width target. (Use -scale-to-x/-scale-to-y if needed)
        // Ref: pdftocairo manual / common usage. :contentReference[oaicite:1]{index=1}
        const args = [
          "-png",
          "-scale-to", String(maxWidth),
          inputPdf,
          outPrefix,
        ];
        await run(pdftocairo, args, workdir);

        // files look like: page-1.png ... page-N.png
        const files = await readDirSorted(workdir, path.basename(outPrefix) + "-", ".png");
        if (files.length > 0) {
          const images = await Promise.all(
            files.map(async (f, i) => ({
              pageIndex: i,
              base64Image: await fileToDataUrl(f),
            }))
          );
          return images;
        }
        // fall through if no files created
      }

      // 2) ImageMagick (v7 "magick", or v6 "convert")
      const magick = (await which("magick")) || (await which("convert"));
      if (magick) {
        // Use DPI to control raster quality; use cropbox to respect page boxes. 
        // Example flags drawn from community guidance. :contentReference[oaicite:2]{index=2}
        // Multi-page output pattern: page-%03d.png
        const outputPattern = path.join(workdir, "page-%03d.png");

        // On IM v7: "magick input.pdf -density 144 -resize 1024x output-%03d.png"
        // On IM v6 ("convert") it's the same syntax; we don't pass shell strings.
        const args = [
          "-density", String(dpi),
          inputPdf,
          "-define", "pdf:use-cropbox=true", // similar to Ghostscript -dUseCropBox :contentReference[oaicite:3]{index=3}
          "-resize", `${maxWidth}x`,
          outputPattern,
        ];
        await run(magick, args, workdir);

        const files = await readDirSorted(workdir, "page-", ".png");
        if (files.length > 0) {
          const images = await Promise.all(
            files.map(async (f, i) => ({
              pageIndex: i,
              base64Image: await fileToDataUrl(f),
            }))
          );
          return images;
        }
      }

      // 3) Ghostscript direct
      const gs = await which("gs");
      if (gs) {
        // png16m = 24-bit RGB; -r sets DPI; -dUseCropBox respects crop box. :contentReference[oaicite:4]{index=4}
        const outputPattern = path.join(workdir, "page-%03d.png");
        const args = [
          "-dSAFER",
          "-dBATCH",
          "-dNOPAUSE",
          "-sDEVICE=png16m",
          "-r" + dpi,
          "-dUseCropBox", // as per recommendations. :contentReference[oaicite:5]{index=5}
          "-sOutputFile=" + outputPattern,
          inputPdf,
        ];
        await run(gs, args, workdir);

        const files = await readDirSorted(workdir, "page-", ".png");
        if (files.length > 0) {
          // Optionally post-resize to maxWidth with a second pass (to mimic scale-to)
          // but typically DPI controls size sufficiently.
          const images = await Promise.all(
            files.map(async (f, i) => ({
              pageIndex: i,
              base64Image: await fileToDataUrl(f),
            }))
          );
          return images;
        }
      }

      // If we reach here, nothing produced outputs
      throw new Error("No converter (pdftocairo/magick/gs) produced images. Check tool installation & PATH.");
    } finally {
      // Best-effort cleanup
      try {
        const entries = await fs.readdir(workdir);
        await Promise.all(entries.map((e) => fs.rm(path.join(workdir, e), { recursive: true, force: true })));
        await fs.rm(workdir, { recursive: true, force: true });
      } catch {
        /* ignore */
      }
    }
  }
}

export const convertPDFToImages = PDFService.convertPDFToImages.bind(PDFService);
