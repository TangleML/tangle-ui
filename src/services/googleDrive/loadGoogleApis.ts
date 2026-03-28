const GIS_SRC = "https://accounts.google.com/gsi/client";
const GAPI_SRC = "https://apis.google.com/js/api.js";

function loadScript(src: string): Promise<void> {
  const existing = document.querySelector(`script[src="${src}"]`);
  if (existing) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
    document.head.appendChild(script);
  });
}

let gisPromise: Promise<void> | null = null;

export function loadGis(): Promise<void> {
  if (!gisPromise) {
    gisPromise = loadScript(GIS_SRC);
  }
  return gisPromise;
}

let pickerPromise: Promise<void> | null = null;

export function loadPicker(): Promise<void> {
  if (!pickerPromise) {
    pickerPromise = loadScript(GAPI_SRC).then(
      () =>
        new Promise<void>((resolve, reject) => {
          if (!window.gapi) {
            reject(new Error("gapi not available after script load"));
            return;
          }
          window.gapi.load("picker", resolve);
        }),
    );
  }
  return pickerPromise;
}
