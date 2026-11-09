/**
 * Photo Collage (M6): layouts, enquadramento por célula, cena e renderizador.
 * Sem React; usado pelo preview e pelo worker de export.
 */
export * from "./crop";
export * from "./export-protocol";
export * from "./layout";
export * from "./scene";
export * from "./templates";
export { createCollageRenderer, type CollageRenderer, type CollageScene, type SceneCell } from "./renderer";
